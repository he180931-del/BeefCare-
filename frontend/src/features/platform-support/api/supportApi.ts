import { backendFarmId, backendMode, backendTransport, asRecord, asRows, numberValue, textValue, type BackendMode, type BackendTransport } from '../../../api/backendTransport'
import { supportDemoStore, type SupportDemoStore } from '../data/supportDemoStore'
import type { Actor, CompleteCommand, ContextRef, QueueFilters, TargetRole, TicketCategory, TicketPriority } from '../types'
import { BackendError } from '../../../api/backendClient'
import { SupportError } from '../domain/supportRules'
import type { InternalView, QueuePage, StaffMember, Ticket, TicketRow } from '../types'

const mapError = (error: unknown): never => {
  if (!(error instanceof BackendError)) throw error
  if (error.status === 404) throw new SupportError('NOT_FOUND', 'Không tìm thấy dữ liệu yêu cầu.')
  if (error.status === 403) throw new SupportError('FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này.')
  if (error.code === 'MSG-FE20-06') throw new SupportError('CONFLICT', 'Ticket đã đóng và chỉ đọc.')
  if (error.status === 409) throw new SupportError('CONFLICT', 'Ticket đã thay đổi. Vui lòng tải lại.')
  throw new SupportError('CONFLICT', error.message || 'Không lưu được dữ liệu. Vui lòng thử lại.')
}

const mapInternal = (value: unknown): InternalView => {
  const row = asRecord(value)
  const status = textValue(row.status, 'OPEN') as InternalView['status']
  const role = textValue(row.targetRole, 'PM') as TargetRole
  return {
    id: numberValue(row.id), code: textValue(row.code), title: textValue(row.question).slice(0, 80), ticketId: numberValue(row.ticketId),
    ticketCode: textValue(row.ticketCode), farmId: numberValue(row.farmId), farmName: textValue(row.farmName, 'Vấn đề tài khoản'), targetRole: role,
    recipientId: numberValue(row.recipientId), recipient: textValue(row.recipient), fromId: 0, from: textValue(row.from, 'CS'), createdAt: textValue(row.createdAt),
    question: textValue(row.question), context: asRows(row.context).map((item) => ({ type: textValue(item.type), id: numberValue(item.id), label: textValue(item.label, `${textValue(item.type)} #${numberValue(item.id)}`) })),
    status, outcome: row.outcome == null ? undefined : textValue(row.outcome) as InternalView['outcome'], result: row.result == null ? undefined : textValue(row.result),
    domainResultAuditId: row.domainResultAuditId == null ? undefined : numberValue(row.domainResultAuditId), completedAt: row.completedAt == null ? undefined : textValue(row.completedAt),
    version: numberValue(row.version), history: [],
  }
}

const mapTicket = (value: unknown): Ticket => {
  const row = asRecord(value)
  const assignedId = row.assignedCsId == null ? null : numberValue(row.assignedCsId)
  const assignedAvailable = row.assignedCsAvailable !== false
  const messages = asRows(row.messages).map((message) => ({ id: numberValue(message.id), visibility: message.audience === 'CS_ONLY' ? 'INTERNAL' as const : 'PUBLIC' as const, author: textValue(message.author, '—'), authorRole: message.authorRole === 'OWNER' ? 'OWNER' as const : 'CS' as const, text: textValue(message.content), at: textValue(message.createdAt) }))
  return {
    id: numberValue(row.id), code: textValue(row.code), subject: textValue(row.subject), category: textValue(row.category) as Ticket['category'], priority: textValue(row.priority) as Ticket['priority'], status: textValue(row.status) as Ticket['status'],
    farmId: row.farmId == null ? 0 : numberValue(row.farmId), farmName: textValue(row.farmName, 'Vấn đề tài khoản'), requesterId: numberValue(row.requesterId), requester: textValue(row.requester), assignedCsId: assignedId, assignedCs: row.assignedCs == null ? null : textValue(row.assignedCs), assignedAvailable,
    createdAt: textValue(row.createdAt), updatedAt: textValue(row.updatedAt), version: numberValue(row.version), messages,
    resolutions: asRows(row.resolutions).map((r) => ({ id: numberValue(r.id), version: numberValue(r.version), content: textValue(r.content), resolvedBy: textValue(r.resolvedBy), resolvedAt: textValue(r.resolvedAt), acknowledged: r.acknowledged === true, acknowledgedAt: r.acknowledgedAt == null ? undefined : textValue(r.acknowledgedAt), acknowledgmentComment: r.acknowledgmentComment == null ? undefined : textValue(r.acknowledgmentComment), reviewed: r.reviewed === true })),
    history: asRows(row.history).map((h) => ({ at: textValue(h.time), actor: textValue(h.actor, 'Hệ thống'), text: textValue(h.event, textValue(h.status)) })),
    internalRequests: asRows(row.internalRequests).map(mapInternal), contextOptions: { PM: [], SA: [] },
  }
}

