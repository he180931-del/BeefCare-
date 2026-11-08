import { describe, expect, it, vi } from 'vitest'
import { createSupportApi } from '../../../src/features/support/api/supportApi'
import { createSupportDemoStore } from '../../../src/features/support/data/supportDemoStore'
import { SupportError } from '../../../src/features/support/domain/supportError'

const transport = () => ({ get: vi.fn(), command: vi.fn(), farmPath: vi.fn() })
function setup() {
  const store = createSupportDemoStore()
  const api = createSupportApi({ mode: 'local', farmId: 1, transport: transport(), store })
  return { store, api }
}
const code = async (p: Promise<unknown>) => {
  try {
    await p
  } catch (e) {
    return e instanceof SupportError ? e.code : 'OTHER'
  }
  return 'NONE'
}

describe('supportApi: danh sách ticket (SCR-64)', () => {
  it('chỉ trả ticket của chủ trại và đếm theo tab', async () => {
    const { api } = setup()
    const page = await api.listTickets()
    expect(page.items.map((t) => t.code)).toEqual(['TK-1042', 'TK-1031', 'TK-1027', 'TK-1019', 'TK-0988'])
    expect(page.counts).toEqual({ ALL: 5, IN_PROGRESS: 2, WAITING_CUSTOMER: 1, RESOLVED: 1, CLOSED: 1 })
    expect((await api.listTickets({ tab: 'WAITING_CUSTOMER' })).items.map((t) => t.code)).toEqual(['TK-1027'])
  })

  it('tìm không dấu theo mã/tiêu đề, lọc danh mục và kỳ cập nhật', async () => {
    const { api } = setup()
    expect((await api.listTickets({ q: 'khoi phuc dich vu' })).items.map((t) => t.code)).toEqual(['TK-1027'])
    expect((await api.listTickets({ q: 'tk-1031' })).total).toBe(1)
    expect((await api.listTickets({ category: 'PAYMENT' })).items.map((t) => t.code)).toEqual(['TK-1042'])
    const oct = await api.listTickets({ from: '2026-10-01', to: '2026-10-20' })
    expect(oct.counts.ALL).toBe(4)
    expect((await api.listTickets({ q: 'khong co ket qua nao' })).total).toBe(0)
  })

  it('không mở được ticket của người khác', async () => {
    const { api } = setup()
    expect(await code(api.getTicket(1043))).toBe('FORBIDDEN')
    expect(await code(api.getTicket(99999))).toBe('NOT_FOUND')
  })
})

describe('supportApi: gửi yêu cầu (SCR-65)', () => {
  it('báo từng trường thiếu và giữ nguyên danh sách', async () => {
    const { api } = setup()
    const err = await api.createTicket({ category: '', scope: 'FARM', farmId: 1, subject: ' ', description: '' }).catch((e) => e)
    expect(err).toBeInstanceOf(SupportError)
    expect(err.fields).toEqual({ category: 'Vui lòng chọn danh mục.', subject: 'Vui lòng nhập tiêu đề.', description: 'Vui lòng nhập mô tả.' })
    expect((await api.listTickets()).total).toBe(5)
  })

  it('tạo ticket TK-1045 trạng thái mới nhận, ưu tiên bình thường, kèm tin nhắn đầu tiên', async () => {
    const { api } = setup()
    const t = await api.createTicket({ category: 'PAYMENT', scope: 'FARM', farmId: 1, subject: 'Chưa thấy xác nhận', description: 'Đã chuyển khoản' })
    expect(t).toMatchObject({ code: 'TK-1045', status: 'OPEN', priority: 'NORMAL', assignedCs: null, farmName: 'Trại bò Yên Bài – Ba Vì', requester: 'Nguyễn Văn Hùng' })
    expect(t.messages).toHaveLength(1)
    expect(t.messages[0]).toMatchObject({ kind: 'DESCRIPTION', text: 'Đã chuyển khoản' })
    expect((await api.listTickets({ tab: 'IN_PROGRESS' })).total).toBe(3)
  })

  it('phạm vi tài khoản không gắn trại; trại không thuộc sở hữu bị từ chối; quá dài bị từ chối', async () => {
    const { api } = setup()
    const acct = await api.createTicket({ category: 'ACCOUNT_ACCESS', scope: 'ACCOUNT', farmId: 2, subject: 'Không đăng nhập được', description: 'x' })
    expect(acct.farmId).toBeNull()
    expect(await code(api.createTicket({ category: 'OTHER', scope: 'FARM', farmId: 77, subject: 'a', description: 'b' }))).toBe('VALIDATION')
    expect(await code(api.createTicket({ category: 'OTHER', scope: 'ACCOUNT', farmId: null, subject: 'a'.repeat(151), description: 'b' }))).toBe('VALIDATION')
  })
})

