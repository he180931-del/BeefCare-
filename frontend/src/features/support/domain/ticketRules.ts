import type { BadgeTone } from '../../../components/ui'
import type {
  CreateTicketCommand,
  HistoryEvent,
  ResolutionView,
  Ticket,
  TicketCategory,
  TicketFilters,
  TicketPage,
  TicketPriority,
  TicketStatus,
  TicketTab,
} from '../types'

export const TICKET_CATEGORIES: ReadonlyArray<{ value: TicketCategory; label: string; hint: string }> = [
  { value: 'ACCOUNT_ACCESS', label: 'Truy cập tài khoản', hint: 'Đăng nhập' },
  { value: 'PAYMENT', label: 'Thanh toán', hint: 'Giao dịch' },
  { value: 'FARM_SERVICE', label: 'Dịch vụ trang trại', hint: 'Trạng thái trại' },
  { value: 'SYSTEM_USAGE', label: 'Sử dụng hệ thống', hint: 'Thao tác' },
  { value: 'OTHER', label: 'Khác', hint: 'Ngoài danh mục' },
]
export const categoryLabel = (c: TicketCategory) => TICKET_CATEGORIES.find((x) => x.value === c)?.label ?? c

export const PRIORITY_LABELS: Record<TicketPriority, string> = { LOW: 'Thấp', NORMAL: 'Bình thường', HIGH: 'Cao' }

export const TICKET_TABS: ReadonlyArray<{ value: TicketTab; label: string }> = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'IN_PROGRESS', label: 'Đang xử lý' },
  { value: 'WAITING_CUSTOMER', label: 'Chờ bạn phản hồi' },
  { value: 'RESOLVED', label: 'Đã giải quyết' },
  { value: 'CLOSED', label: 'Đã đóng' },
]

/** "Trại bò Yên Bài – Ba Vì" -> "Yên Bài – Ba Vì" (cách ghi gọn của bảng danh sách). */
export const shortFarmName = (name: string | null) => (name ? name.replace(/^Trại bò\s+/i, '').replace(/^Trại\s+/i, '') : 'Không gắn trang trại')

export const latestResolution = (t: Pick<Ticket, 'resolutions'>): ResolutionView | null =>
  t.resolutions.reduce<ResolutionView | null>((best, r) => (!best || r.version > best.version ? r : best), null)

export const isAwaitingConfirmation = (t: Pick<Ticket, 'status' | 'resolutions'>) =>
  t.status === 'RESOLVED' && latestResolution(t)?.acknowledged === false

export interface StatusView {
  label: string
  tone: BadgeTone
}

export function plainStatus(t: Pick<Ticket, 'status' | 'assignedCs'>): StatusView {
  switch (t.status) {
    case 'OPEN':
      return { label: t.assignedCs ? 'Đang mở' : 'Mới nhận', tone: 'ok' }
    case 'IN_PROGRESS':
      return { label: 'Đang xử lý', tone: 'info' }
    case 'WAITING_CUSTOMER':
      return { label: 'Chờ bạn phản hồi', tone: 'warn' }
    case 'RESOLVED':
      return { label: 'Đã giải quyết', tone: 'ok' }
    case 'CLOSED':
      return { label: 'Đã đóng', tone: 'outline' }
  }
}

/** Trong danh sách, phiếu đã giải quyết nhưng chưa được xác nhận hiện "Chờ bạn xác nhận". */
export const listStatus = (t: Pick<Ticket, 'status' | 'assignedCs' | 'resolutions'>): StatusView =>
  isAwaitingConfirmation(t) ? { label: 'Chờ bạn xác nhận', tone: 'warn' } : plainStatus(t)

