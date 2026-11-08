import { describe, expect, it, vi } from 'vitest'
import { createSupportApi } from '../../../src/features/platform-support/api/supportApi'
import { createSupportDemoStore } from '../../../src/features/platform-support/data/supportDemoStore'
import { CS_ME, PM_QUAN, SA_NAM } from '../../../src/features/platform-support/data/supportMock'

const transport = () => ({ get: vi.fn(), command: vi.fn(), farmPath: vi.fn() })
const make = () => createSupportApi({ mode: 'local', farmId: 1, transport: transport(), store: createSupportDemoStore() })

describe('hàng đợi hỗ trợ', () => {
  it('đếm tab đúng và sắp ưu tiên cao trước', async () => {
    const api = make()
    const all = await api.listQueue(CS_ME, { size: 50 })
    expect(all.total).toBe(21)
    expect(all.counts).toMatchObject({ unassigned: 4, mine: 6, waiting: 3, resolved: 2, unassignedHigh: 2 })
    expect(all.items[0].priority).toBe('HIGH')
    const unassigned = await api.listQueue(CS_ME, { tab: 'unassigned' })
    expect(unassigned.items.every((t) => t.assignedCsId === null)).toBe(true)
    expect((await api.listQueue(CS_ME, { q: 'qr' })).items.map((t) => t.code)).toEqual(['TK-1031'])
  })

  it('nhận ticket: chuyển Đang xử lý, người khác nhận sau bị từ chối, nhận lại giữ Đã giải quyết', async () => {
    const api = make()
    const claimed = await api.claim(CS_ME, 'TK-1044', {})
    expect(claimed).toMatchObject({ assignedCsId: CS_ME.id, status: 'IN_PROGRESS' })
    await expect(api.claim({ id: 2, name: 'Ngô Minh Khang', role: 'CS' }, 'TK-1044', {})).rejects.toMatchObject({ code: 'CONFLICT' })
    await expect(api.claim(CS_ME, 'TK-1031', {})).rejects.toMatchObject({ code: 'VALIDATION' })
    const again = await api.claim(CS_ME, 'TK-1031', { reason: 'Tiếp nhận lại để xem xác nhận mới nhất' })
    expect(again).toMatchObject({ status: 'RESOLVED', assignedCsId: CS_ME.id, assignedAvailable: true })
  })

  it('chuyển giao cần lý do; CS không phụ trách không được thao tác', async () => {
    const api = make()
    await expect(api.handOver(CS_ME, 'TK-1042', { toCsId: 2, reason: ' ' })).rejects.toMatchObject({ code: 'VALIDATION' })
    const t = await api.handOver(CS_ME, 'TK-1042', { toCsId: 2, reason: 'Bàn giao ca làm việc' })
    expect(t.assignedCs).toBe('Ngô Minh Khang')
    expect(t.internalRequests.find((r) => r.code === 'IR-077')?.status).toBe('OPEN')
    await expect(api.reply(CS_ME, 'TK-1042', { text: 'xin chào' })).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})

describe('giải quyết và đóng ticket', () => {
  it('IR đang mở khóa ghi kết quả; sau khi PM hoàn thành thì ghi được, đóng cần xác nhận của Chủ trại', async () => {
    const api = make()
    await expect(api.resolve(CS_ME, 'TK-1042', { content: 'Đã xác nhận giao dịch.' })).rejects.toMatchObject({ code: 'CONFLICT' })
    await api.completeInternal(PM_QUAN, 'IR-077', { outcome: 'UNABLE', result: 'Chưa có mã chính xác duy nhất.', expectedVersion: 1 })
    await expect(api.resolve(CS_ME, 'TK-1042', { content: '  ' })).rejects.toMatchObject({ code: 'VALIDATION' })
    const resolved = await api.resolve(CS_ME, 'TK-1042', { content: 'Giao dịch BCF7K2Q9 đã được xác nhận.' })
    expect(resolved).toMatchObject({ status: 'RESOLVED' })
    expect(resolved.resolutions.at(-1)?.version).toBe(1)
    await expect(api.close(CS_ME, 'TK-1042', { reviewed: true })).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('đóng TK-1031 cần tick xác nhận; sau đó ticket chỉ đọc', async () => {
    const api = make()
    await api.claim(CS_ME, 'TK-1031', { reason: 'Tiếp nhận lại' })
    await expect(api.close(CS_ME, 'TK-1031', { reviewed: false })).rejects.toMatchObject({ code: 'VALIDATION' })
    const closed = await api.close(CS_ME, 'TK-1031', { reviewed: true, note: 'Chủ trại đã xác nhận' })
    expect(closed.status).toBe('CLOSED')
    await expect(api.reply(CS_ME, 'TK-1031', { text: 'thêm' })).rejects.toMatchObject({ code: 'CONFLICT' })
    expect((await api.listQueue(CS_ME, { size: 50 })).total).toBe(20)
  })
})

describe('yêu cầu nội bộ', () => {
  it('mỗi vai trò chỉ một IR đang mở; tạo cho SA được và mã tăng tiếp', async () => {
    const api = make()
    await expect(api.createInternal(CS_ME, 'TK-1042', { targetRole: 'PM', recipientId: 21, question: 'Kiểm tra lại' })).rejects.toMatchObject({ code: 'CONFLICT' })
    const ir = await api.createInternal(CS_ME, 'TK-1042', { targetRole: 'SA', recipientId: 31, question: 'Kiểm tra quyền truy cập của User USR-1042' })
    expect(ir).toMatchObject({ code: 'IR-082', recipient: 'Vũ Hoàng Nam', status: 'OPEN' })
    await expect(api.createInternal(CS_ME, 'TK-1042', { targetRole: 'SA', recipientId: 99, question: 'x' })).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('đổi người nhận làm người cũ mất quyền; hủy IR chuyển Đã hủy', async () => {
    const api = make()
    await api.manageInternal(CS_ME, 'TK-1042', 'IR-077', { action: 'REASSIGN', recipientId: 22, reason: 'Người nhận cũ vắng mặt' })
    await expect(api.getAssigned(PM_QUAN, 'IR-077')).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect((await api.getAssigned({ id: 22, name: 'Trần Minh Đức', role: 'PM' }, 'IR-077')).recipient).toBe('Trần Minh Đức')
    await expect(api.manageInternal(CS_ME, 'TK-1042', 'IR-077', { action: 'CANCEL', reason: '' })).rejects.toMatchObject({ code: 'VALIDATION' })
    const cancelled = await api.manageInternal(CS_ME, 'TK-1042', 'IR-077', { action: 'CANCEL', reason: 'Sai phạm vi' })
    expect(cancelled.status).toBe('CANCELLED')
  })

  it('mã IR từ thông báo SA: có, không có, không thuộc người xem', async () => {
    const api = make()
    for (const code of ['IR-073', 'IR-076', 'IR-078', 'IR-081']) expect((await api.getAssigned(SA_NAM, code)).code).toBe(code)
    await expect(api.getAssigned(SA_NAM, 'IR-999')).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(api.getAssigned(SA_NAM, 'IR-077')).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('hoàn thành: Đã thực hiện cần tham chiếu hợp lệ; Ngoài phạm vi chỉ cần kết quả; không hoàn thành hai lần', async () => {
    const api = make()
    await expect(api.completeInternal(SA_NAM, 'IR-081', { outcome: 'PERFORMED', result: 'ok', expectedVersion: 1 })).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(api.completeInternal(SA_NAM, 'IR-081', { outcome: 'OUTSIDE_DOMAIN', result: '', expectedVersion: 1 })).rejects.toMatchObject({ code: 'VALIDATION' })
    const done = await api.completeInternal(SA_NAM, 'IR-081', { outcome: 'OUTSIDE_DOMAIN', result: 'Không có thao tác đổi email Google.', expectedVersion: 1 })
    expect(done).toMatchObject({ status: 'DONE', outcome: 'OUTSIDE_DOMAIN' })
    await expect(api.completeInternal(SA_NAM, 'IR-081', { outcome: 'UNABLE', result: 'x', expectedVersion: 2 })).rejects.toMatchObject({ code: 'CONFLICT' })
    expect((await api.getTicket(CS_ME, 'TK-1025')).status).toBe('OPEN')
  })

  it('lưu Hoàn thành lỗi sau khi miền đã commit: thử lại cùng tham chiếu', async () => {
    const api = make()
    const cmd = { outcome: 'PERFORMED' as const, result: 'Đã chấp nhận thanh toán.', domainResultAuditId: 843, expectedVersion: 1 }
    await expect(api.completeInternal(PM_QUAN, 'IR-077', { ...cmd, simulateSaveFailure: true })).rejects.toMatchObject({ code: 'SAVE_FAILED_AFTER_DOMAIN' })
    expect((await api.getAssigned(PM_QUAN, 'IR-077')).status).toBe('OPEN')
    expect((await api.completeInternal(PM_QUAN, 'IR-077', cmd)).status).toBe('DONE')
  })
})

describe('chế độ backend', () => {
  it('gọi API thật và không đụng vào store', async () => {
    const store = createSupportDemoStore()
    const spy = vi.spyOn(store, 'listQueue')
    const http = transport()
    const api = createSupportApi({ mode: 'backend', farmId: 1, transport: http, store })
    await expect(api.listQueue(CS_ME, {})).resolves.toMatchObject({ items: [], total: 0 })
    expect(spy).not.toHaveBeenCalled()
    expect(http.get).toHaveBeenCalled()
  })
})
