import { addCalendarDays, businessDate, businessDateTime, parseBusinessTime } from '../../../api/farmTimeZone'
import type { NotificationTab, NotificationView } from '../types'

export const NOTIFICATION_TABS: ReadonlyArray<{ value: NotificationTab; label: string }> = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'SUBSCRIPTION_PAYMENT', label: 'Gói & thanh toán' },
  { value: 'SUPPORT', label: 'Hỗ trợ' },
]

export const isUnread = (n: Pick<NotificationView, 'readTime'>) => n.readTime === null

export const countByTab = (list: NotificationView[]): Record<NotificationTab, number> => ({
  ALL: list.length,
  SUBSCRIPTION_PAYMENT: list.filter((n) => n.category === 'SUBSCRIPTION_PAYMENT').length,
  SUPPORT: list.filter((n) => n.category === 'SUPPORT').length,
})

export const filterByTab = (list: NotificationView[], tab: NotificationTab) => (tab === 'ALL' ? list : list.filter((n) => n.category === tab))

export const newestFirst = (list: NotificationView[]) => [...list].sort((a, b) => (a.createdTime < b.createdTime ? 1 : a.createdTime > b.createdTime ? -1 : 0))

/** Đích mở của thông báo (SCR-57/59/60 do tính năng gói dịch vụ phụ trách, SCR-66 là chi tiết ticket). */
export function notificationTarget(n: Pick<NotificationView, 'targetType' | 'targetId'>): string {
  return n.targetType === 'TICKET' ? `/ho-tro/${n.targetId}` : '/goi-dich-vu'
}

/** 5 phút trước / Hôm nay 06:10 / Hôm qua 16:05 / 03/10 21:10 / 15/11/2025 10:05 */
export function relativeTime(iso: string, now: Date): string {
  const timestamp = parseBusinessTime(iso)
  const minutes = Math.floor((now.getTime() - timestamp) / 60_000)
  if (minutes < 1) return 'Vừa xong'
  if (minutes < 60) return `${minutes} phút trước`
  const local = businessDateTime(new Date(timestamp))
  const date = local.slice(0, 10)
  const time = local.slice(11, 16)
  const today = businessDate(now)
  if (date === today) return `Hôm nay ${time}`
  if (date === addCalendarDays(today, -1)) return `Hôm qua ${time}`
  const [year, month, day] = date.split('-')
  return year === today.slice(0, 4) ? `${day}/${month} ${time}` : `${day}/${month}/${year} ${time}`
}