function createBackendApi(transport: BackendTransport) {
  const run = async <T>(operation: () => Promise<T>): Promise<T> => { try { return await operation() } catch (error) { return mapError(error) } }
  const resolveId = async (code: string): Promise<number> => {
    if (/^\d+$/.test(code)) return Number(code)
    const page = asRecord(await transport.get(`/api/platform/support/tickets?q=${encodeURIComponent(code)}&page=0&size=100`))
    const row = asRows(page.items).find((item) => textValue(item.code) === code)
    if (!row) throw new BackendError(404, { message: `Không tìm thấy ticket ${code}` })
    return numberValue(row.id)
  }
  const ticket = (code: string) => resolveId(code).then((id) => `/api/platform/support/tickets/${id}`)
  const get = async (code: string) => mapTicket(await transport.get(await ticket(code)))
  const command = async (code: string, body: Record<string, unknown>) => mapTicket(await transport.command(`${await ticket(code)}/processing`, body))
  return {
    listQueue: (actor: Actor, filters: QueueFilters = {}) => run(async () => {
      void actor; const p = new URLSearchParams(); if (filters.q) p.set('q', filters.q); if (filters.category && filters.category !== 'all') p.set('category', filters.category); if (filters.priority && filters.priority !== 'all') p.set('priority', filters.priority); if (filters.farm && filters.farm !== 'all' && /^\d+$/.test(filters.farm)) p.set('farmId', filters.farm); if (filters.assignment && filters.assignment !== 'all') p.set('assignment', filters.assignment === 'unassigned' ? 'UNASSIGNED' : filters.assignment === 'unavailable' ? 'UNAVAILABLE' : 'MINE'); if (filters.tab) p.set('tab', filters.tab.toUpperCase()); p.set('page', String(Math.max(0, (filters.page ?? 1) - 1))); p.set('size', String(filters.size ?? 25));
      const page = asRecord(await transport.get(`/api/platform/support/tickets?${p}`)); const counts = asRecord(page.counts); const items = asRows(page.items).map(mapTicket).map((t): TicketRow => ({ id: t.id, code: t.code, subject: t.subject, category: t.category, priority: t.priority, status: t.status, farmName: t.farmName, requester: t.requester, assignedCsId: t.assignedCsId, assignedCs: t.assignedCs, assignedAvailable: t.assignedAvailable, createdAt: t.createdAt, updatedAt: t.updatedAt }));
      const result: QueuePage = { items, total: numberValue(page.total), page: numberValue(page.page) + 1, size: numberValue(page.size, filters.size ?? 25), counts: { all: numberValue(counts.ALL), unassigned: numberValue(counts.UNASSIGNED), mine: numberValue(counts.MINE), waiting: numberValue(counts.WAITING), resolved: numberValue(counts.RESOLVED), unassignedHigh: 0 } }; return result
    }),
    listFarms: () => run(async () => { const p = asRecord(await transport.get('/api/platform/support/tickets?page=0&size=100')); return [...new Set(asRows(p.items).map((item) => textValue(item.farmName)).filter(Boolean))].sort() }),
    listCs: () => run(async () => asRows(await transport.get('/api/platform/support/recipients?role=CS')).map((row): StaffMember => ({ id: numberValue(row.id), name: textValue(row.name), role: 'CS', available: true }))),
    listRecipients: (role: TargetRole) => run(async () => asRows(await transport.get(`/api/platform/support/recipients?role=${role}`)).map((row): StaffMember => ({ id: numberValue(row.id), name: textValue(row.name), role, available: true }))),
    getTicket: (_actor: Actor, code: string) => run(() => get(code)),
    claim: (_actor: Actor, code: string, cmd: { reason?: string; expectedVersion?: number }) => run(() => command(code, { action: 'CLAIM', reason: cmd.reason ?? null, expectedVersion: cmd.expectedVersion })),
    handOver: (_actor: Actor, code: string, cmd: { toCsId: number; reason: string; expectedVersion?: number }) => run(() => command(code, { action: 'HANDOVER', recipientId: cmd.toCsId, reason: cmd.reason, expectedVersion: cmd.expectedVersion })),
    reply: (_actor: Actor, code: string, cmd: { text: string; expectedVersion?: number }) => run(async () => mapTicket(await transport.command(`${await ticket(code)}/replies`, { content: cmd.text, expectedVersion: cmd.expectedVersion }))),
    addNote: (_actor: Actor, code: string, cmd: { text: string; expectedVersion?: number }) => run(async () => mapTicket(await transport.command(`${await ticket(code)}/internal-notes`, { content: cmd.text, expectedVersion: cmd.expectedVersion }))),
    askCustomer: (_actor: Actor, code: string, cmd: { question: string; expectedVersion?: number }) => run(() => command(code, { action: 'ASK_CUSTOMER', question: cmd.question, expectedVersion: cmd.expectedVersion })),
    returnToQueue: (_actor: Actor, code: string, cmd: { reason: string; expectedVersion?: number }) => run(() => command(code, { action: 'RELEASE', reason: cmd.reason, expectedVersion: cmd.expectedVersion })),
    classify: (_actor: Actor, code: string, cmd: { category?: TicketCategory; priority?: TicketPriority; expectedVersion?: number }) => run(() => command(code, { action: 'CLASSIFY', category: cmd.category, priority: cmd.priority, expectedVersion: cmd.expectedVersion })),
    resolve: (_actor: Actor, code: string, cmd: { content: string; expectedVersion?: number }) => run(async () => mapTicket(await transport.command(`${await ticket(code)}/resolutions`, { content: cmd.content, expectedVersion: cmd.expectedVersion }))),
    close: (_actor: Actor, code: string, cmd: { reviewed: boolean; note?: string; expectedVersion?: number }) => run(async () => mapTicket(await transport.command(`${await ticket(code)}/close`, { reviewedAcknowledgment: cmd.reviewed, note: cmd.note, expectedVersion: cmd.expectedVersion }))),
    createInternal: async (_actor: Actor, code: string, cmd: { targetRole: TargetRole; recipientId: number; question: string; context?: ContextRef[] }) => run(async () => { const t = await get(code); return mapInternal(await transport.command(`${await ticket(code)}/internal-requests`, { targetRole: cmd.targetRole, recipientId: cmd.recipientId, question: cmd.question, context: cmd.context?.map(({ type, id }) => ({ type, id })) ?? [], ticketVersion: t.version })) }),
    manageInternal: async (_actor: Actor, code: string, irCode: string, cmd: { action: 'REASSIGN' | 'CANCEL'; recipientId?: number; reason: string }) => run(async () => { const t = await get(code); const ir = t.internalRequests.find((r) => r.code === irCode); if (!ir) throw new BackendError(404, { message: 'Không tìm thấy yêu cầu nội bộ' }); return mapInternal(await transport.command(`/api/platform/support/tickets/${t.id}/internal-requests/${ir.id}/management`, { action: cmd.action, recipientId: cmd.recipientId, reason: cmd.reason, expectedVersion: ir.version })) }),
    listAssigned: (_actor: Actor) => run(async () => (asRows(await transport.get('/api/platform/internal-requests?state=OPEN')).map(mapInternal))),
    getAssigned: async (_actor: Actor, code: string) => run(async () => mapInternal(await transport.get(`/api/platform/internal-requests/${await resolveId(code)}`))),
    listDomainResults: async (_actor: Actor, code: string) => run(async () => asRows(await transport.get(`/api/platform/internal-requests/${await resolveId(code)}/domain-results`)).map((row) => ({ id: numberValue(row.auditId), label: `${textValue(row.action)} · ${textValue(row.targetType)} #${numberValue(row.targetId)}` }))),
    completeInternal: async (_actor: Actor, code: string, cmd: CompleteCommand) => run(async () => mapInternal(await transport.command(`/api/platform/internal-requests/${await resolveId(code)}/completion`, { outcome: cmd.outcome, result: cmd.result, domainResultAuditId: cmd.domainResultAuditId, expectedVersion: cmd.expectedVersion }))),
  }
}

