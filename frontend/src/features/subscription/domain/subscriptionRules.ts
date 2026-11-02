import type { Payment, PeriodStatus, PriceDTO, RequestEligibility, ServiceStatus, StateDialogState, SubscriptionOverview, Term } from '../types'
import { SubscriptionError } from '../types'

export const TERMS: readonly Term[] = [1, 2, 3]
export const RENEWAL_WINDOW_DAYS = 90 // GBR-71
export const REQUEST_VALIDITY_MS = 24 * 3_600_000 // GBR-70
export const BANK_NAMES: Record<string, string> = { MB: 'MB Bank (Ngân hàng Quân đội)' }

const DAY = 86_400_000
const VN_OFFSET = 7 * 3_600_000 // Asia/Ho_Chi_Minh, không có giờ mùa hè

export const toMs = (t: string | number) => (typeof t === 'number' ? t : Date.parse(t))
export const toIso = (t: number) => new Date(t).toISOString()
const vn = (t: string | number) => new Date(toMs(t) + VN_OFFSET)
const p2 = (n: number) => String(n).padStart(2, '0')

export const vnTime = (y: number, m: number, d: number, h = 0, mi = 0, s = 0) => Date.UTC(y, m - 1, d, h, mi, s) - VN_OFFSET
export const startOfVnDay = (t: string | number) => {
  const d = vn(t)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - VN_OFFSET
}

/** Cộng số năm lịch; 29/02 về 28/02 ở năm không nhuận (GBR-73). */
export function addYears(t: string | number, years: number): number {
  const d = vn(t)
  const y = d.getUTCFullYear() + years
  const last = new Date(Date.UTC(y, d.getUTCMonth() + 1, 0)).getUTCDate()
  return Date.UTC(y, d.getUTCMonth(), Math.min(d.getUTCDate(), last), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds()) - VN_OFFSET
}

export const priceFor = (p: PriceDTO, term: Term) => (term === 1 ? p.price1y : term === 2 ? p.price2y : p.price3y)

/** Kỳ mua bắt đầu tại max(thời điểm xác nhận, ngày hết kỳ đã xác nhận gần nhất) và kéo dài đúng N năm (GBR-73). */
export function planPeriod(confirmedAt: string | number, latestEnd: string | number | null, years: number) {
  const start = Math.max(toMs(confirmedAt), latestEnd === null ? 0 : toMs(latestEnd))
  return { start, end: addYears(start, years) }
}

/** Ngày mở gia hạn = ngày cuối đã xác nhận trừ 90 ngày (vd. 14/11/2026 -> 16/08/2026). */
export const renewalOpensAt = (latestEnd: string | number) => startOfVnDay(toMs(latestEnd) - 1) - RENEWAL_WINDOW_DAYS * DAY

export function requestEligibility({ suspended, latestEnd, now, pricesAvailable }: { suspended: boolean; latestEnd: string | null; now: number; pricesAvailable: boolean }): RequestEligibility {
  if (suspended) return { ok: false, reason: 'SUSPENDED' } // GBR-71, D08
  if (!pricesAvailable) return { ok: false, reason: 'PRICE_UNAVAILABLE' }
  if (latestEnd !== null) {
    const opens = renewalOpensAt(latestEnd)
    if (now < opens) return { ok: false, reason: 'OUTSIDE_WINDOW', opensAt: toIso(opens) }
  }
  return { ok: true }
}

export function deriveServiceStatus({ suspended, hasPeriods, covered }: { suspended: boolean; hasPeriods: boolean; covered: boolean }): ServiceStatus {
  if (suspended) return 'SUSPENDED' // GBR-13, GBR-15
  if (!hasPeriods) return 'PENDING_PAYMENT'
  return covered ? 'ACTIVE' : 'EXPIRED'
}

