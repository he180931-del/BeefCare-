// Kiểu dữ liệu ticket của Chủ trại (FE-20, SCR-64..66). Tên trường theo DTO `Ticket` trong OpenAPI;
// `messages[]` thêm author/authorRole/createdAt/kind vì DTO `Message` chỉ có code/params/text.
// `internalRequests` cố ý không có: Chủ trại không bao giờ thấy yêu cầu nội bộ (GBR-81).

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_CUSTOMER' | 'RESOLVED' | 'CLOSED'
export type TicketCategory = 'ACCOUNT_ACCESS' | 'PAYMENT' | 'FARM_SERVICE' | 'SYSTEM_USAGE' | 'OTHER'
export type TicketPriority = 'LOW' | 'NORMAL' | 'HIGH'
export type TicketScope = 'FARM' | 'ACCOUNT'
export type TicketTab = 'ALL' | 'IN_PROGRESS' | 'WAITING_CUSTOMER' | 'RESOLVED' | 'CLOSED'

export type MessageKind = 'DESCRIPTION' | 'REPLY' | 'ACKNOWLEDGMENT' | 'REOPEN'

export interface TicketMessage {
  id?: number
  code: string
  params: Record<string, unknown>
  text: string
  kind: MessageKind
  author: string
  authorRole: 'OWNER' | 'CS'
  createdAt: string
}

export interface ResolutionView {
  id: number
  version: number
  content: string
  resolvedBy: string
  resolvedAt: string
  acknowledged: boolean
  acknowledgedAt: string | null
  acknowledgmentComment: string | null
  reviewed: boolean
}

export type HistoryEvent = 'CREATED' | 'IN_PROGRESS' | 'WAITING_CUSTOMER' | 'RESOLVED' | 'REOPENED' | 'CLOSED'

export interface HistoryEntry {
  at: string
  event: HistoryEvent
  status: TicketStatus
  actor: string
  reason?: string
}

export interface Ticket {
  id: number
  code: string
  subject: string
  category: TicketCategory
  priority: TicketPriority
  status: TicketStatus
  scope: TicketScope
  farmId: number | null
  farmName: string | null
  requesterId: number
  requester: string
  assignedCsId: number | null
  assignedCs: string | null
  createdAt: string
  updatedAt: string
  version: number
  messages: TicketMessage[]
  messagesBeforeId?: number | null
  messagesHasMore?: boolean
  resolutions: ResolutionView[]
  history: HistoryEntry[]
}

export interface MessagePage {
  items: TicketMessage[]
  nextBeforeId: number | null
  hasMore: boolean
}

export interface OwnedFarm {
  id: number
  name: string
}

export interface TicketFilters {
  q?: string
  category?: TicketCategory | ''
  tab?: TicketTab
  from?: string
  to?: string
  page?: number
  size?: number
}

export interface TicketPage {
  items: Ticket[]
  total: number
  page: number
  size: number
  counts: Record<TicketTab, number>
}

export interface CreateTicketCommand {
  category: TicketCategory | ''
  scope: TicketScope
  farmId: number | null
  subject: string
  description: string
}
export interface ReplyCommand {
  content: string
  expectedVersion: number
}
export interface ReopenCommand {
  reason: string
  expectedVersion: number
}
export interface AcknowledgeCommand {
  resolutionVersion: number
  comment?: string
  expectedVersion: number
}
