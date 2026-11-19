import type { FeedGroup } from '../types'

/** Short group names as shown in the stock, catalogue and receipt frames. */
export const FEED_GROUP_LABELS: Record<FeedGroup, string> = {
  GREEN_ROUGHAGE: 'Thô xanh',
  DRY_ROUGHAGE: 'Thô khô',
  CONCENTRATE: 'Tinh',
  TMR: 'Hỗn hợp (TMR)',
  MINERAL_ADDITIVE: 'Khoáng – phụ gia',
  CALF_FEED: 'Cho bê',
}

export const feedGroupLabel = (group: string) => FEED_GROUP_LABELS[group as FeedGroup] ?? group

const nf = (digits: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: digits })
export const formatNumber = (value: number, digits = 1) => nf(digits).format(value)
export const formatKg = (value: number, digits = 1) => `${nf(digits).format(value)} kg`
export const formatMoney = (value: number) => nf(0).format(Math.round(value))
export const formatVnd = (value: number) => `${formatMoney(value)} đ`

export function formatDate(iso: string | null | undefined) {
  const match = iso?.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : iso ?? ''
}
export function formatShortDate(iso: string) {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? `${match[3]}/${match[2]}` : iso
}

/** Days of cover as the stock frame prints it: "< 1 ngày", one decimal below 10, whole days from 10. */
export function formatDaysOfCover(days: number | null) {
  if (days === null) return '—'
  if (days > 0 && days < 1) return '< 1 ngày'
  return `${days < 10 ? nf(1).format(days) : nf(0).format(Math.floor(days))} ngày`
}
