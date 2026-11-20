import type { GrowthBasis, GrowthMethod, GrowthProjection, GrowthRecord } from '../types'
import { addDays, dayFloat, fmtDate } from './growthFormat'

export const BCS_SCALE = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]
export const WEIGHT_MIN = 1
export const WEIGHT_MAX = 1500
export const GIRTH_RANGE = [50, 300] as const
export const LENGTH_RANGE = [30, 250] as const
export const WEIGHING_INTERVAL_DAYS = 30
export const LARGE_CHANGE_RATIO = 0.2
export const MIN_ADG_GAP_DAYS = 14
export const NOTE_MAX = 500

export const round = (n: number, digits: number) => Math.round(n * 10 ** digits) / 10 ** digits

/** GBR-39: cân nặng ước tính = 88,4 × vòng ngực (m)² × dài thân chéo (m). */
export const tapeWeightKg = (girthCm: number, lengthCm: number) => round(88.4 * (girthCm / 100) ** 2 * (lengthCm / 100), 1)

/** GBR-38: cân điện tử là số đo thực tế, mọi phương pháp khác là ước tính. */
export const basisOf = (method?: GrowthMethod): GrowthBasis | undefined => (method ? (method === 'SCALE' ? 'MEASURED' : 'ESTIMATED') : undefined)

export interface MeasurementInput {
  measuredAt: string
  method?: GrowthMethod
  weightKg?: number
  heartGirthCm?: number
  bodyLengthCm?: number
  bcs?: number
  note?: string
}

export type GrowthFieldKey = 'form' | 'measuredAt' | 'method' | 'weightKg' | 'heartGirthCm' | 'bodyLengthCm' | 'bcs' | 'note' | 'reason'
export type GrowthFieldErrors = Partial<Record<GrowthFieldKey, string>>

export class GrowthValidationError extends Error {
  fields: GrowthFieldErrors
  constructor(fields: GrowthFieldErrors) {
    super(Object.values(fields)[0] ?? 'Dữ liệu không hợp lệ.')
    this.name = 'GrowthValidationError'
    this.fields = fields
  }
}

export class GrowthLargeChangeError extends Error {
  constructor(public newKg: number, public lastKg: number, public lastAt: string) {
    super(`Cân nặng mới (${newKg} kg) chênh hơn 20% so với lần cân trước (${lastKg} kg ngày ${fmtDate(lastAt)}). Vẫn lưu?`)
    this.name = 'GrowthLargeChangeError'
  }
}

export interface WeightPoint { at: string; kg: number; basis: GrowthBasis; id: number }

/** Các lần cân hợp lệ, cũ trước mới sau. Bản ghi loại trừ hoặc hủy không dùng trong tính toán (GBR-39, GBR-40). */
export function validWeights(records: GrowthRecord[]): WeightPoint[] {
  return records
    .filter((r) => r.status === 'VALID' && r.weightKg !== undefined)
    .map((r) => ({ at: r.measuredAt, kg: r.weightKg as number, basis: r.basis ?? 'ESTIMATED', id: r.id }))
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))
}

/** GBR-39: ADG của một kỳ, chỉ hiện khi hai lần cân cách nhau từ 14 ngày. */
export function adgForWindow(weights: WeightPoint[], windowDays: number, now: string): number | undefined {
  const from = dayFloat(now) - windowDays
  const inWindow = weights.filter((w) => dayFloat(w.at) >= from && w.at <= now)
  if (inWindow.length < 2) return undefined
  const first = inWindow[0]
  const last = inWindow[inWindow.length - 1]
  const days = dayFloat(last.at) - dayFloat(first.at)
  if (days < MIN_ADG_GAP_DAYS) return undefined
  return (last.kg - first.kg) / days
}

/** ADG của từng dòng so với lần cân hợp lệ ngay trước đó. */
export function rowAdgMap(weights: WeightPoint[]): Record<number, number | undefined> {
  const out: Record<number, number | undefined> = {}
  weights.forEach((w, i) => {
    if (i === 0) return (out[w.id] = undefined)
    const prev = weights[i - 1]
    const days = dayFloat(w.at) - dayFloat(prev.at)
    out[w.id] = days >= MIN_ADG_GAP_DAYS ? (w.kg - prev.kg) / days : undefined
  })
  return out
}

/** MSG-FE08-04: lệch hơn 20% so với lần cân hợp lệ gần nhất trong 30 ngày trước đó. */
export function largeChangeAgainst(weights: WeightPoint[], measuredAt: string, newKg: number): WeightPoint | undefined {
  const before = weights.filter((w) => w.at <= measuredAt)
  const last = before[before.length - 1]
  if (!last || dayFloat(measuredAt) - dayFloat(last.at) > 30) return undefined
  return Math.abs(newKg - last.kg) / last.kg > LARGE_CHANGE_RATIO ? last : undefined
}

/** GBR-107: dự kiến ngày đạt cân xuất = ngày cân gần nhất + (mục tiêu − cân) ÷ ADG 60 ngày. */
export function finishingProjection(weights: WeightPoint[], targetKg: number | undefined, now: string): GrowthProjection | undefined {
  if (!targetKg) return undefined
  const latest = weights[weights.length - 1]
  if (!latest) return { state: 'INSUFFICIENT', targetKg, missingKg: targetKg }
  const missingKg = Math.max(0, targetKg - latest.kg)
  if (missingKg === 0) return { state: 'REACHED', targetKg, missingKg }
  const adg60 = adgForWindow(weights, 60, now)
  if (adg60 === undefined || adg60 <= 0) return { state: 'INSUFFICIENT', targetKg, missingKg, adg60 }
  const days = Math.ceil(missingKg / adg60)
  return { state: 'PROJECTED', targetKg, missingKg, adg60, days, projectedDate: addDays(latest.at, days) }
}

export interface FinishingProgress {
  percent: number
  currentKg: number
  currentAt: string
  currentBasis: GrowthBasis
  targetKg: number
  gainedKg: number
  plannedKg: number
  since: string
}

/**
 * Tiến độ chặng vỗ béo (Figma Tab 17): phần đã tăng từ lần cân hợp lệ đầu tiên ÷ (cân mục tiêu − cân đầu tiên).
 * Cân hiện tại là lần cân hợp lệ gần nhất — cùng mốc mà dự kiến xuất bán (GBR-107) dùng.
 */
export function finishingProgress(records: GrowthRecord[], targetKg: number): FinishingProgress | undefined {
  const weights = validWeights(records)
  const first = weights[0]
  const last = weights[weights.length - 1]
  if (!first || !last) return undefined
  const plannedKg = targetKg - first.kg
  const gainedKg = round(last.kg - first.kg, 1)
  const percent = plannedKg <= 0 || last.kg >= targetKg ? 100 : Math.min(100, Math.max(0, Math.round((gainedKg / plannedKg) * 100)))
  return { percent, currentKg: last.kg, currentAt: last.at, currentBasis: last.basis, targetKg, gainedKg, plannedKg: Math.max(0, round(plannedKg, 1)), since: first.at }
}

/** Cân ước tính vào ngày cân tới nếu giữ ADG 60 ngày (Figma Tab 17 "Cân tới"): cân gần nhất + ADG × số ngày. */
export function weightAtNextWeighing(currentKg: number, currentAt: string, nextWeighingDate: string | undefined, adg60: number | undefined): number | undefined {
  if (adg60 === undefined || !nextWeighingDate) return undefined
  const days = Math.max(0, Math.round(dayFloat(nextWeighingDate) - dayFloat(currentAt.slice(0, 10))))
  return round(currentKg + adg60 * days, 1)
}