export const periodStatus = (start: string, end: string, now: number): PeriodStatus => (now >= toMs(end) ? 'PAST' : now >= toMs(start) ? 'CURRENT' : 'FUTURE')
export const daysUntil = (end: string, now: number) => Math.max(0, Math.floor((toMs(end) - now) / DAY))

export const estimatePeriod = (now: number, latestEnd: string | null, years: Term) => planPeriod(now, latestEnd, years)

// ---------- Định dạng ----------
export const fmtDate = (t: string | number) => {
  const d = vn(t)
  return `${p2(d.getUTCDate())}/${p2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`
}
const hm = (t: string | number) => `${p2(vn(t).getUTCHours())}:${p2(vn(t).getUTCMinutes())}`
export const fmtDateTime = (t: string | number) => `${fmtDate(t)} ${hm(t)}`
export const fmtTimeDate = (t: string | number) => `${hm(t)} ${fmtDate(t)}`
export const fmtDateTimeSec = (t: string | number) => `${fmtDate(t)} ${hm(t)}:${p2(vn(t).getUTCSeconds())}`
/** Ngày cuối cùng còn hiệu lực của kỳ nửa mở [start, end). */
export const fmtEndDay = (end: string | number) => fmtDate(toMs(end) - 1)
export const fmtPeriod = (start: string | number, end: string | number) => `${fmtDate(start)} → ${fmtEndDay(end)}`
export const fmtVnd = (n: number) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} đ`
export const fmtClock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${p2(Math.floor(s / 3600))}:${p2(Math.floor((s % 3600) / 60))}:${p2(s % 60)}`
}
export const fmtAccount = (n: string) => n.replace(/^(\d{4})(\d{3})(\d{3})(\d{3})$/, '$1 $2 $3 $4')
export const vnDateKey = (t: string | number) => {
  const d = vn(t)
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`
}
export const termLabel = (t: number) => `${t} năm`
export const versionLabel = (id: number) => `v${id}`
export const quoteText = (version: number, term: number, amount: number) => `${versionLabel(version)} · ${termLabel(term)} · ${fmtVnd(amount)}`
export const paymentQuote = (p: Payment) => quoteText(p.priceVersionId, p.durationYears, p.amountVnd)

// ---------- Từ lỗi / trạng thái sang hộp thoại ----------
export function stateFromError(e: unknown): StateDialogState | null {
  if (!(e instanceof SubscriptionError)) return null
  const d = e.detail
  switch (e.code) {
    case 'SUSPENDED': return { kind: 'suspended', farmName: d.farmName ?? '', paidUntil: d.paidUntil ?? null }
    case 'OUTSIDE_WINDOW': return d.confirmedEnd && d.opensAt ? { kind: 'renewal-closed', confirmedEnd: d.confirmedEnd, opensAt: d.opensAt } : null
    case 'PENDING_EXISTS': return d.payment ? { kind: 'pending-exists', payment: d.payment } : null
    case 'PRICE_CHANGED': return d.seen && d.current ? { kind: 'price-changed', seen: d.seen, current: d.current } : null
    case 'PRICE_UNAVAILABLE': return { kind: 'price-unavailable' }
    case 'RESULT_UNAVAILABLE': return d.payment ? { kind: 'result-unavailable', payment: d.payment, checkedAt: d.checkedAt ?? '' } : null
    default: return null
  }
}

/** Trại không thể tạo yêu cầu: trả đúng hộp thoại tương ứng (MSG-FE19-03/04/09). */
export function stateForOverview(o: SubscriptionOverview | null | undefined): StateDialogState | null {
  if (!o || o.eligibility.ok) return null
  if (o.eligibility.reason === 'SUSPENDED') return { kind: 'suspended', farmName: o.farmName, paidUntil: o.latestEnd }
  if (o.eligibility.reason === 'PRICE_UNAVAILABLE') return { kind: 'price-unavailable' }
  return { kind: 'renewal-closed', confirmedEnd: o.latestEnd ?? '', opensAt: o.eligibility.opensAt }
}
