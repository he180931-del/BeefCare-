import type { PriceStatus, PriceVersion, PriceVersionView } from '../types'

export const MIN_PRICE = 1000
export const MAX_PRICE = 1_000_000_000
export const PRICE_ERROR = 'Giá phải là số nguyên đồng từ 1.000 đến 1.000.000.000.'
export const PAST_ERROR = 'Thời điểm hiệu lực không được ở quá khứ.'

/** "1.200.000" -> 1200000; NaN khi không phải số nguyên. */
export function parseVnd(text: string) {
  const t = text.replace(/\s/g, '').replace(/đ$/i, '')
  return /^(?:\d+|\d{1,3}(?:\.\d{3})+)$/.test(t) ? Number(t.replace(/\./g, '')) : Number.NaN
}
export const validPrice = (n: number) => Number.isInteger(n) && n >= MIN_PRICE && n <= MAX_PRICE

/** GBR-75: trạng thái từng phiên bản tại thời điểm `now`. */
export function withStatuses(versions: PriceVersion[], now: string): PriceVersionView[] {
  const live = versions.filter((v) => !v.withdrawn && v.effectiveAt <= now)
  const current = live.reduce<PriceVersion | null>((m, v) => (m === null || v.effectiveAt > m.effectiveAt ? v : m), null)
  return versions
    .map((v) => {
      let status: PriceStatus
      if (v.withdrawn) status = 'WITHDRAWN'
      else if (v.effectiveAt > now) status = 'SCHEDULED'
      else status = current && v.version === current.version ? 'EFFECTIVE' : 'SUPERSEDED'
      return { ...v, status }
    })
    .sort((a, b) => b.version - a.version)
}
