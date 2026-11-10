import type { InternalStatus, QueueFilters, QueueTab, Ticket, TicketCategory, TicketPriority, TicketRow, TicketStatus, TargetRole, InternalView, Actor } from '../types'

export type SupportErrorCode = 'NOT_FOUND' | 'FORBIDDEN' | 'CONFLICT' | 'VALIDATION' | 'SAVE_FAILED_AFTER_DOMAIN'

export class SupportError extends Error {
  readonly code: SupportErrorCode
  constructor(code: SupportErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

export const STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN: 'Mới mở',
  IN_PROGRESS: 'Đang xử lý',
  WAITING_CUSTOMER: 'Chờ khách phản hồi',
  RESOLVED: 'Đã giải quyết',
  CLOSED: 'Đã đóng',
}
export const PRIORITY_LABEL: Record<TicketPriority, string> = { LOW: 'Thấp', NORMAL: 'Thường', HIGH: 'Cao' }
export const CATEGORY_LABEL: Record<TicketCategory, string> = {
  ACCOUNT_ACCESS: 'Truy cập tài khoản',
  PAYMENT: 'Thanh toán',
  FARM_SERVICE: 'Dịch vụ trại',
  SYSTEM_USAGE: 'Sử dụng hệ thống',
  OTHER: 'Khác',
}
export const IR_STATUS_LABEL: Record<InternalStatus, string> = { OPEN: 'Mới mở', DONE: 'Hoàn thành', CANCELLED: 'Đã hủy' }
export const OUTCOME_LABEL = { PERFORMED: 'Đã thực hiện', UNABLE: 'Không thể thực hiện', OUTSIDE_DOMAIN: 'Ngoài phạm vi' } as const
export const ROLE_LABEL: Record<TargetRole, string> = { PM: 'Quản lý nền tảng', SA: 'Quản trị viên hệ thống' }

const PRIORITY_RANK: Record<TicketPriority, number> = { HIGH: 0, NORMAL: 1, LOW: 2 }

/** "2026-10-18T09:40:00" -> "18/10 09:40" (cắt chuỗi, không phụ thuộc múi giờ). */
export function formatStamp(iso: string, withYear = false): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso)
  if (!m) return iso
  return `${m[3]}/${m[2]}${withYear ? `/${m[1]}` : ''} ${m[4]}:${m[5]}`
}

export function nowIso(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`
}

export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(-2).map((w) => w[0]).join('').toUpperCase()

export const isClosed = (t: Pick<Ticket, 'status'>) => t.status === 'CLOSED'
export const openIrOf = (t: Pick<Ticket, 'internalRequests'>, role?: TargetRole): InternalView | undefined =>
  t.internalRequests.find((r) => r.status === 'OPEN' && (!role || r.targetRole === role))
export const latestResolution = (t: Pick<Ticket, 'resolutions'>) => t.resolutions[t.resolutions.length - 1]

export function isAssignedTo(t: Pick<Ticket, 'assignedCsId' | 'assignedAvailable'>, actor: Pick<Actor, 'id'>) {
  return t.assignedCsId === actor.id && t.assignedAvailable
}
/** Chỉ nhận được ticket chưa có CS, hoặc CS phụ trách không còn khả dụng (GBR-77). */
export const isClaimable = (t: Pick<Ticket, 'status' | 'assignedCsId' | 'assignedAvailable'>) =>
  t.status !== 'CLOSED' && (t.assignedCsId === null || !t.assignedAvailable)

export function required(value: string | undefined, label: string, max?: number): string {
  const v = (value ?? '').trim()
  if (!v) throw new SupportError('VALIDATION', `${label} là bắt buộc.`)
  if (max && v.length > max) throw new SupportError('VALIDATION', `${label} tối đa ${max} ký tự.`)
  return v
}

export function closeConditions(t: Ticket) {
  const res = latestResolution(t)
  const openIr = openIrOf(t)
  return {
    resolved: { ok: t.status === 'RESOLVED' && !!res, version: res?.version, at: res?.resolvedAt },
    noOpenIr: { ok: !openIr, code: openIr?.code },
    acknowledged: { ok: !!res?.acknowledged, version: res?.version, at: res?.acknowledgedAt, comment: res?.acknowledgmentComment },
    get all() { return this.resolved.ok && this.noOpenIr.ok && this.acknowledged.ok },
  }
}

export function toRow(t: Ticket): TicketRow {
  return {
    id: t.id, code: t.code, subject: t.subject, category: t.category, priority: t.priority, status: t.status,
    farmName: t.farmName, requester: t.requester, assignedCsId: t.assignedCsId, assignedCs: t.assignedCs,
    assignedAvailable: t.assignedAvailable, createdAt: t.createdAt, updatedAt: t.updatedAt,
  }
}

const matchesTab = (t: Ticket, tab: QueueTab, actorId: number) => {
  switch (tab) {
    case 'unassigned': return t.assignedCsId === null
    case 'mine': return t.assignedCsId === actorId
    case 'waiting': return t.status === 'WAITING_CUSTOMER'
    case 'resolved': return t.status === 'RESOLVED'
    default: return true
  }
}

/** Hàng đợi không chứa ticket đã đóng; sắp theo ưu tiên rồi thời gian tạo mới nhất trước. */
export function filterQueue(all: Ticket[], f: QueueFilters, actorId: number): Ticket[] {
  const q = (f.q ?? '').trim().toLowerCase()
  return all
    .filter((t) => t.status !== 'CLOSED')
    .filter((t) => matchesTab(t, f.tab ?? 'all', actorId))
    .filter((t) => !q || `${t.code} ${t.subject} ${t.requester}`.toLowerCase().includes(q))
    .filter((t) => !f.farm || f.farm === 'all' || t.farmName === f.farm)
    .filter((t) => !f.category || f.category === 'all' || t.category === f.category)
    .filter((t) => !f.priority || f.priority === 'all' || t.priority === f.priority)
    .filter((t) => {
      const a = f.assignment ?? 'all'
      if (a === 'all') return true
      if (a === 'unassigned') return t.assignedCsId === null
      if (a === 'unavailable') return t.assignedCsId !== null && !t.assignedAvailable
      return String(t.assignedCsId) === a
    })
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || b.createdAt.localeCompare(a.createdAt))
}

export function queueCounts(all: Ticket[], actorId: number) {
  const open = all.filter((t) => t.status !== 'CLOSED')
  const count = (tab: QueueTab) => open.filter((t) => matchesTab(t, tab, actorId)).length
  return {
    all: count('all'), unassigned: count('unassigned'), mine: count('mine'), waiting: count('waiting'), resolved: count('resolved'),
    unassignedHigh: open.filter((t) => t.assignedCsId === null && t.priority === 'HIGH').length,
  }
}
