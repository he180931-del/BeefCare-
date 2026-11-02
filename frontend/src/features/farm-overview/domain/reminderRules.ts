import { dateKey, diffDays, formatDayMonth, formatTime } from './format'
import type { ReminderItem, ReminderSeed, ReminderType, Urgency, ViewerRole } from '../types'

export const TYPE_LABEL: Record<ReminderType, string> = {
  vaccination: 'Tiêm phòng', calving: 'Đẻ', breeding: 'Phối giống', 'pregnancy-check': 'Khám thai', 'pen-stage': 'Chuyển chuồng & giai đoạn',
  weighing: 'Cân đo', 'draft-calf': 'Bê nháp', 'exit-finishing': 'Xuất đàn & vỗ béo', feed: 'Thức ăn', health: 'Sức khỏe',
}
const PILL: Record<ReminderType, string> = {
  vaccination: 'Tiêm phòng', calving: 'Sinh sản', breeding: 'Sinh sản', 'pregnancy-check': 'Sinh sản', 'pen-stage': 'Chuồng trại',
  weighing: 'Tăng trưởng', 'draft-calf': 'Bê nháp', 'exit-finishing': 'Xuất đàn', feed: 'Thức ăn', health: 'Sức khỏe',
}
export const pillLabel = (type: ReminderType) => PILL[type]

/** Các loại chỉ Chủ trại và Quản lý thấy (REM-09, 10, 12, 13). */
const MANAGEMENT_ONLY: ReminderType[] = ['draft-calf', 'exit-finishing', 'feed']

export function urgencyOf(due: string | null, today: string): Urgency {
  if (!due) return 'UPCOMING'
  const diff = diffDays(today, dateKey(due))
  return diff < 0 ? 'OVERDUE' : diff === 0 ? 'TODAY' : 'UPCOMING'
}

export function toItem({ audience: _audience, due, ...seed }: ReminderSeed, today: string): ReminderItem {
  return { ...seed, dueAt: due, urgency: urgencyOf(due, today), lifecycleStatus: 'ACTIVE' }
}

export const isVisibleTo = (seed: ReminderSeed, role: ViewerRole) => seed.audience.includes(role)

export function typeOptionsFor(role: ViewerRole): ReminderType[] {
  const all = Object.keys(TYPE_LABEL) as ReminderType[]
  return role === 'TECHNICIAN' ? all.filter((t) => !MANAGEMENT_ONLY.includes(t)) : all
}

export function dueLabel(item: ReminderItem, today: string): string {
  if (!item.dueAt) return 'Chưa có hạn'
  const days = diffDays(dateKey(item.dueAt), today)
  if (item.urgency === 'OVERDUE') return days === 1 ? 'Hôm qua' : `Quá hạn ${days} ngày`
  if (item.urgency === 'TODAY') return formatTime(item.dueAt)
  return formatDayMonth(item.dueAt)
}

export type DateRange = 'all' | 'today' | '3d' | '7d'
export interface ReminderFilters { query: string; range: DateRange; type: ReminderType | ''; pen: string; urgency: Urgency | 'ALL' }
export const EMPTY_FILTERS: ReminderFilters = { query: '', range: 'all', type: '', pen: '', urgency: 'ALL' }

/** `skipUrgency` dùng để đếm các thẻ tổng hợp trước khi chọn tab. */
export function filterReminders(items: ReminderItem[], f: ReminderFilters, today: string, skipUrgency = false): ReminderItem[] {
  const q = f.query.trim().toLowerCase()
  const maxDays = { all: Infinity, today: 0, '3d': 3, '7d': 7 }[f.range]
  return items.filter((i) => {
    if (q && !`${i.code ?? ''} ${i.title} ${i.group ?? ''}`.toLowerCase().includes(q)) return false
    if (f.type && i.type !== f.type) return false
    if (f.pen && i.pen !== f.pen) return false
    if (!skipUrgency && f.urgency !== 'ALL' && i.urgency !== f.urgency) return false
    if (f.range !== 'all') {
      if (!i.dueAt) return false
      const diff = diffDays(today, dateKey(i.dueAt))
      if (diff < 0 || diff > maxDays) return false
    }
    return true
  })
}

export const countUrgency = (items: ReminderItem[]) => ({
  OVERDUE: items.filter((i) => i.urgency === 'OVERDUE').length,
  TODAY: items.filter((i) => i.urgency === 'TODAY').length,
  UPCOMING: items.filter((i) => i.urgency === 'UPCOMING').length,
})

const ORDER: Record<Urgency, number> = { OVERDUE: 0, TODAY: 1, UPCOMING: 2 }
export const sortReminders = (items: ReminderItem[]) =>
  [...items].sort((a, b) => ORDER[a.urgency] - ORDER[b.urgency] || (a.dueAt ?? '9').localeCompare(b.dueAt ?? '9') || a.id - b.id)
