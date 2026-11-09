// Tên trường theo DTO trong OpenAPI (Ticket, InternalView, ResolutionView...); phần thêm chỉ phục vụ mock.
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_CUSTOMER' | 'RESOLVED' | 'CLOSED'
export type TicketPriority = 'LOW' | 'NORMAL' | 'HIGH'
export type TicketCategory = 'ACCOUNT_ACCESS' | 'PAYMENT' | 'FARM_SERVICE' | 'SYSTEM_USAGE' | 'OTHER'
export type InternalStatus = 'OPEN' | 'DONE' | 'CANCELLED'
export type InternalOutcome = 'PERFORMED' | 'UNABLE' | 'OUTSIDE_DOMAIN'
export type TargetRole = 'PM' | 'SA'
export type QueueTab = 'all' | 'unassigned' | 'mine' | 'waiting' | 'resolved'

export interface Actor { id: number; name: string; role: 'CS' | 'PM' | 'SA' }
export interface StaffMember { id: number; name: string; role: 'CS' | 'PM' | 'SA'; available: boolean }
export interface FarmOption { id: number; name: string }
export interface ContextRef { type: string; id: number; label: string }

export interface TicketMessage {
  id: number
  visibility: 'PUBLIC' | 'INTERNAL'
  author: string
  authorRole: 'OWNER' | 'CS'
  text: string
  at: string
}

export interface ResolutionView {
  id: number
  version: number
  content: string
  resolvedBy: string
  resolvedAt: string
  acknowledged: boolean
  acknowledgedAt?: string
  acknowledgmentComment?: string
  reviewed: boolean
}

export interface HistoryEvent { at: string; actor: string; text: string }

export interface InternalView {
  id: number
  code: string
  title: string
  ticketId: number
  ticketCode: string
  farmId: number
  farmName: string
  targetRole: TargetRole
  recipientId: number
  recipient: string
  fromId: number
  from: string
  createdAt: string
  question: string
  context: ContextRef[]
  status: InternalStatus
  outcome?: InternalOutcome
  result?: string
  domainResultAuditId?: number
  completedAt?: string
  completedBy?: string
  version: number
  history: HistoryEvent[]
}

export interface Ticket {
  id: number
  code: string
  subject: string
  category: TicketCategory
  priority: TicketPriority
  status: TicketStatus
  farmId: number
  farmName: string
  requesterId: number
  requester: string
  assignedCsId: number | null
  assignedCs: string | null
  /** false khi CS phụ trách không còn khả dụng (GBR-77): hiện ở "cần chú ý" và cho nhận lại. */
  assignedAvailable: boolean
  createdAt: string
  updatedAt: string
  version: number
  messages: TicketMessage[]
  resolutions: ResolutionView[]
  history: HistoryEvent[]
  internalRequests: InternalView[]
  contextOptions: Record<TargetRole, ContextRef[]>
}

export interface TicketRow {
  id: number
  code: string
  subject: string
  category: TicketCategory
  priority: TicketPriority
  status: TicketStatus
  farmName: string
  requester: string
  assignedCsId: number | null
  assignedCs: string | null
  assignedAvailable: boolean
  createdAt: string
  updatedAt: string
}

export interface QueueFilters {
  q?: string
  farm?: string
  /** 'all' | 'unassigned' | 'unavailable' */
  assignment?: string
  category?: string
  priority?: string
  tab?: QueueTab
  page?: number
  size?: number
}

export interface QueuePage {
  items: TicketRow[]
  total: number
  page: number
  size: number
  counts: Record<QueueTab, number> & { unassignedHigh: number }
}

export interface DomainResult { id: number; label: string }

export interface SupportNotification {
  id: number
  title: string
  body: string
  at: string
  read: boolean
  actionLabel: string
  ticketCode: string
  /** Backend target fields let platform notifications open an internal request as well as a ticket. */
  targetType?: string
  targetId?: number
}

export interface CompleteCommand {
  outcome: InternalOutcome
  result: string
  domainResultAuditId?: number
  expectedVersion: number
  /** Chỉ để minh họa khung "Kết quả miền đã lưu, chưa lưu Hoàn thành". */
  simulateSaveFailure?: boolean
}
