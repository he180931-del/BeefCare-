// Tên trường theo DTO trong OpenAPI (Ticket, InternalView, ResolutionView...); phần thêm chỉ phục vụ mock.
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_CUSTOMER' | 'RESOLVED' | 'CLOSED'
export type TicketPriority = 'LOW' | 'NORMAL' | 'HIGH'
export type TicketCategory = 'ACCOUNT_ACCESS' | 'PAYMENT' | 'FARM_SERVICE' | 'SYSTEM_USAGE' | 'OTHER'
export type InternalStatus = 'OPEN' | 'WAITING_CS' | 'DONE' | 'CANCELLED'
export type InternalOutcome = 'CONFIRMED' | 'NOT_CONFIRMED' | 'NEED_MORE_INFO' | 'OUT_OF_SCOPE'
export type TargetInternalOutcome = InternalOutcome
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

export interface MessagePage {
  items: TicketMessage[]
  nextBeforeId: number | null
  hasMore: boolean
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
  ticketSubject: string
  ticketCategory: TicketCategory
  /** Tên Chủ trại đã tạo ticket; dùng để định danh yêu cầu cho PM/SA. */
  ticketRequester: string
  farmId: number | null
  farmName: string
  targetRole: TargetRole
  recipientId: number
  recipient: string
  fromId: number | null
  from: string
  createdAt: string
  /** Canonical FE20 target field. */
  requestText: string
  status: InternalStatus
  outcome?: InternalOutcome
  /** Canonical FE20 target field. */
  resultNote?: string
  /** OPEN và người nhận không còn khả dụng (tài khoản bị tạm ngưng / mất vai trò): CS cần đổi người nhận (UC-FE03-08, D32). */
  needsReassignment?: boolean
  completedAt?: string
  completedBy?: string
  version: number
  /** Absent/null server history means the source did not provide history; [] means known empty. */
  history?: HistoryEvent[]
}

/** Named PM/SA response projection; it uses the same strict text/history allowlist as the CS view. */
export type RecipientInternalView = InternalView

export interface Ticket {
  id: number
  code: string
  subject: string
  category: TicketCategory
  priority: TicketPriority
  status: TicketStatus
  farmId: number | null
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
  messagesBeforeId?: number | null
  messagesHasMore?: boolean
  resolutions: ResolutionView[]
  /** Absent/null server history means the source did not provide history; [] means known empty. */
  history?: HistoryEvent[]
  internalRequests: InternalView[]
  contextOptions: Record<TargetRole, ContextRef[]>
}

export interface TicketRow {
  id: number
  version: number
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
  resultNote: string
  expectedVersion: number
  /** Chỉ để minh họa khung "Kết quả miền đã lưu, chưa lưu Hoàn thành". */
  simulateSaveFailure?: boolean
}

export interface CreateInternalCommand {
  targetRole: TargetRole
  recipientId: number
  /** Canonical FE20 target field. */
  requestText: string
}
