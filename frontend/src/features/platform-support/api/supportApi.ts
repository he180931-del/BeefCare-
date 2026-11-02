import { backendFarmId, backendMode, backendTransport, type BackendMode, type BackendTransport } from '../../../api/backendTransport'
import { backendPending } from '../../../api/backendPending'
import { supportDemoStore, type SupportDemoStore } from '../data/supportDemoStore'
import type { Actor, CompleteCommand, ContextRef, QueueFilters, TargetRole, TicketCategory, TicketPriority } from '../types'

export function createSupportApi({ mode, farmId, transport, store }: { mode: BackendMode; farmId: string | number; transport: BackendTransport; store: SupportDemoStore }) {
  // Kept for the later backend hookup; backend mode must never read the mock.
  void farmId
  void transport
  const requireLocal = () => { if (mode === 'backend') throw backendPending('hỗ trợ khách hàng') }
  return {
    // GET /api/platform/support/tickets (?q,category,tab,farmId,priority,assignment,page,size)
    async listQueue(actor: Actor, filters: QueueFilters = {}) { requireLocal(); return store.listQueue(actor, filters) },
    // chưa có API (danh sách trại cho bộ lọc; lấy từ trường farmName của ticket)
    async listFarms() { requireLocal(); return store.listFarms() },
    // chưa có API (danh sách CS; GET /api/platform/support/recipients chỉ nhận role PM/SA/CS)
    async listCs() { requireLocal(); return store.listCs() },
    // GET /api/platform/support/recipients?role=
    async listRecipients(role: TargetRole) { requireLocal(); return store.listRecipients(role) },
    // GET /api/platform/support/tickets/{id}
    async getTicket(actor: Actor, code: string) { requireLocal(); return store.getTicket(actor, code) },
    // POST /api/platform/support/tickets/{id}/processing  (action: CLAIM)
    async claim(actor: Actor, code: string, cmd: { reason?: string; expectedVersion?: number }) { requireLocal(); return store.claim(actor, code, cmd) },
    // POST /api/platform/support/tickets/{id}/processing  (action: HANDOVER, recipientId, reason)
    async handOver(actor: Actor, code: string, cmd: { toCsId: number; reason: string; expectedVersion?: number }) { requireLocal(); return store.handOver(actor, code, cmd) },
    // POST /api/platform/support/tickets/{id}/replies
    async reply(actor: Actor, code: string, cmd: { text: string; expectedVersion?: number }) { requireLocal(); return store.reply(actor, code, cmd) },
    // POST /api/platform/support/tickets/{id}/internal-notes
    async addNote(actor: Actor, code: string, cmd: { text: string; expectedVersion?: number }) { requireLocal(); return store.addNote(actor, code, cmd) },
    // POST /api/platform/support/tickets/{id}/processing  (action: ASK_CUSTOMER, question)
    async askCustomer(actor: Actor, code: string, cmd: { question: string; expectedVersion?: number }) { requireLocal(); return store.askCustomer(actor, code, cmd) },
    // POST /api/platform/support/tickets/{id}/processing  (action: RETURN_TO_QUEUE, reason)
    async returnToQueue(actor: Actor, code: string, cmd: { reason: string; expectedVersion?: number }) { requireLocal(); return store.returnToQueue(actor, code, cmd) },
    // POST /api/platform/support/tickets/{id}/processing  (category, priority)
    async classify(actor: Actor, code: string, cmd: { category?: TicketCategory; priority?: TicketPriority; expectedVersion?: number }) { requireLocal(); return store.classify(actor, code, cmd) },
    // POST /api/platform/support/tickets/{id}/resolutions
    async resolve(actor: Actor, code: string, cmd: { content: string; expectedVersion?: number }) { requireLocal(); return store.resolve(actor, code, cmd) },
    // POST /api/platform/support/tickets/{id}/close
    async close(actor: Actor, code: string, cmd: { reviewed: boolean; note?: string; expectedVersion?: number }) { requireLocal(); return store.close(actor, code, cmd) },
    // POST /api/platform/support/tickets/{id}/internal-requests
    async createInternal(actor: Actor, code: string, cmd: { targetRole: TargetRole; recipientId: number; question: string; context?: ContextRef[] }) { requireLocal(); return store.createInternal(actor, code, cmd) },
    // POST /api/platform/support/tickets/{ticketId}/internal-requests/{id}/management
    async manageInternal(actor: Actor, code: string, irCode: string, cmd: { action: 'REASSIGN' | 'CANCEL'; recipientId?: number; reason: string }) { requireLocal(); return store.manageInternal(actor, code, irCode, cmd) },
    // chưa có API (thông báo hỗ trợ của CS)
    async listNotifications() { requireLocal(); return store.listNotifications() },
    // chưa có API
    async markNotificationRead(id: number) { requireLocal(); return store.markNotificationRead(id) },
    // chưa có API
    async markAllNotificationsRead() { requireLocal(); return store.markAllNotificationsRead() },
    // GET /api/platform/internal-requests?state=
    async listAssigned(actor: Actor) { requireLocal(); return store.listAssigned(actor) },
    // GET /api/platform/internal-requests/{id}
    async getAssigned(actor: Actor, code: string) { requireLocal(); return store.getAssigned(actor, code) },
    // GET /api/platform/internal-requests/{id}/domain-results
    async listDomainResults(actor: Actor, code: string) { requireLocal(); return store.listDomainResults(actor, code) },
    // POST /api/platform/internal-requests/{id}/completion
    async completeInternal(actor: Actor, code: string, cmd: CompleteCommand) { requireLocal(); return store.completeInternal(actor, code, cmd) },
  }
}
export type SupportApi = ReturnType<typeof createSupportApi>
export const supportApi = createSupportApi({ mode: backendMode, farmId: backendFarmId, transport: backendTransport, store: supportDemoStore })
