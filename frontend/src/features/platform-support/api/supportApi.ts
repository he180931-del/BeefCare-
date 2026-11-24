import { activeFarmId } from '../../../app/session/currentFarm'
import { backendMode, type BackendMode } from '../../../shared/config/runtime'
import { backendTransport, type BackendTransport } from '../../../shared/api/backendTransport'
import { asRecord, asRows, nullableNumber, numberValue, textValue } from '../../../shared/api/parse'
import type { SupportDemoStore } from '../data/supportDemoStore'
import type { Actor, CompleteCommand, ContextRef, CreateInternalCommand, QueueFilters, TargetRole, TicketCategory, TicketPriority } from '../types'
import { BackendError } from '../../../shared/api/backendClient'
import { SupportError } from '../domain/supportRules'
import type { FarmOption, HistoryEvent, InternalView, MessagePage, QueuePage, RecipientInternalView, StaffMember, SupportNotification, Ticket, TicketMessage, TicketRow } from '../types'
import { demo } from '../../../demo/demoModules'
import { lazyObject } from '../../../shared/lib/lazyObject'

const TARGET_OUTCOMES = new Set(['CONFIRMED', 'NOT_CONFIRMED', 'NEED_MORE_INFO', 'OUT_OF_SCOPE'])
const targetOutcome = (value: unknown): InternalView['outcome'] => {
  if (value == null) return undefined
  const outcome = textValue(value)
  if (!TARGET_OUTCOMES.has(outcome)) throw new SupportError('VALIDATION', `Kết quả không hợp lệ: ${outcome}.`)
  return outcome as InternalView['outcome']
}

const mapError = (error: unknown): never => {
  if (!(error instanceof BackendError)) throw error
  if (error.status === 404) throw new SupportError('NOT_FOUND', 'Không tìm thấy dữ liệu yêu cầu.')
  if (error.status === 403) throw new SupportError('FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này.')
  if (error.code === 'MSG-FE20-06') throw new SupportError('CONFLICT', 'Yêu cầu đã đóng và chỉ đọc.')
  if (error.status === 409) throw new SupportError('CONFLICT', 'Yêu cầu đã thay đổi. Vui lòng tải lại.')
  throw new SupportError('CONFLICT', error.message || 'Không lưu được dữ liệu. Vui lòng thử lại.')
}

const mapHistory = (value: unknown): HistoryEvent[] | undefined => value == null ? undefined : asRows(value).map((entry) => ({
  at: textValue(entry.at, textValue(entry.time)),
  actor: textValue(entry.actor, 'Hệ thống'),
  text: textValue(entry.note) || textValue(entry.type, textValue(entry.event, textValue(entry.state))),
}))

const requiredId = (value: unknown, field: string): number => {
  const id = numberValue(value)
  if (!Number.isInteger(id) || id < 1) throw new SupportError('CONFLICT', `Backend response thiếu ${field} hợp lệ.`)
  return id
}

const optionalId = (value: unknown, field: string): number | null => value == null ? null : requiredId(value, field)

const requiredActorId = (value: unknown): number => {
  const id = numberValue(value)
  if (!Number.isInteger(id) || id < 1) throw new SupportError('FORBIDDEN', 'Không xác định được người thao tác đã đăng nhập.')
  return id
}

const completionActor = (value: unknown): string | undefined => {
  const event = [...asRows(value)].reverse().find((entry: Record<string, unknown>) => textValue(entry.type, textValue(entry.event)).toUpperCase() === 'COMPLETED')
  const actor = event == null ? '' : textValue(event.actor)
  return actor || undefined
}

