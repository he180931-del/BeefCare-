import { backendFarmId, backendMode, backendTransport, asRecord, asRows, numberValue, textValue, type BackendMode, type BackendTransport } from '../../../api/backendTransport'
import { BackendError } from '../../../api/backendClient'
import { supportDemoStore, type SupportDemoStore } from '../data/supportDemoStore'
import type { AcknowledgeCommand, CreateTicketCommand, ReopenCommand, ReplyCommand, TicketFilters } from '../types'
import type { OwnedFarm, Ticket, TicketPage } from '../types'
import { MESSAGES, SupportError } from '../domain/supportError'

const mapError = (error: unknown): never => {
  if (!(error instanceof BackendError)) throw error
  const code = error.code ?? ''
  const fields = Object.fromEntries([
    ...error.fieldErrors.map((item) => [item.field, item.message] as const),
    ...error.violations.flatMap((item) => item.propertyPath ? [[item.propertyPath, item.message ?? error.message] as const] : []),
  ])
  const supportCode = error.status === 404 ? 'NOT_FOUND' : error.status === 403 ? 'FORBIDDEN'
    : code === 'MSG-FE20-06' ? 'CLOSED' : code === 'MSG-FE20-05' ? 'RESULT_CHANGED'
      : error.status === 409 ? 'STATE_CHANGED' : Object.keys(fields).length || error.status === 400 ? 'VALIDATION' : null
  if (supportCode) throw new SupportError(supportCode, error.message || MESSAGES.saveFailed, fields)
  throw error
}

const mapMessage = (value: Record<string, unknown>) => ({
  code: textValue(value.type, 'MESSAGE'), params: {}, text: textValue(value.content),
  kind: (textValue(value.type, 'REPLY') as 'DESCRIPTION' | 'REPLY' | 'ACKNOWLEDGMENT' | 'REOPEN'),
  author: textValue(value.author, '—'), authorRole: value.authorRole === 'OWNER' ? 'OWNER' as const : 'CS' as const,
  createdAt: textValue(value.createdAt),
})

const mapTicket = (value: unknown): Ticket => {
  const row = asRecord(value)
  const farmId = row.farmId == null ? null : numberValue(row.farmId)
  return {
    id: numberValue(row.id), code: textValue(row.code), subject: textValue(row.subject),
    category: textValue(row.category) as Ticket['category'], priority: textValue(row.priority) as Ticket['priority'],
    status: textValue(row.status) as Ticket['status'], scope: farmId == null ? 'ACCOUNT' : 'FARM', farmId,
    farmName: row.farmName == null ? null : textValue(row.farmName), requesterId: numberValue(row.requesterId),
    requester: textValue(row.requester), assignedCsId: row.assignedCsId == null ? null : numberValue(row.assignedCsId),
    assignedCs: row.assignedCs == null ? null : textValue(row.assignedCs), createdAt: textValue(row.createdAt),
    updatedAt: textValue(row.updatedAt), version: numberValue(row.version),
    messages: asRows(row.messages).map(mapMessage),
    resolutions: asRows(row.resolutions).map((resolution) => ({
      id: numberValue(resolution.id), version: numberValue(resolution.version), content: textValue(resolution.content),
      resolvedBy: textValue(resolution.resolvedBy), resolvedAt: textValue(resolution.resolvedAt),
      acknowledged: resolution.acknowledged === true, acknowledgedAt: resolution.acknowledgedAt == null ? null : textValue(resolution.acknowledgedAt),
      acknowledgmentComment: resolution.acknowledgmentComment == null ? null : textValue(resolution.acknowledgmentComment), reviewed: resolution.reviewed === true,
    })),
    history: asRows(row.history).map((event) => ({ at: textValue(event.time), event: textValue(event.event, 'CREATED') as Ticket['history'][number]['event'], status: textValue(event.status) as Ticket['status'], actor: textValue(event.actor, 'Hệ thống'), reason: textValue(event.reason) || undefined })),
  }
}

