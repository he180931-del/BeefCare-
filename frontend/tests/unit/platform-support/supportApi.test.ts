import { describe, expect, it, vi } from 'vitest'
import { createSupportApi } from '../../../src/features/platform-support/api/supportApi'
import { createSupportDemoStore } from '../../../src/features/platform-support/data/supportDemoStore'
import { CS_ME, PM_QUAN, SA_NAM } from '../../../src/features/platform-support/data/supportMock'
import { latestResolution } from '../../../src/features/platform-support/domain/supportRules'

const transport = () => ({ get: vi.fn(), command: vi.fn(), farmPath: vi.fn() })
const make = () => createSupportApi({ mode: 'local', farmId: 1, transport: transport(), store: createSupportDemoStore() })

describe('hàng đợi hỗ trợ', () => {
  it('không nhận ticket khi thiếu phiên bản hiện tại', async () => {
    const api = make()
    // @ts-expect-error Kiểm tra phòng thủ runtime khi caller cũ chưa gửi expectedVersion.
    await expect(api.claim(CS_ME, 'TK-1044', {})).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(api.claim(CS_ME, 'TK-1044', { expectedVersion: 1 })).resolves.toMatchObject({ assignedCsId: CS_ME.id, status: 'IN_PROGRESS' })
  })

  it('chọn kết quả giải quyết mới nhất theo version dù API trả giảm dần', () => {
    expect(latestResolution({ resolutions: [
      { id: 2, version: 2, content: 'mới', resolvedBy: 'CS', resolvedAt: '2026-11-02T10:00:00', acknowledged: false, reviewed: false },
      { id: 1, version: 1, content: 'cũ', resolvedBy: 'CS', resolvedAt: '2026-11-01T10:00:00', acknowledged: true, reviewed: true },
    ] })?.content).toBe('mới')
  })
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
    const claimed = await api.claim(CS_ME, 'TK-1044', { expectedVersion: 1 })
    expect(claimed).toMatchObject({ assignedCsId: CS_ME.id, status: 'IN_PROGRESS' })
    await expect(api.claim({ id: 2, name: 'Ngô Minh Khang', role: 'CS' }, 'TK-1044', { expectedVersion: 2 })).rejects.toMatchObject({ code: 'CONFLICT' })
    await expect(api.claim(CS_ME, 'TK-1031', { expectedVersion: 6 })).rejects.toMatchObject({ code: 'VALIDATION' })
    const again = await api.claim(CS_ME, 'TK-1031', { reason: 'Tiếp nhận lại để xem xác nhận mới nhất', expectedVersion: 6 })
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
    await api.completeInternal(PM_QUAN, 'IR-077', { outcome: 'NOT_CONFIRMED', resultNote: 'Chưa có mã chính xác duy nhất.', expectedVersion: 1 })
    await expect(api.resolve(CS_ME, 'TK-1042', { content: '  ' })).rejects.toMatchObject({ code: 'VALIDATION' })
    const resolved = await api.resolve(CS_ME, 'TK-1042', { content: 'Giao dịch BCF7K2Q9 đã được xác nhận.' })
    expect(resolved).toMatchObject({ status: 'RESOLVED' })
    expect(resolved.resolutions.at(-1)?.version).toBe(1)
    await expect(api.close(CS_ME, 'TK-1042', { reviewed: true })).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('đóng TK-1031 cần tick xác nhận; sau đó ticket chỉ đọc', async () => {
    const api = make()
    await api.claim(CS_ME, 'TK-1031', { reason: 'Tiếp nhận lại', expectedVersion: 6 })
    await expect(api.close(CS_ME, 'TK-1031', { reviewed: false })).rejects.toMatchObject({ code: 'VALIDATION' })
    const closed = await api.close(CS_ME, 'TK-1031', { reviewed: true, note: 'Chủ trại đã xác nhận' })
    expect(closed.status).toBe('CLOSED')
    await expect(api.reply(CS_ME, 'TK-1031', { text: 'thêm' })).rejects.toMatchObject({ code: 'CONFLICT' })
    expect((await api.listQueue(CS_ME, { size: 50 })).total).toBe(20)
  })
})