const mapInternal = (value: unknown): InternalView => {
  const row = asRecord(value)
  const status = textValue(row.status, 'OPEN') as InternalView['status']
  const role = textValue(row.targetRole, 'PM') as TargetRole
  const history = mapHistory(row.history)
  return {
    id: requiredId(row.id, 'internal request id'), code: textValue(row.code), title: textValue(row.requestText).slice(0, 80), ticketId: requiredId(row.ticketId, 'ticket id'),
    ticketCode: textValue(row.ticketCode), ticketSubject: textValue(row.ticketSubject, textValue(row.requestText).slice(0, 80)), ticketCategory: textValue(row.ticketCategory, 'OTHER') as TicketCategory, ticketRequester: textValue(row.ticketRequester, 'Chủ trại'), farmId: nullableNumber(row.farmId), farmName: textValue(row.farmName, 'Vấn đề tài khoản'), targetRole: role,
    recipientId: requiredId(row.recipientId, 'recipient id'), recipient: textValue(row.recipient), fromId: optionalId(row.fromId, 'sender id'), from: textValue(row.from, 'CS'), createdAt: textValue(row.createdAt),
    requestText: textValue(row.requestText),
    status, outcome: targetOutcome(row.outcome), resultNote: row.resultNote == null ? undefined : textValue(row.resultNote),
    completedAt: row.completedAt == null ? undefined : textValue(row.completedAt),
    completedBy: completionActor(row.history), version: numberValue(row.version), history,
    needsReassignment: row.needsReassignment === true,
  }
}

const mapRecipient = (value: unknown): RecipientInternalView => {
  const row = asRecord(value)
  const status = textValue(row.status, 'OPEN') as RecipientInternalView['status']
  const role = textValue(row.targetRole, 'PM') as TargetRole
  const history = mapHistory(row.history)
  return {
    id: requiredId(row.id, 'internal request id'), code: textValue(row.code), title: textValue(row.requestText).slice(0, 80), ticketId: requiredId(row.ticketId, 'ticket id'),
    ticketCode: textValue(row.ticketCode), ticketSubject: textValue(row.ticketSubject, textValue(row.requestText).slice(0, 80)), ticketCategory: textValue(row.ticketCategory, 'OTHER') as TicketCategory, ticketRequester: textValue(row.ticketRequester, 'Chủ trại'), farmId: nullableNumber(row.farmId), farmName: textValue(row.farmName, 'Vấn đề tài khoản'), targetRole: role,
    recipientId: requiredId(row.recipientId, 'recipient id'), recipient: textValue(row.recipient), fromId: optionalId(row.fromId, 'sender id'), from: textValue(row.from, 'CS'), createdAt: textValue(row.createdAt),
    requestText: textValue(row.requestText), status, outcome: targetOutcome(row.outcome),
    resultNote: row.resultNote == null ? undefined : textValue(row.resultNote), completedAt: row.completedAt == null ? undefined : textValue(row.completedAt), completedBy: completionActor(row.history),
    version: numberValue(row.version), history, needsReassignment: row.needsReassignment === true,
  }
}

const toRecipient = (view: InternalView): RecipientInternalView => view

const mapSupportNotification = (value: unknown): SupportNotification => {
  const row = asRecord(value)
  const targetType = textValue(row.targetType)
  const targetId = requiredId(row.targetId, 'notification target id')
  return {
    id: requiredId(row.id, 'notification id'), title: textValue(row.title), body: textValue(row.summary),
    at: textValue(row.createdTime), read: row.readTime != null, actionLabel: targetType === 'INTERNAL_REQUEST' ? 'Mở yêu cầu' : 'Mở yêu cầu hỗ trợ',
    ticketCode: String(targetId), targetType, targetId,
  }
}

const mapMessage = (value: unknown): TicketMessage => {
  const message = asRecord(value)
  return {
    id: requiredId(message.id, 'message id'),
    visibility: message.audience === 'CS_ONLY' ? 'INTERNAL' : 'PUBLIC',
    author: textValue(message.author, '—'),
    authorRole: message.authorRole === 'OWNER' ? 'OWNER' : 'CS',
    text: textValue(message.content),
    at: textValue(message.createdAt),
  }
}

const mapMessagePage = (value: unknown): MessagePage => {
  const row = asRecord(value)
  return {
    items: asRows(row.items).map(mapMessage),
    nextBeforeId: row.nextBeforeId == null ? null : requiredId(row.nextBeforeId, 'message cursor'),
    hasMore: row.hasMore === true,
  }
}