function createBackendApi(transport: BackendTransport) {
  const run = async <T>(operation: () => Promise<T>): Promise<T> => { try { return await operation() } catch (error) { return mapError(error) } }
  return {
    listOwnedFarms: () => run(async () => asRows(await transport.get('/api/farms')).map((farm): OwnedFarm => ({ id: numberValue(farm.id), name: textValue(farm.name) }))),
    listTickets: (filters = {}) => run(async () => {
      const params = new URLSearchParams()
      if (filters.q) params.set('q', filters.q)
      if (filters.category) params.set('category', filters.category)
      if (filters.tab) params.set('tab', filters.tab)
      if (filters.from) params.set('from', `${filters.from}T00:00:00Z`)
      if (filters.to) params.set('to', `${filters.to}T23:59:59Z`)
      params.set('page', String(Math.max(0, (filters.page ?? 1) - 1))); params.set('size', String(filters.size ?? 25))
      const page = asRecord(await transport.get(`/api/support/tickets?${params}`))
      const counts = asRecord(page.counts)
      const result: TicketPage = {
        items: asRows(page.items).map(mapTicket), total: numberValue(page.total), page: numberValue(page.page) + 1, size: numberValue(page.size, filters.size ?? 25),
        counts: { ALL: numberValue(counts.ALL), IN_PROGRESS: numberValue(counts.IN_PROGRESS), WAITING_CUSTOMER: numberValue(counts.WAITING), RESOLVED: numberValue(counts.RESOLVED), CLOSED: numberValue(counts.CLOSED) },
      }
      return result
    }),
    getTicket: (id) => run(async () => mapTicket(await transport.get(`/api/support/tickets/${id}`))),
    createTicket: (command) => run(async () => mapTicket(await transport.command('/api/support/tickets', command))),
    reply: (id, command) => run(async () => mapTicket(await transport.command(`/api/support/tickets/${id}/replies`, command))),
    acknowledge: (id, command) => run(async () => mapTicket(await transport.command(`/api/support/tickets/${id}/acknowledgments`, command))),
    reopen: (id, command) => run(async () => mapTicket(await transport.command(`/api/support/tickets/${id}/reopen`, command))),
  }
}

export function createSupportApi({ mode, farmId, transport, store }: { mode: BackendMode; farmId: string | number; transport: BackendTransport; store: SupportDemoStore }) {
  void farmId
  const backend = createBackendApi(transport)
  return {
    // chưa có API (danh sách trang trại thuộc sở hữu của người gửi; dùng cho SCR-65)
    async listOwnedFarms() {
      if (mode === 'backend') return backend.listOwnedFarms()
      return store.listOwnedFarms()
    },
    // GET /api/support/tickets ?q,category,tab,from,to,page,size
    async listTickets(filters: TicketFilters = {}) {
      if (mode === 'backend') return backend.listTickets(filters)
      return store.listTickets(filters)
    },
    // GET /api/support/tickets/{id}
    async getTicket(id: number) {
      if (mode === 'backend') return backend.getTicket(id)
      return store.getTicket(id)
    },
    // POST /api/support/tickets
    async createTicket(command: CreateTicketCommand) {
      if (mode === 'backend') return backend.createTicket(command)
      return store.create(command)
    },
    // POST /api/support/tickets/{id}/replies
    async reply(id: number, command: ReplyCommand) {
      if (mode === 'backend') return backend.reply(id, command)
      return store.reply(id, command)
    },
    // POST /api/support/tickets/{id}/acknowledgments
    async acknowledge(id: number, command: AcknowledgeCommand) {
      if (mode === 'backend') return backend.acknowledge(id, command)
      return store.acknowledge(id, command)
    },
    // POST /api/support/tickets/{id}/reopen
    async reopen(id: number, command: ReopenCommand) {
      if (mode === 'backend') return backend.reopen(id, command)
      return store.reopen(id, command)
    },
  }
}
export type SupportApi = ReturnType<typeof createSupportApi>
export const supportApi = createSupportApi({ mode: backendMode, farmId: backendFarmId, transport: backendTransport, store: supportDemoStore })