export function createSupportApi({ mode, farmId, transport, store }: { mode: BackendMode; farmId: string | number; transport: BackendTransport; store: SupportDemoStore }) {
  // Kept for the later backend hookup; backend mode must never read the mock.
  void farmId
  void transport
  const backend = createBackendApi(transport)
  const requireLocal = () => { if (mode === 'backend') throw backendPending('hỗ trợ khách hàng') }
  return {
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
    // POST /api/platform/support/tickets/{id}/processing  (action: CLAIM)
    async claim(actor: Actor, code: string, cmd: { reason?: string; expectedVersion?: number }) { return mode === 'backend' ? backend.claim(actor, code, cmd) : store.claim(actor, code, cmd) },
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
    async createInternal(actor: Actor, code: string, cmd: { targetRole: TargetRole; recipientId: number; question: string; context?: ContextRef[] }) { return mode === 'backend' ? backend.createInternal(actor, code, cmd) : store.createInternal(actor, code, cmd) },
    // POST /api/platform/support/tickets/{ticketId}/internal-requests/{id}/management
    async manageInternal(actor: Actor, code: string, irCode: string, cmd: { action: 'REASSIGN' | 'CANCEL'; recipientId?: number; reason: string }) { return mode === 'backend' ? backend.manageInternal(actor, code, irCode, cmd) : store.manageInternal(actor, code, irCode, cmd) },
    // chưa có API (thông báo hỗ trợ của CS)
    async listNotifications() { requireLocal(); return store.listNotifications() },
    // chưa có API
    async markNotificationRead(id: number) { requireLocal(); return store.markNotificationRead(id) },
    // chưa có API
    async markAllNotificationsRead() { requireLocal(); return store.markAllNotificationsRead() },
    // GET /api/platform/internal-requests?state=
    async listAssigned(actor: Actor) { return mode === 'backend' ? backend.listAssigned(actor) : store.listAssigned(actor) },
    // GET /api/platform/internal-requests/{id}
    async getAssigned(actor: Actor, code: string) { return mode === 'backend' ? backend.getAssigned(actor, code) : store.getAssigned(actor, code) },
    // GET /api/platform/internal-requests/{id}/domain-results
    async listDomainResults(actor: Actor, code: string) { return mode === 'backend' ? backend.listDomainResults(actor, code) : store.listDomainResults(actor, code) },
    // POST /api/platform/internal-requests/{id}/completion
    async completeInternal(actor: Actor, code: string, cmd: CompleteCommand) { return mode === 'backend' ? backend.completeInternal(actor, code, cmd) : store.completeInternal(actor, code, cmd) },
  }
}
export type SupportApi = ReturnType<typeof createSupportApi>
export const supportApi = createSupportApi({ mode: backendMode, farmId: backendFarmId, transport: backendTransport, store: supportDemoStore })