export const HISTORY_EVENTS: Record<HistoryEvent, StatusView> = {
  CREATED: { label: 'Mới nhận', tone: 'ok' },
  IN_PROGRESS: { label: 'Đang xử lý', tone: 'info' },
  WAITING_CUSTOMER: { label: 'Chờ bạn phản hồi', tone: 'warn' },
  RESOLVED: { label: 'Đã giải quyết', tone: 'ok' },
  REOPENED: { label: 'Đã mở lại', tone: 'warn' },
  CLOSED: { label: 'Đã đóng', tone: 'outline' },
}

export const canReply = (t: Pick<Ticket, 'status'>) => t.status !== 'CLOSED'

// ---- Lọc, đếm và phân trang (tab đếm theo bộ lọc còn lại, không theo tab) ----
export const normalize = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim()

export const tabOf = (status: TicketStatus): Exclude<TicketTab, 'ALL'> =>
  status === 'OPEN' || status === 'IN_PROGRESS' ? 'IN_PROGRESS' : status

export function filterTickets(tickets: Ticket[], { q, category, from, to }: TicketFilters): Ticket[] {
  const needle = q ? normalize(q) : ''
  return tickets.filter((t) => {
    if (needle && !normalize(`${t.code} ${t.subject}`).includes(needle)) return false
    if (category && t.category !== category) return false
    const day = t.updatedAt.slice(0, 10)
    if (from && day < from) return false
    if (to && day > to) return false
    return true
  })
}

export function buildPage(tickets: Ticket[], filters: TicketFilters = {}): TicketPage {
  const base = filterTickets(tickets, filters)
  const counts: TicketPage['counts'] = { ALL: base.length, IN_PROGRESS: 0, WAITING_CUSTOMER: 0, RESOLVED: 0, CLOSED: 0 }
  for (const t of base) counts[tabOf(t.status)] += 1
  const tab = filters.tab ?? 'ALL'
  const rows = base
    .filter((t) => tab === 'ALL' || tabOf(t.status) === tab)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0))
  const size = filters.size ?? 20
  const page = Math.max(1, filters.page ?? 1)
  return { items: rows.slice((page - 1) * size, page * size), total: rows.length, page, size, counts }
}

// ---- Kiểm tra dữ liệu nhập (SRS 20.1.2, MSG-COM-06) ----
export const SUBJECT_MAX = 150
export const DESCRIPTION_MAX = 3000
export const REPLY_MAX = 3000
export const REASON_MAX = 1000

export function validateCreate(cmd: CreateTicketCommand, ownedFarmIds: number[]): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!cmd.category) errors.category = 'Vui lòng chọn danh mục.'
  if (cmd.scope !== 'FARM' && cmd.scope !== 'ACCOUNT') errors.scope = 'Vui lòng chọn phạm vi.'
  if (cmd.scope === 'FARM') {
    if (cmd.farmId == null) errors.farmId = 'Vui lòng chọn trang trại liên quan.'
    else if (!ownedFarmIds.includes(cmd.farmId)) errors.farmId = 'Bạn không có quyền với trang trại này.'
  }
  const subject = cmd.subject.trim()
  if (!subject) errors.subject = 'Vui lòng nhập tiêu đề.'
  else if (subject.length > SUBJECT_MAX) errors.subject = 'Tiêu đề tối đa 150 ký tự.'
  const description = cmd.description.trim()
  if (!description) errors.description = 'Vui lòng nhập mô tả.'
  else if (description.length > DESCRIPTION_MAX) errors.description = 'Mô tả tối đa 3.000 ký tự.'
  return errors
}

export function validateReply(content: string): string | null {
  const text = content.trim()
  if (!text) return 'Vui lòng nhập nội dung phản hồi.'
  if (text.length > REPLY_MAX) return 'Phản hồi tối đa 3.000 ký tự.'
  return null
}

export function validateReason(reason: string): string | null {
  const text = reason.trim()
  if (!text) return 'Vui lòng nhập lý do mở lại.'
  if (text.length > REASON_MAX) return 'Lý do tối đa 1.000 ký tự.'
  return null
}