const mapTicket = (value: unknown): Ticket => {
  const row = asRecord(value)
  const context = (value: unknown) => asRows(value).map((c) => {
    const type = textValue(c.type); const id = requiredId(c.id, 'ticket context id')
    const fallback = type === 'FARM' ? `Trang trại #${id}` : type === 'SUBSCRIPTION' ? `Gói dịch vụ #${id}` : type === 'PAYMENT' ? `Thanh toán #${id}` : type === 'FINANCE_RECORD' ? `Khoản thu chi #${id}` : type === 'FINANCE_SNAPSHOT' ? `Bản chốt #${id}` : `Tài khoản #${id}`
    return { type, id, label: textValue(c.label, fallback) }
  })
  const assignedId = optionalId(row.assignedCsId, 'assigned CS id')
  const assignedAvailable = row.assignedCsAvailable !== false
  const messages = asRows(row.messages).map(mapMessage)
  return {
    id: requiredId(row.id, 'ticket id'), code: textValue(row.code), subject: textValue(row.subject), category: textValue(row.category) as Ticket['category'], priority: textValue(row.priority) as Ticket['priority'], status: textValue(row.status) as Ticket['status'],
    farmId: nullableNumber(row.farmId), farmName: textValue(row.farmName, 'Vấn đề tài khoản'), requesterId: requiredId(row.requesterId, 'requester id'), requester: textValue(row.requester), assignedCsId: assignedId, assignedCs: row.assignedCs == null ? null : textValue(row.assignedCs), assignedAvailable,
    createdAt: textValue(row.createdAt), updatedAt: textValue(row.updatedAt), version: numberValue(row.version), messages,
    messagesBeforeId: row.messagesBeforeId == null ? null : requiredId(row.messagesBeforeId, 'message cursor'), messagesHasMore: row.messagesHasMore === true,
    resolutions: asRows(row.resolutions).map((r) => ({ id: requiredId(r.id, 'resolution id'), version: numberValue(r.version), content: textValue(r.content), resolvedBy: textValue(r.resolvedBy), resolvedAt: textValue(r.resolvedAt), acknowledged: r.acknowledged === true, acknowledgedAt: r.acknowledgedAt == null ? undefined : textValue(r.acknowledgedAt), acknowledgmentComment: r.acknowledgmentComment == null ? undefined : textValue(r.acknowledgmentComment), reviewed: r.reviewed === true })),
    history: mapHistory(row.history),
    internalRequests: asRows(row.internalRequests).map(mapInternal), contextOptions: {
      PM: context(asRecord(row.contextOptions).PM),
      SA: context(asRecord(row.contextOptions).SA),
    },
  }
}