describe('yêu cầu nội bộ', () => {
  it('chỉ nhận outcome target và gửi resultNote cho completion', async () => {
    await expect(make().completeInternal(SA_NAM, 'IR-081', { outcome: 'OUTSIDE_DOMAIN', result: 'legacy', expectedVersion: 1 } as never)).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(make().completeInternal(SA_NAM, 'IR-081', { outcome: 'CONFIRMED', resultNote: 'Đã xác minh trạng thái.', expectedVersion: 1 })).resolves.toMatchObject({ status: 'DONE', outcome: 'CONFIRMED', resultNote: 'Đã xác minh trạng thái.' })
  })

  it('mỗi vai trò chỉ một IR đang mở; tạo cho SA được và mã tăng tiếp', async () => {
    const api = make()
    await expect(api.createInternal(CS_ME, 'TK-1042', { targetRole: 'PM', recipientId: 21, requestText: 'Kiểm tra lại' })).rejects.toMatchObject({ code: 'CONFLICT' })
    const ir = await api.createInternal(CS_ME, 'TK-1042', { targetRole: 'SA', recipientId: 31, requestText: 'Kiểm tra quyền truy cập của User USR-1042' })
    expect(ir).toMatchObject({ code: 'IR-083', recipient: 'Vũ Hoàng Nam', status: 'OPEN' })
    await expect(api.createInternal(CS_ME, 'TK-1042', { targetRole: 'SA', recipientId: 99, requestText: 'x' })).rejects.toMatchObject({ code: 'CONFLICT' })
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

  it('hoàn thành: target outcomes cần resultNote; không hoàn thành hai lần', async () => {
    const api = make()
    await expect(api.completeInternal(SA_NAM, 'IR-081', { outcome: 'OUT_OF_SCOPE', resultNote: '', expectedVersion: 1 })).rejects.toMatchObject({ code: 'VALIDATION' })
    const done = await api.completeInternal(SA_NAM, 'IR-081', { outcome: 'OUT_OF_SCOPE', resultNote: 'Không có thao tác đổi email Google.', expectedVersion: 1 })
    expect(done).toMatchObject({ status: 'DONE', outcome: 'OUT_OF_SCOPE' })
    await expect(api.completeInternal(SA_NAM, 'IR-081', { outcome: 'NOT_CONFIRMED', resultNote: 'x', expectedVersion: 2 })).rejects.toMatchObject({ code: 'CONFLICT' })
    expect((await api.getTicket(CS_ME, 'TK-1025')).status).toBe('OPEN')
  })

  it('lưu Hoàn thành lỗi sau khi miền đã commit: thử lại cùng tham chiếu', async () => {
    const api = make()
    const cmd = { outcome: 'CONFIRMED' as const, resultNote: 'Đã chấp nhận thanh toán.', expectedVersion: 1 }
    await expect(api.completeInternal(PM_QUAN, 'IR-077', { ...cmd, simulateSaveFailure: true })).rejects.toMatchObject({ code: 'SAVE_FAILED_AFTER_DOMAIN' })
    expect((await api.getAssigned(PM_QUAN, 'IR-077')).status).toBe('OPEN')
    expect((await api.completeInternal(PM_QUAN, 'IR-077', cmd)).status).toBe('DONE')
  })
})

describe('chế độ backend', () => {
  it('fails closed when actor identity is missing instead of creating actor id zero', () => {
    const store = createSupportDemoStore()
    const backendApi = createSupportApi({ mode: 'backend', farmId: 1, transport: transport(), store })
    const localApi = createSupportApi({ mode: 'local', farmId: 1, transport: transport(), store })

    expect(() => backendApi.actorFor({ fullName: 'Chưa đăng nhập', role: 'CS' })).toThrow('Không xác định được người thao tác đã đăng nhập.')
    expect(() => localApi.actorFor({ fullName: 'Chưa đăng nhập', role: 'CS' })).toThrow('Không xác định được người thao tác đã đăng nhập.')
    expect(() => backendApi.actorFor({ id: 0, fullName: 'ID không hợp lệ', role: 'CS' })).toThrow('Không xác định được người thao tác đã đăng nhập.')
  })

  it('rejects required ticket and recipient ids instead of mapping missing ids to zero', async () => {
    const store = createSupportDemoStore()
    const http = transport()
    const api = createSupportApi({ mode: 'backend', farmId: 1, transport: http, store })

    http.get.mockImplementation(async (path: string) => {
      if (path === '/api/platform/support/tickets/9') return { code: 'TK-0009', requesterId: 17 }
      if (path === '/api/platform/support/recipients?role=PM') return [{ name: 'PM' }]
      return {}
    })

    await expect(api.getTicket(CS_ME, '9')).rejects.toMatchObject({ code: 'CONFLICT' })
    await expect(api.listRecipients('PM')).rejects.toMatchObject({ code: 'CONFLICT' })
    expect(http.get).not.toHaveBeenCalledWith('/api/platform/support/tickets/0')
  })

  it('rejects zero recipient command ids without sending recipient 0', async () => {
    const store = createSupportDemoStore()
    const http = transport()
    http.get.mockResolvedValue({
      id: 9, code: 'TK-0009', subject: 'Cần hỗ trợ', category: 'OTHER', priority: 'NORMAL', status: 'IN_PROGRESS',
      requesterId: 17, requester: 'Chủ trại', assignedCsId: 4, assignedCs: 'CS', assignedCsAvailable: true,
      createdAt: '2026-11-01T08:00:00Z', updatedAt: '2026-11-01T09:00:00Z', version: 3, messages: [], resolutions: [], history: [],
      contextOptions: { PM: [], SA: [] }, internalRequests: [],
    })
    const api = createSupportApi({ mode: 'backend', farmId: 1, transport: http, store })

    await expect(api.handOver(CS_ME, '9', { toCsId: 0, reason: 'Bàn giao' })).rejects.toMatchObject({ code: 'CONFLICT' })
    await expect(api.createInternal(CS_ME, '9', { targetRole: 'PM', recipientId: 0, requestText: 'Kiểm tra' })).rejects.toMatchObject({ code: 'CONFLICT' })
    expect(http.command).not.toHaveBeenCalledWith(expect.stringContaining('recipientId'), expect.anything())
    expect(http.command.mock.calls.flatMap(([path, body]) => [path, JSON.stringify(body)]).join('\n')).not.toContain('recipientId":0')
  })

  it('fails safely when an internal request response omits a required id', async () => {
    const store = createSupportDemoStore()
    const http = transport()
    http.get.mockResolvedValue([{ code: 'IR-0081', status: 'DONE', version: 2 }])
    const api = createSupportApi({ mode: 'backend', farmId: 1, transport: http, store })

    await expect(api.listAssigned(PM_QUAN)).rejects.toMatchObject({ code: 'CONFLICT' })
    expect(http.get).toHaveBeenCalledWith('/api/platform/internal-requests')
  })

  it('never resolves a malformed internal code to id zero', async () => {
    const store = createSupportDemoStore()
    const http = transport()
    http.get.mockResolvedValue([{ code: 'IR-0081', status: 'DONE', version: 2 }])
    const api = createSupportApi({ mode: 'backend', farmId: 1, transport: http, store })

    await expect(api.getAssigned(PM_QUAN, 'IR-0081')).rejects.toMatchObject({ code: 'CONFLICT' })
    expect(http.get).not.toHaveBeenCalledWith('/api/platform/internal-requests/0')
  })

  it('derives the DONE completion actor from immutable history', async () => {
    const store = createSupportDemoStore()
    const http = transport()
    http.get.mockResolvedValue([{
      id: 81, code: 'IR-0081', targetRole: 'PM', recipientId: 21, recipient: 'PM', from: 'CS',
      ticketId: 9, ticketCode: 'TK-0009', createdAt: '2026-11-01T08:00:00Z', status: 'DONE', version: 2,
      completedAt: '2026-11-01T09:00:00Z', history: [{ type: 'COMPLETED', actor: 'Đỗ Minh Quân', at: '2026-11-01T09:00:00Z' }],
    }])
    const api = createSupportApi({ mode: 'backend', farmId: 1, transport: http, store })

    await expect(api.listAssigned(PM_QUAN)).resolves.toMatchObject([{ code: 'IR-0081', completedBy: 'Đỗ Minh Quân' }])
  })

  it('does not expose the recipient domain-results lookup adapter', () => {
    const store = createSupportDemoStore()
    const http = transport()
    const api = createSupportApi({ mode: 'backend', farmId: 1, transport: http, store })

    expect(api).not.toHaveProperty('listDomainResults')
  })

  it('gửi và đọc các trường target FE20, nhưng vẫn nhận alias lịch sử', async () => {
    const store = createSupportDemoStore()
    const http = transport()
    http.get.mockImplementation(async (path: string) => {
      if (path === '/api/platform/support/tickets/9') return {
        id: 9, code: 'TK-0009', subject: 'Cần hỗ trợ', category: 'OTHER', priority: 'NORMAL', status: 'IN_PROGRESS',
        requesterId: 17, requester: 'Chủ trại', assignedCsId: 4, assignedCs: 'CS', assignedCsAvailable: true,
        createdAt: '2026-11-01T08:00:00Z', updatedAt: '2026-11-01T09:00:00Z', version: 3, messages: [], resolutions: [], history: [],
        contextOptions: { PM: [], SA: [] }, internalRequests: [],
      }
      if (path === '/api/platform/internal-requests') return [{ id: 82, code: 'IR-0082', status: 'OPEN', version: 1, requestText: 'Kiểm tra dịch vụ' }]
      return {}
    })
    http.command.mockResolvedValue({ id: 82, code: 'IR-0082', targetRole: 'PM', recipientId: 21, recipient: 'PM', from: 'CS', ticketId: 9, ticketCode: 'TK-0009', farmId: 1, farmName: 'Trại', createdAt: '2026-11-01T08:00:00Z', requestText: 'Kiểm tra dịch vụ', status: 'DONE', outcome: 'CONFIRMED', resultNote: 'Đã xác minh.', version: 2 })
    const api = createSupportApi({ mode: 'backend', farmId: 1, transport: http, store })

    await api.createInternal(CS_ME, '9', { targetRole: 'PM', recipientId: 21, requestText: 'Kiểm tra dịch vụ' })
    expect(http.command).toHaveBeenCalledWith('/api/platform/support/tickets/9/internal-requests', { targetRole: 'PM', recipientId: 21, requestText: 'Kiểm tra dịch vụ', ticketVersion: 3 })
    const response = await api.completeInternal(PM_QUAN, 'IR-0082', { outcome: 'CONFIRMED', resultNote: 'Đã xác minh.', expectedVersion: 1 })
    expect(response).toMatchObject({ requestText: 'Kiểm tra dịch vụ', resultNote: 'Đã xác minh.', outcome: 'CONFIRMED' })
    expect(http.command).toHaveBeenLastCalledWith('/api/platform/internal-requests/82/completion', { outcome: 'CONFIRMED', resultNote: 'Đã xác minh.', expectedVersion: 1 })
  })

  it('maps the named-recipient target projection without legacy response fields', async () => {
    const store = createSupportDemoStore()
    const http = transport()
    http.get.mockResolvedValue([{
      id: 81, code: 'IR-0081', targetRole: 'PM', recipientId: 21, recipient: 'PM', from: 'CS',
      ticketId: 9, ticketCode: 'TK-0009', farmId: 1, farmName: 'Trại', createdAt: '2026-11-01T08:00:00Z',
      requestText: 'Kiểm tra trạng thái dịch vụ', resultNote: 'Nội dung nội bộ',
      question: 'legacy question', context: [{ type: 'PAYMENT', id: 44, label: 'Thanh toán #44' }], result: 'legacy result', domainResultAuditId: 44,
      status: 'OPEN', version: 1,
      history: [{ id: 1, type: 'CREATED', note: 'Kiểm tra trạng thái dịch vụ', actor: 'CS', at: '2026-11-01T08:00:00Z' }],
    }])
    const api = createSupportApi({ mode: 'backend', farmId: 1, transport: http, store })

    const [request] = await api.listAssigned(PM_QUAN)

    expect(request).toMatchObject({ code: 'IR-0081', requestText: 'Kiểm tra trạng thái dịch vụ', resultNote: 'Nội dung nội bộ' })
    expect(request).not.toHaveProperty('question')
    expect(request).not.toHaveProperty('context')
    expect(request).not.toHaveProperty('result')
    expect(request).not.toHaveProperty('domainResultAuditId')
  })

  it('gọi API thật và không đụng vào store', async () => {
    const store = createSupportDemoStore()
    const spy = vi.spyOn(store, 'listQueue')
    const http = transport()
    const api = createSupportApi({ mode: 'backend', farmId: 1, transport: http, store })
    await expect(api.listQueue(CS_ME, {})).resolves.toMatchObject({ items: [], total: 0 })
    expect(spy).not.toHaveBeenCalled()
    expect(http.get).toHaveBeenCalled()
  })

  it('map con trỏ hội thoại và tải trang tin nhắn cũ cho CS', async () => {
    const store = createSupportDemoStore()
    const http = transport()
    http.get.mockImplementation(async (path: string) => {
      if (path === '/api/platform/support/tickets/9') return {
        id: 9, code: 'TK-0009', subject: 'Cần hỗ trợ', category: 'OTHER', priority: 'NORMAL', status: 'IN_PROGRESS',
        requesterId: 17, requester: 'Chủ trại', assignedCsId: 4, assignedCs: 'CS', assignedCsAvailable: true,
        createdAt: '2026-11-01T08:00:00Z', updatedAt: '2026-11-01T09:00:00Z', version: 2,
        messages: [{ id: 42, audience: 'PUBLIC', author: 'CS', authorRole: 'CS', content: 'Tin mới', createdAt: '2026-11-01T09:00:00Z' }],
        messagesBeforeId: 42, messagesHasMore: true,
        resolutions: [], history: [], internalRequests: [], contextOptions: { PM: [], SA: [] },
      }
      if (path === '/api/platform/support/tickets/9/messages?beforeId=42&size=20') return {
        items: [{ id: 21, audience: 'CS_ONLY', author: 'CS', authorRole: 'CS', content: 'Ghi chú cũ', createdAt: '2026-11-01T08:30:00Z' }],
        nextBeforeId: null,
        hasMore: false,
      }
      return {}
    })
    const api = createSupportApi({ mode: 'backend', farmId: 1, transport: http, store })

    await expect(api.getTicket(CS_ME, '9')).resolves.toMatchObject({ messagesBeforeId: 42, messagesHasMore: true })
    await expect(api.getMessages(CS_ME, '9', 42)).resolves.toMatchObject({
      items: [{ id: 21, visibility: 'INTERNAL', text: 'Ghi chú cũ' }],
      nextBeforeId: null,
      hasMore: false,
    })
    expect(http.get).toHaveBeenCalledWith('/api/platform/support/tickets/9/messages?beforeId=42&size=20')
  })

  it('UC-FE03-08 (D32): giữ cờ cần đổi người nhận của yêu cầu nội bộ khi người nhận bị tạm ngưng', async () => {
    const store = createSupportDemoStore()
    const http = transport()
    const request = { id: 81, code: 'IR-081', targetRole: 'SA', recipientId: 31, recipient: 'Nam', ticketId: 9, question: 'Kiểm tra tài khoản', context: [], version: 1 }
    http.get.mockImplementation(async (path: string) => path === '/api/platform/support/tickets/9' ? {
      id: 9, code: 'TK-0009', subject: 'Cần hỗ trợ', category: 'OTHER', priority: 'NORMAL', status: 'IN_PROGRESS',
      requesterId: 17, requester: 'Chủ trại', assignedCsId: 4, assignedCs: 'CS', assignedCsAvailable: true,
      createdAt: '2026-11-01T08:00:00Z', updatedAt: '2026-11-01T09:00:00Z', version: 2, messages: [], messagesBeforeId: null, messagesHasMore: false,
      resolutions: [], history: [], contextOptions: { PM: [], SA: [] },
      internalRequests: [{ ...request, status: 'OPEN', needsReassignment: true }, { ...request, id: 82, code: 'IR-082', status: 'DONE', needsReassignment: false }],
    } : {})
    const api = createSupportApi({ mode: 'backend', farmId: 1, transport: http, store })
    const ticket = await api.getTicket(CS_ME, '9')
    expect(ticket.internalRequests.map((r) => [r.code, r.needsReassignment])).toEqual([['IR-081', true], ['IR-082', false]])
  })

  it('map lịch sử InternalView từ server và giữ tương thích khi response cũ thiếu history', async () => {
    const store = createSupportDemoStore()
    const http = transport()
    const base = { id: 81, code: 'IR-081', targetRole: 'SA', recipientId: 31, recipient: 'Nam', from: 'CS', ticketId: 9, ticketCode: 'TK-0009', farmId: 1, farmName: 'Trại', createdAt: '2026-11-01T08:00:00Z', question: 'Kiểm tra tài khoản', context: [], status: 'OPEN', version: 1 }
    http.get.mockImplementation(async (path: string) => {
      if (path === '/api/platform/internal-requests') return [{ ...base, history: [
        { id: 1, type: 'CREATED', note: 'Kiểm tra tài khoản', actorId: 4, actor: 'CS', actorRole: 'CS', at: '2026-11-01T08:00:00Z', version: 1, state: 'OPEN' },
        { id: 2, type: 'REASSIGNED', note: 'Người nhận cũ vắng mặt', actorId: 4, actor: 'CS', actorRole: 'CS', at: '2026-11-01T08:05:00Z', version: 2, state: 'OPEN' },
      ] }]
      if (path === '/api/platform/internal-requests/81') return base
      return {}
    })
    const api = createSupportApi({ mode: 'backend', farmId: 1, transport: http, store })

    await expect(api.listAssigned(CS_ME)).resolves.toMatchObject([{
      history: [
        { at: '2026-11-01T08:00:00Z', actor: 'CS', text: 'Kiểm tra tài khoản' },
        { at: '2026-11-01T08:05:00Z', actor: 'CS', text: 'Người nhận cũ vắng mặt' },
      ],
    }])
    await expect(api.getAssigned(CS_ME, 'IR-081')).resolves.toMatchObject({ history: undefined })

    http.get.mockImplementation(async (path: string) => path === '/api/platform/internal-requests' ? [{ ...base, history: [] }] : ({ ...base, history: [] }))
    await expect(api.getAssigned(CS_ME, 'IR-081')).resolves.toMatchObject({ history: [] })
  })

  it('giải mã mã IR bằng endpoint yêu cầu nội bộ và không ép chỉ trạng thái OPEN', async () => {
    const store = createSupportDemoStore()
    const http = transport()
    http.get.mockImplementation(async (path: string) => {
      if (path === '/api/platform/internal-requests') return [{ id: 77, code: 'IR-077', ticketId: 9, recipientId: 21, status: 'DONE', version: 2, question: 'Kiểm tra' }]
      if (path === '/api/platform/internal-requests/77') return { id: 77, code: 'IR-077', ticketId: 9, recipientId: 21, status: 'DONE', version: 2, question: 'Kiểm tra' }
      return {}
    })
    const api = createSupportApi({ mode: 'backend', farmId: 1, transport: http, store })
    await expect(api.listAssigned(CS_ME)).resolves.toHaveLength(1)
    await expect(api.getAssigned(PM_QUAN, 'IR-077')).resolves.toMatchObject({ code: 'IR-077', status: 'DONE' })
    expect(http.get).toHaveBeenCalledWith('/api/platform/internal-requests')
    expect(http.get).toHaveBeenCalledWith('/api/platform/internal-requests/77')
  })

  it('thông báo hỗ trợ dùng notification API thật và mở đúng yêu cầu nội bộ', async () => {
    const store = createSupportDemoStore()
    const http = transport()
    http.get.mockResolvedValue([{ id: 8, category: 'SUPPORT', targetType: 'INTERNAL_REQUEST', targetId: 77, title: 'IR-077', summary: 'Cần xử lý', createdTime: '2026-11-01T10:00:00Z', readTime: null }])
    const api = createSupportApi({ mode: 'backend', farmId: 1, transport: http, store })
    await expect(api.listNotifications()).resolves.toMatchObject([{ targetType: 'INTERNAL_REQUEST', ticketCode: '77', actionLabel: 'Mở yêu cầu' }])
    await api.markNotificationRead(8)
    expect(http.command).toHaveBeenCalledWith('/api/notifications/8/read', undefined, { method: 'PUT' })
  })

  it('lọc hàng đợi theo farmId và chỉ gửi các assignment backend có nghĩa', async () => {
    const store = createSupportDemoStore()
    const http = transport()
    http.get.mockImplementation(async (path: string) => {
      if (path.startsWith('/api/platform/support/tickets?')) return { items: [], total: 0, page: 0, size: 25, counts: {} }
      return {}
    })
    const api = createSupportApi({ mode: 'backend', farmId: 1, transport: http, store })
    await api.listQueue(CS_ME, { farm: '1151', assignment: 'unassigned' })
    expect(http.get).toHaveBeenCalledWith(expect.stringContaining('farmId=1151'))
    expect(http.get).toHaveBeenCalledWith(expect.stringContaining('assignment=UNASSIGNED'))
    await api.listQueue(CS_ME, { farm: '1151', assignment: 'all' })
    expect(http.get).toHaveBeenCalledWith(expect.not.stringContaining('assignment=MINE'))
  })

  it('giữ trạng thái NEED_MORE_INFO/WAITING_CS và gửi CLARIFY đúng payload InternalManage', async () => {
    const store = createSupportDemoStore()
    const http = transport()
    http.get.mockImplementation(async (path: string) => {
      if (path === '/api/platform/internal-requests') return [{ id: 82, code: 'IR-0082', targetRole: 'PM', recipientId: 21, recipient: 'PM', from: 'CS', ticketId: 9, ticketCode: 'TK-0009', farmId: 1, farmName: 'Trại', createdAt: '2026-11-01T08:00:00Z', question: 'Cần bổ sung chứng từ', context: [], status: 'WAITING_CS', outcome: 'NEED_MORE_INFO', resultNote: 'Thiếu mã giao dịch', version: 2 }]
      if (path === '/api/platform/support/tickets/9') return {
        id: 9, code: 'TK-0009', subject: 'Cần hỗ trợ', category: 'OTHER', priority: 'NORMAL', status: 'IN_PROGRESS',
        requesterId: 17, requester: 'Chủ trại', assignedCsId: 4, assignedCs: 'CS', assignedCsAvailable: true,
        createdAt: '2026-11-01T08:00:00Z', updatedAt: '2026-11-01T09:00:00Z', version: 2, messages: [],
        resolutions: [], history: [], contextOptions: { PM: [], SA: [] },
        internalRequests: [{ id: 82, code: 'IR-0082', targetRole: 'PM', recipientId: 21, recipient: 'PM', from: 'CS', ticketId: 9, ticketCode: 'TK-0009', farmId: 1, farmName: 'Trại', createdAt: '2026-11-01T08:00:00Z', question: 'Cần bổ sung chứng từ', context: [], status: 'WAITING_CS', outcome: 'NEED_MORE_INFO', resultNote: 'Thiếu mã giao dịch', version: 2 }],
      }
      return {}
    })
    http.command.mockResolvedValue({ id: 82, code: 'IR-0082', targetRole: 'PM', recipientId: 21, recipient: 'PM', from: 'CS', ticketId: 9, ticketCode: 'TK-0009', farmId: 1, farmName: 'Trại', createdAt: '2026-11-01T08:00:00Z', question: 'Cần bổ sung chứng từ', context: [], status: 'OPEN', outcome: 'NEED_MORE_INFO', resultNote: 'Đã gửi câu hỏi bổ sung', version: 3 })
    const api = createSupportApi({ mode: 'backend', farmId: 1, transport: http, store })

    await expect(api.listAssigned(PM_QUAN)).resolves.toMatchObject([{ status: 'WAITING_CS', outcome: 'NEED_MORE_INFO' }])
    await expect(api.manageInternal(CS_ME, '9', 'IR-0082', { action: 'CLARIFY', clarificationText: 'Đã bổ sung mã giao dịch', reason: undefined } as never)).resolves.toMatchObject({ status: 'OPEN' })
    expect(http.command).toHaveBeenCalledWith('/api/platform/support/tickets/9/internal-requests/82/management', {
      action: 'CLARIFY', recipientId: undefined, reason: undefined, clarificationText: 'Đã bổ sung mã giao dịch', expectedVersion: 2,
    })
  })

  it('gửi kết quả NEED_MORE_INFO qua completion contract', async () => {
    const store = createSupportDemoStore()
    const http = transport()
    http.get.mockResolvedValue([{ id: 82, code: 'IR-0082', status: 'OPEN', version: 1, question: 'Cần bổ sung chứng từ' }])
    http.command.mockResolvedValue({ id: 82, code: 'IR-0082', targetRole: 'PM', recipientId: 21, recipient: 'PM', from: 'CS', ticketId: 9, ticketCode: 'TK-0009', farmName: 'Trại', createdAt: '2026-11-01T08:00:00Z', question: 'Cần bổ sung chứng từ', status: 'WAITING_CS', outcome: 'NEED_MORE_INFO', resultNote: 'Thiếu mã giao dịch', version: 2 })
    const api = createSupportApi({ mode: 'backend', farmId: 1, transport: http, store })
    await expect(api.completeInternal(PM_QUAN, 'IR-0082', { outcome: 'NEED_MORE_INFO', resultNote: 'Thiếu mã giao dịch', expectedVersion: 1 })).resolves.toMatchObject({ status: 'WAITING_CS', outcome: 'NEED_MORE_INFO' })
    expect(http.command).toHaveBeenCalledWith('/api/platform/internal-requests/82/completion', { outcome: 'NEED_MORE_INFO', resultNote: 'Thiếu mã giao dịch', expectedVersion: 1 })
  })

  it('không gửi completion legacy outcome hoặc field result/domain audit lên backend', async () => {
    const store = createSupportDemoStore()
    const http = transport()
    http.get.mockResolvedValue([{ id: 82, code: 'IR-0082', targetRole: 'PM', recipientId: 21, recipient: 'PM', from: 'CS', ticketId: 9, ticketCode: 'TK-0009', status: 'OPEN', version: 1 }])
    const api = createSupportApi({ mode: 'backend', farmId: 1, transport: http, store })
    await expect(api.completeInternal(PM_QUAN, 'IR-0082', { outcome: 'OUTSIDE_DOMAIN', result: 'legacy', domainResultAuditId: 9, expectedVersion: 1 } as never)).rejects.toMatchObject({ code: 'VALIDATION' })
    expect(http.command).not.toHaveBeenCalled()
  })

  it('giữ null cho các mã định danh tùy chọn bị thiếu thay vì tạo mã 0', async () => {
    const store = createSupportDemoStore()
    const http = transport()
    http.get.mockImplementation(async (path: string) => {
      if (path === '/api/platform/support/tickets/9') return {
        id: 9, code: 'TK-0009', subject: 'Cần hỗ trợ', category: 'OTHER', priority: 'NORMAL', status: 'IN_PROGRESS', farmId: null,
        requesterId: 17, requester: 'Chủ trại', assignedCsId: 4, assignedCs: 'CS', assignedCsAvailable: true,
        createdAt: '2026-11-01T08:00:00Z', updatedAt: '2026-11-01T09:00:00Z', version: 2, messages: [],
        resolutions: [], history: [], contextOptions: { PM: [], SA: [] }, internalRequests: [{
          id: 81, code: 'IR-0081', targetRole: 'PM', recipientId: 21, recipient: 'PM',
          ticketId: 9, ticketCode: 'TK-0009', farmName: 'Vấn đề tài khoản', from: 'CS', question: 'Kiểm tra',
          context: [], status: 'OPEN', version: 1,
        }],
      }
      if (path === '/api/platform/internal-requests') return [{
        id: 82, code: 'IR-0082', targetRole: 'PM', recipientId: 21, recipient: 'PM',
        ticketId: 9, ticketCode: 'TK-0009', farmId: null, farmName: 'Vấn đề tài khoản', from: 'CS', question: 'Kiểm tra',
        context: [], status: 'OPEN', version: 1,
      }]
      return {}
    })
    const api = createSupportApi({ mode: 'backend', farmId: 1, transport: http, store })

    await expect(api.getTicket(CS_ME, '9')).resolves.toMatchObject({
      farmId: null,
      internalRequests: [{ farmId: null, fromId: null }],
    })
    await expect(api.listAssigned(PM_QUAN)).resolves.toMatchObject([{ farmId: null, fromId: null }])
  })
})
