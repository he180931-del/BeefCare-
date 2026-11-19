import type { PeriodState, PurchasedPeriod, ServiceStatus, TermYears } from '../types'
import { addDays, addYears } from './dates'

/** GBR-73: kỳ mới bắt đầu tại max(thời điểm xác nhận, ngày kế tiếp kỳ đã xác nhận cuối). */
export function nextPeriod(confirmedDate: string, latestEnd: string | null, termYears: TermYears) {
  const afterLatest = latestEnd ? addDays(latestEnd, 1) : null
  const start = afterLatest && afterLatest > confirmedDate ? afterLatest : confirmedDate
  return { start, end: addDays(addYears(start, termYears), -1) }
}

export function coverageEnd(periods: PurchasedPeriod[]) {
  return periods.reduce<string | null>((max, p) => (max === null || p.end > max ? p.end : max), null)
}
export function currentPeriod(periods: PurchasedPeriod[], today: string) {
  return periods.find((p) => p.start <= today && today <= p.end) ?? null
}
export function periodState(p: PurchasedPeriod, today: string): PeriodState {
  if (p.start > today) return 'FUTURE'
  return p.end >= today ? 'CURRENT' : 'PAST'
}
/** GBR-13: trạng thái dịch vụ suy ra từ tạm ngừng và các kỳ đã mua. */
export function deriveStatus(periods: PurchasedPeriod[], suspended: boolean, today: string): ServiceStatus {
  if (suspended) return 'SUSPENDED'
  if (currentPeriod(periods, today)) return 'ACTIVE'
  return periods.length > 0 ? 'EXPIRED' : 'PENDING_PAYMENT'
}
/** GBR-71 / SCR-57: gia hạn mở trước ngày hết hạn đã xác nhận 90 ngày. */
export const renewalOpens = (confirmedEnd: string) => addDays(confirmedEnd, -90)

export function validateReason(reason: string, label = 'Lý do', max = 500) {
  const t = reason.trim()
  if (!t) return `${label} là bắt buộc.`
  if (t.length > max) return `${label} tối đa ${max} ký tự.`
  return null
}

export const STATUS_LABEL: Record<ServiceStatus, string> = {
  ACTIVE: 'Đang hoạt động',
  PENDING_PAYMENT: 'Chờ thanh toán',
  EXPIRED: 'Hết hạn',
  SUSPENDED: 'Tạm ngừng',
}
export const PERIOD_STATE_LABEL: Record<PeriodState, string> = { CURRENT: 'Hiện tại', FUTURE: 'Tương lai', PAST: 'Đã qua' }
export const shortFarmName = (name: string) => (name.replace(/^Trại( bò)?\s+/, '').split(' – ')[0] ?? name)