function createBackendApi(transport: BackendTransport) {
  const run = async <T>(operation: () => Promise<T>): Promise<T> => { try { return await operation() } catch (error) { return mapError(error) } }
  const resolveId = async (code: string): Promise<number> => {
    if (/^\d+$/.test(code)) return requiredId(Number(code), 'ticket id')
    const page = asRecord(await transport.get(`/api/platform/support/tickets?q=${encodeURIComponent(code)}&page=0&size=100`))
    const row = asRows(page.items).find((item) => textValue(item.code) === code)
    if (!row) throw new BackendError(404, { message: `Không tìm thấy ticket ${code}` })
    return requiredId(row.id, 'ticket id')
  }
  const resolveInternalId = async (code: string): Promise<number> => {
    if (/^\d+$/.test(code)) return requiredId(Number(code), 'internal request id')
    const rows = asRows(await transport.get('/api/platform/internal-requests'))
    const row = rows.find((item) => textValue(item.code) === code)
    if (!row) throw new BackendError(404, { message: `Không tìm thấy yêu cầu ${code}` })
    return requiredId(row.id, 'internal request id')
  }
  const ticket = (code: string) => resolveId(code).then((id) => `/api/platform/support/tickets/${id}`)
  const get = async (code: string) => mapTicket(await transport.get(await ticket(code)))
  const command = async (code: string, body: Record<string, unknown>) => mapTicket(await transport.command(`${await ticket(code)}/processing`, body))
  return {
    listQueue: (actor: Actor, filters: QueueFilters = {}) => run(async () => {
      void actor; const p = new URLSearchParams(); if (filters.q) p.set('q', filters.q); if (filters.category && filters.category !== 'all') p.set('category', filters.category); if (filters.priority && filters.priority !== 'all') p.set('priority', filters.priority); if (filters.farm && filters.farm !== 'all' && /^\d+$/.test(filters.farm)) p.set('farmId', filters.farm); if (filters.assignment === 'unassigned' || filters.assignment === 'unavailable') p.set('assignment', filters.assignment === 'unassigned' ? 'UNASSIGNED' : 'UNAVAILABLE'); if (filters.tab) p.set('tab', filters.tab.toUpperCase()); p.set('page', String(Math.max(0, (filters.page ?? 1) - 1))); p.set('size', String(filters.size ?? 50));
      const page = asRecord(await transport.get(`/api/platform/support/tickets?${p}`)); const counts = asRecord(page.counts); const items = asRows(page.items).map(mapTicket).map((t): TicketRow => ({ id: t.id, version: t.version, code: t.code, subject: t.subject, category: t.category, priority: t.priority, status: t.status, farmName: t.farmName, requester: t.requester, assignedCsId: t.assignedCsId, assignedCs: t.assignedCs, assignedAvailable: t.assignedAvailable, createdAt: t.createdAt, updatedAt: t.updatedAt }));
      const result: QueuePage = { items, total: numberValue(page.total), page: numberValue(page.page) + 1, size: numberValue(page.size, filters.size ?? 50), counts: { all: numberValue(counts.ALL), unassigned: numberValue(counts.UNASSIGNED), mine: numberValue(counts.MINE), waiting: numberValue(counts.WAITING), resolved: numberValue(counts.RESOLVED), unassignedHigh: 0 } }; return result
    }),
    listFarms: () => run(async () => { const p = asRecord(await transport.get('/api/platform/support/tickets?page=0&size=100')); return [...new Map(asRows(p.items).filter((item) => item.farmId != null).map((item) => { const id = requiredId(item.farmId, 'farm id'); return [id, { id, name: textValue(item.farmName) }] })).values()].sort((a, b) => a.name.localeCompare(b.name)) as FarmOption[] }),
    listCs: () => run(async () => asRows(await transport.get('/api/platform/support/recipients?role=CS')).map((row): StaffMember => ({ id: requiredId(row.id, 'recipient id'), name: textValue(row.name), role: 'CS', available: true }))),
    listRecipients: (role: TargetRole) => run(async () => asRows(await transport.get(`/api/platform/support/recipients?role=${role}`)).map((row): StaffMember => ({ id: requiredId(row.id, 'recipient id'), name: textValue(row.name), role, available: true }))),
    getTicket: (_actor: Actor, code: string) => run(() => get(code)),
    getMessages: (_actor: Actor, code: string, beforeId: number, size = 20) => run(async () => mapMessagePage(await transport.get(`${await ticket(code)}/messages?beforeId=${requiredId(beforeId, 'message cursor')}&size=${size}`))),
    claim: (_actor: Actor, code: string, cmd: { reason?: string; expectedVersion: number }) => run(() => command(code, { action: 'CLAIM', reason: cmd.reason ?? null, expectedVersion: cmd.expectedVersion })),
    handOver: (_actor: Actor, code: string, cmd: { toCsId: number; reason: string; expectedVersion?: number }) => run(() => command(code, { action: 'HANDOVER', recipientId: requiredId(cmd.toCsId, 'recipient id'), reason: cmd.reason, expectedVersion: cmd.expectedVersion })),
    reply: (_actor: Actor, code: string, cmd: { text: string; expectedVersion?: number }) => run(async () => mapTicket(await transport.command(`${await ticket(code)}/replies`, { content: cmd.text, expectedVersion: cmd.expectedVersion }))),
    addNote: (_actor: Actor, code: string, cmd: { text: string; expectedVersion?: number }) => run(async () => mapTicket(await transport.command(`${await ticket(code)}/internal-notes`, { content: cmd.text, expectedVersion: cmd.expectedVersion }))),
    askCustomer: (_actor: Actor, code: string, cmd: { question: string; expectedVersion?: number }) => run(() => command(code, { action: 'ASK_CUSTOMER', question: cmd.question, expectedVersion: cmd.expectedVersion })),
    returnToQueue: (_actor: Actor, code: string, cmd: { reason: string; expectedVersion?: number }) => run(() => command(code, { action: 'RELEASE', reason: cmd.reason, expectedVersion: cmd.expectedVersion })),
    classify: (_actor: Actor, code: string, cmd: { category?: TicketCategory; priority?: TicketPriority; expectedVersion?: number }) => run(() => command(code, { action: 'CLASSIFY', category: cmd.category, priority: cmd.priority, expectedVersion: cmd.expectedVersion })),
    resolve: (_actor: Actor, code: string, cmd: { content: string; expectedVersion?: number }) => run(async () => mapTicket(await transport.command(`${await ticket(code)}/resolutions`, { content: cmd.content, expectedVersion: cmd.expectedVersion }))),
    close: (_actor: Actor, code: string, cmd: { reviewed: boolean; note?: string; expectedVersion?: number }) => run(async () => mapTicket(await transport.command(`${await ticket(code)}/close`, { reviewedAcknowledgment: cmd.reviewed, note: cmd.note, expectedVersion: cmd.expectedVersion }))),
    createInternal: async (_actor: Actor, code: string, cmd: CreateInternalCommand) => run(async () => {
      const requestText = cmd.requestText.trim()
      if (!requestText) throw new SupportError('VALIDATION', 'Nội dung yêu cầu là bắt buộc.')
      const t = await get(code)
      return mapInternal(await transport.command(`${await ticket(code)}/internal-requests`, { targetRole: cmd.targetRole, recipientId: requiredId(cmd.recipientId, 'recipient id'), requestText, ticketVersion: t.version }))
    }),
    manageInternal: async (_actor: Actor, code: string, irCode: string, cmd: { action: 'REASSIGN' | 'CANCEL' | 'CLARIFY'; recipientId?: number; reason?: string; clarificationText?: string }) => run(async () => { const t = await get(code); const ir = t.internalRequests.find((r) => r.code === irCode); if (!ir) throw new BackendError(404, { message: 'Không tìm thấy yêu cầu nội bộ' }); const recipientId = cmd.recipientId == null ? undefined : requiredId(cmd.recipientId, 'recipient id'); return mapInternal(await transport.command(`/api/platform/support/tickets/${t.id}/internal-requests/${ir.id}/management`, { action: cmd.action, recipientId, reason: cmd.reason, clarificationText: cmd.clarificationText, expectedVersion: ir.version })) }),
    listNotifications: () => run(async () => asRows(await transport.get('/api/notifications/mine')).filter((row) => textValue(row.category).toUpperCase() === 'SUPPORT').map(mapSupportNotification)),
    markNotificationRead: (id: number) => run(async () => { await transport.command(`/api/notifications/${requiredId(id, 'notification id')}/read`, undefined, { method: 'PUT' }); return undefined }),
    markAllNotificationsRead: () => run(async () => {
      const rows = asRows(await transport.get('/api/notifications/mine')).filter((row) => textValue(row.category).toUpperCase() === 'SUPPORT' && row.readTime == null)
      await Promise.all(rows.map((row) => transport.command(`/api/notifications/${requiredId(row.id, 'notification id')}/read`, undefined, { method: 'PUT' })))
      return rows.length
    }),
    listAssigned: (_actor: Actor) => run(async () => asRows(await transport.get('/api/platform/internal-requests')).map(mapRecipient)),
    getAssigned: async (_actor: Actor, code: string) => run(async () => mapRecipient(await transport.get(`/api/platform/internal-requests/${await resolveInternalId(code)}`))),
    completeInternal: async (_actor: Actor, code: string, cmd: CompleteCommand) => run(async () => {
      if (!TARGET_OUTCOMES.has(cmd.outcome)) throw new SupportError('VALIDATION', `Kết quả không hợp lệ: ${String(cmd.outcome)}.`)
      return mapRecipient(await transport.command(`/api/platform/internal-requests/${await resolveInternalId(code)}/completion`, { outcome: cmd.outcome, resultNote: cmd.resultNote, expectedVersion: cmd.expectedVersion }))
    }),
  }
}

