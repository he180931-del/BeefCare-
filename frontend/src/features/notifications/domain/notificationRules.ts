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

const pad = (v: number) => String(v).padStart(2, '0')
// Chuỗi ISO cục bộ ("2026-10-18T09:47:00") nên so sánh không phụ thuộc múi giờ.
const toDate = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00` : iso)
const dayKey = (d: Date) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()

/** 5 phút trước / Hôm nay 06:10 / Hôm qua 16:05 / 03/10 21:10 / 15/11/2025 10:05 */
export function relativeTime(iso: string, now: Date): string {
  const at = toDate(iso)
  const minutes = Math.floor((now.getTime() - at.getTime()) / 60_000)
  const hm = `${pad(at.getHours())}:${pad(at.getMinutes())}`
  if (minutes < 1) return 'Vừa xong'
  if (minutes < 60) return `${minutes} phút trước`
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (dayKey(at) === dayKey(now)) return `Hôm nay ${hm}`
  if (dayKey(at) === dayKey(yesterday)) return `Hôm qua ${hm}`
  const dm = `${pad(at.getDate())}/${pad(at.getMonth() + 1)}`
  return at.getFullYear() === now.getFullYear() ? `${dm} ${hm}` : `${dm}/${at.getFullYear()} ${hm}`
}