describe('supportApi: trả lời, xác nhận, mở lại (SCR-66)', () => {
  it('trả lời công khai: bắt buộc nội dung, đưa WAITING_CUSTOMER về IN_PROGRESS, không mở lại phiếu đã giải quyết', async () => {
    const { api } = setup()
    expect(await code(api.reply(1027, { content: '  ', expectedVersion: 1 }))).toBe('VALIDATION')
    const waiting = await api.getTicket(1027)
    const replied = await api.reply(1027, { content: 'Mã yêu cầu BCE3P8L2.', expectedVersion: waiting.version })
    expect(replied.status).toBe('IN_PROGRESS')
    expect(replied.messages.at(-1)).toMatchObject({ authorRole: 'OWNER', kind: 'REPLY' })
    const resolved = await api.getTicket(1031)
    expect((await api.reply(1031, { content: 'Cảm ơn', expectedVersion: resolved.version })).status).toBe('RESOLVED')
  })

  it('ticket đã đóng không nhận phản hồi, xác nhận hay mở lại', async () => {
    const { api } = setup()
    expect(await code(api.reply(988, { content: 'Cảm ơn', expectedVersion: 1 }))).toBe('CLOSED')
    expect(await code(api.acknowledge(988, { resolutionVersion: 1, expectedVersion: 1 }))).toBe('CLOSED')
    expect(await code(api.reopen(988, { reason: 'Vẫn lỗi', expectedVersion: 1 }))).toBe('CLOSED')
  })

  it('xác nhận kết quả mới nhất: giữ RESOLVED, lưu tin nhắn công khai, xác nhận lặp trả về bản cũ', async () => {
    const { api } = setup()
    const before = await api.getTicket(1031)
    const done = await api.acknowledge(1031, { resolutionVersion: 2, expectedVersion: before.version })
    expect(done.status).toBe('RESOLVED')
    expect(done.resolutions.find((r) => r.version === 2)).toMatchObject({ acknowledged: true })
    expect(done.messages.at(-1)).toMatchObject({ kind: 'ACKNOWLEDGMENT', code: 'MSG-5512' })
    const again = await api.acknowledge(1031, { resolutionVersion: 2, expectedVersion: done.version })
    expect(again.version).toBe(done.version)
    expect(again.messages).toHaveLength(done.messages.length)
  })

  it('xác nhận phiên bản cũ khi CS đã ghi kết quả mới: báo kết quả đã thay đổi', async () => {
    const { api, store } = setup()
    const seen = await api.getTicket(1031)
    await store.simulateCsResolve(1031, 'Phiên bản mới của kết quả.')
    expect(await code(api.acknowledge(1031, { resolutionVersion: 2, expectedVersion: seen.version }))).toBe('RESULT_CHANGED')
    const fresh = await api.getTicket(1031)
    expect(fresh.resolutions.map((r) => r.version)).toEqual([2, 3])
    expect(fresh.resolutions.every((r) => !r.acknowledged)).toBe(true)
  })

  it('mở lại: bắt buộc lý do, về OPEN cho cùng CS, hủy xác nhận cũ, ghi lịch sử và tin nhắn', async () => {
    const { api } = setup()
    const t = await api.getTicket(1031)
    expect(await code(api.reopen(1031, { reason: '   ', expectedVersion: t.version }))).toBe('VALIDATION')
    expect(await code(api.reopen(1031, { reason: 'x'.repeat(1001), expectedVersion: t.version }))).toBe('VALIDATION')
    const acked = await api.acknowledge(1031, { resolutionVersion: 2, expectedVersion: t.version })
    const reopened = await api.reopen(1031, { reason: 'Đã thử Chrome nhưng vẫn chưa quét được', expectedVersion: acked.version })
    expect(reopened).toMatchObject({ status: 'OPEN', assignedCs: 'Phạm Thu Hà' })
    expect(reopened.resolutions.every((r) => !r.acknowledged)).toBe(true)
    expect(reopened.messages.at(-1)).toMatchObject({ kind: 'REOPEN', text: 'Đã thử Chrome nhưng vẫn chưa quét được' })
    expect(reopened.history.at(-1)).toMatchObject({ event: 'REOPENED', reason: 'Đã thử Chrome nhưng vẫn chưa quét được' })
    expect(await code(api.reopen(1031, { reason: 'Lại', expectedVersion: reopened.version }))).toBe('STATE_CHANGED')
  })
})

describe('supportApi: chế độ backend', () => {
  it('gọi API thật và không đụng tới store', async () => {
    const store = createSupportDemoStore()
    const spy = vi.spyOn(store, 'listTickets')
    const http = transport()
    const api = createSupportApi({ mode: 'backend', farmId: 1, transport: http, store })
    await expect(api.listTickets()).resolves.toMatchObject({ items: [], total: 0 })
    await expect(api.createTicket({ category: 'OTHER', scope: 'ACCOUNT', farmId: null, subject: 'a', description: 'b' })).resolves.toMatchObject({ id: 0 })
    expect(spy).not.toHaveBeenCalled()
    expect(http.get).toHaveBeenCalled()
    expect(http.command).toHaveBeenCalled()
  })
})
