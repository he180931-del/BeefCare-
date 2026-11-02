import { backendFarmId, backendMode, backendTransport, type BackendMode, type BackendTransport } from '../../../api/backendTransport'
import { backendPending } from '../../../api/backendPending'
import { supportDemoStore, type SupportDemoStore } from '../data/supportDemoStore'
import type { AcknowledgeCommand, CreateTicketCommand, ReopenCommand, ReplyCommand, TicketFilters } from '../types'

export function createSupportApi({ mode, farmId, transport, store }: { mode: BackendMode; farmId: string | number; transport: BackendTransport; store: SupportDemoStore }) {
  // Kept for the later backend hookup; backend mode must never read the mock.
  void farmId
  void transport
  const requireLocal = () => {
    if (mode === 'backend') throw backendPending('ticket hỗ trợ')
  }
  return {
    // chưa có API (danh sách trang trại thuộc sở hữu của người gửi; dùng cho SCR-65)
    async listOwnedFarms() {
      requireLocal()
      return store.listOwnedFarms()
    },
    // GET /api/support/tickets ?q,category,tab,from,to,page,size
    async listTickets(filters: TicketFilters = {}) {
      requireLocal()
      return store.listTickets(filters)
    },
    // GET /api/support/tickets/{id}
    async getTicket(id: number) {
      requireLocal()
      return store.getTicket(id)
    },
    // POST /api/support/tickets
    async createTicket(command: CreateTicketCommand) {
      requireLocal()
      return store.create(command)
    },
    // POST /api/support/tickets/{id}/replies
    async reply(id: number, command: ReplyCommand) {
      requireLocal()
      return store.reply(id, command)
    },
    // POST /api/support/tickets/{id}/acknowledgments
    async acknowledge(id: number, command: AcknowledgeCommand) {
      requireLocal()
      return store.acknowledge(id, command)
    },
    // POST /api/support/tickets/{id}/reopen
    async reopen(id: number, command: ReopenCommand) {
      requireLocal()
      return store.reopen(id, command)
    },
  }
}
export type SupportApi = ReturnType<typeof createSupportApi>
export const supportApi = createSupportApi({ mode: backendMode, farmId: backendFarmId, transport: backendTransport, store: supportDemoStore })