export function createSupportApi({ mode, farmId, transport, store }: { mode: BackendMode; farmId: string | number | null; transport: BackendTransport; store: SupportDemoStore }) {
  // Kept for the later backend hookup; backend mode must never read the mock.
  void farmId
  void transport
  const backend = createBackendApi(transport)
  return {
    /** Người thao tác của phiên; mọi chế độ đều phải có định danh tài khoản hợp lệ. */
    actorFor(session: { id?: number; fullName: string; role?: string } | null | undefined): Actor {
      const role: Actor['role'] = session?.role === 'PM' || session?.role === 'SA' ? session.role : 'CS'
      const id = requiredActorId(session?.id)
      if (mode === 'backend') return { id, name: session?.fullName ?? '', role }
      const fallback = store.actorForRole(session?.role)
      return { ...fallback, id, name: session?.fullName ?? fallback.name }
    },
    // GET /api/platform/support/tickets (?q,category,tab,farmId,priority,assignment,page,size)
    async listQueue(actor: Actor, filters: QueueFilters = {}) { return mode === 'backend' ? backend.listQueue(actor, filters) : store.listQueue(actor, filters) },
    // chưa có API (danh sách trại cho bộ lọc; lấy từ trường farmName của ticket)
    async listFarms() { return mode === 'backend' ? backend.listFarms() : store.listFarms() },
    // chưa có API (danh sách CS; GET /api/platform/support/recipients chỉ nhận role PM/SA/CS)
    async listCs() { return mode === 'backend' ? backend.listCs() : store.listCs() },
    // GET /api/platform/support/recipients?role=
    async listRecipients(role: TargetRole) { return mode === 'backend' ? backend.listRecipients(role) : store.listRecipients(role) },
    // GET /api/platform/support/tickets/{id}
    async getTicket(actor: Actor, code: string) { return mode === 'backend' ? backend.getTicket(actor, code) : store.getTicket(actor, code) },
    // GET /api/platform/support/tickets/{id}/messages (?beforeId,size)
    async getMessages(actor: Actor, code: string, beforeId: number, size = 20) { return mode === 'backend' ? backend.getMessages(actor, code, beforeId, size) : store.getMessages(actor, code, beforeId, size) },
    // POST /api/platform/support/tickets/{id}/processing  (action: CLAIM)
    async claim(actor: Actor, code: string, cmd: { reason?: string; expectedVersion: number }) { return mode === 'backend' ? backend.claim(actor, code, cmd) : store.claim(actor, code, cmd) },
    // POST /api/platform/support/tickets/{id}/processing  (action: HANDOVER, recipientId, reason)
    async handOver(actor: Actor, code: string, cmd: { toCsId: number; reason: string; expectedVersion?: number }) { return mode === 'backend' ? backend.handOver(actor, code, cmd) : store.handOver(actor, code, cmd) },
    // POST /api/platform/support/tickets/{id}/replies
    async reply(actor: Actor, code: string, cmd: { text: string; expectedVersion?: number }) { return mode === 'backend' ? backend.reply(actor, code, cmd) : store.reply(actor, code, cmd) },
    // POST /api/platform/support/tickets/{id}/internal-notes
    async addNote(actor: Actor, code: string, cmd: { text: string; expectedVersion?: number }) { return mode === 'backend' ? backend.addNote(actor, code, cmd) : store.addNote(actor, code, cmd) },
    // POST /api/platform/support/tickets/{id}/processing  (action: ASK_CUSTOMER, question)
    async askCustomer(actor: Actor, code: string, cmd: { question: string; expectedVersion?: number }) { return mode === 'backend' ? backend.askCustomer(actor, code, cmd) : store.askCustomer(actor, code, cmd) },
    // POST /api/platform/support/tickets/{id}/processing  (action: RETURN_TO_QUEUE, reason)
    async returnToQueue(actor: Actor, code: string, cmd: { reason: string; expectedVersion?: number }) { return mode === 'backend' ? backend.returnToQueue(actor, code, cmd) : store.returnToQueue(actor, code, cmd) },
    // POST /api/platform/support/tickets/{id}/processing  (category, priority)
    async classify(actor: Actor, code: string, cmd: { category?: TicketCategory; priority?: TicketPriority; expectedVersion?: number }) { return mode === 'backend' ? backend.classify(actor, code, cmd) : store.classify(actor, code, cmd) },
    // POST /api/platform/support/tickets/{id}/resolutions
    async resolve(actor: Actor, code: string, cmd: { content: string; expectedVersion?: number }) { return mode === 'backend' ? backend.resolve(actor, code, cmd) : store.resolve(actor, code, cmd) },
    // POST /api/platform/support/tickets/{id}/close
    async close(actor: Actor, code: string, cmd: { reviewed: boolean; note?: string; expectedVersion?: number }) { return mode === 'backend' ? backend.close(actor, code, cmd) : store.close(actor, code, cmd) },
    // POST /api/platform/support/tickets/{id}/internal-requests
    async createInternal(actor: Actor, code: string, cmd: CreateInternalCommand) { return mode === 'backend' ? backend.createInternal(actor, code, cmd) : store.createInternal(actor, code, cmd) },
    // POST /api/platform/support/tickets/{ticketId}/internal-requests/{id}/management
    async manageInternal(actor: Actor, code: string, irCode: string, cmd: { action: 'REASSIGN' | 'CANCEL' | 'CLARIFY'; recipientId?: number; reason?: string; clarificationText?: string }) { return mode === 'backend' ? backend.manageInternal(actor, code, irCode, cmd) : store.manageInternal(actor, code, irCode, cmd) },
    // GET /api/notifications/mine (lọc category SUPPORT ở client)
    async listNotifications() { return mode === 'backend' ? backend.listNotifications() : store.listNotifications() },
    // PUT /api/notifications/{id}/read
    async markNotificationRead(id: number) { return mode === 'backend' ? backend.markNotificationRead(id) : store.markNotificationRead(id) },
    // PUT /api/notifications/{id}/read cho các thông báo hỗ trợ chưa đọc
    async markAllNotificationsRead() { return mode === 'backend' ? backend.markAllNotificationsRead() : store.markAllNotificationsRead() },
    // GET /api/platform/internal-requests?state=
    async listAssigned(actor: Actor) { return mode === 'backend' ? backend.listAssigned(actor) : store.listAssigned(actor).then((rows) => rows.map(toRecipient)) },
    // GET /api/platform/internal-requests/{id}
    async getAssigned(actor: Actor, code: string) { return mode === 'backend' ? backend.getAssigned(actor, code) : store.getAssigned(actor, code).then(toRecipient) },
    // POST /api/platform/internal-requests/{id}/completion
    async completeInternal(actor: Actor, code: string, cmd: CompleteCommand) { return mode === 'backend' ? backend.completeInternal(actor, code, cmd) : store.completeInternal(actor, code, cmd).then(toRecipient) },
  }
}
export type SupportApi = ReturnType<typeof createSupportApi>
export const supportApi = createSupportApi({ mode: backendMode, farmId: activeFarmId, transport: backendTransport, store: lazyObject(() => demo.platformSupport.supportDemoStore) })
