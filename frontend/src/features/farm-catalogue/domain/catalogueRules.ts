import { businessDate } from '../../../shared/lib/date/farmTime'
import type { AvailabilityFilter, CatalogueFilters, Purpose, PurposeType, Route, Vaccine } from '../types'

export type FieldErrorMap = Record<string, string>

/** Lỗi theo từng ô, hiện ngay dưới ô nhập. */
export class FieldErrors extends Error {
  readonly fields: FieldErrorMap
  constructor(fields: FieldErrorMap) {
    super(Object.values(fields)[0] ?? 'Dữ liệu chưa hợp lệ.')
    this.name = 'FieldErrors'
    this.fields = fields
  }
}

export const CODE_PATTERN = /^[A-Z0-9-]{2,20}$/
export const CODE_HINT = '2–20 ký tự: chữ in hoa, số và "-"'

export const required = (label: string) => `${label} là bắt buộc.` // MSG-COM-06

export function checkCode(value: string | undefined, label = 'Mã'): string | undefined {
  const code = (value ?? '').trim()
  if (!code) return required(label)
  if (!CODE_PATTERN.test(code)) return `${label} gồm 2–20 ký tự: chữ in hoa, số và "-".`
  return undefined
}

export function checkText(value: string | undefined, label: string, max: number, isRequired = false): string | undefined {
  const text = (value ?? '').trim()
  if (!text) return isRequired ? required(label) : undefined
  if (text.length > max) return `${label} tối đa ${max} ký tự.`
  return undefined
}

/** MSG-FE18-06: giá trị ngoài khoảng cho phép. NaN = ô nhập không phải số. */
export function checkNumber(
  value: number | null | undefined,
  label: string,
  min: number,
  max: number,
  { integer = true, optional = false }: { integer?: boolean; optional?: boolean } = {},
): string | undefined {
  if (value === null || value === undefined) return optional ? undefined : required(label)
  if (!Number.isFinite(value) || (integer && !Number.isInteger(value))) return `${label} phải là ${integer ? 'số nguyên' : 'số'} từ ${min} đến ${max}.`
  if (value < min || value > max) return `${label} phải nằm trong khoảng ${min} đến ${max}.`
  return undefined
}

export function parseNumber(text: string): number | null {
  const t = text.trim().replace(',', '.')
  if (t === '') return null
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : Number.NaN
}
export const numberToText = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n).replace('.', ','))

// ---- Nhãn ----
export const ROUTE_LABELS: Record<Route, string> = {
  INTRAMUSCULAR: 'Tiêm bắp', SUBCUTANEOUS: 'Tiêm dưới da', INTRAVENOUS: 'Tiêm tĩnh mạch', ORAL: 'Uống',
  INTRANASAL: 'Nhỏ mũi', TOPICAL: 'Bôi ngoài da', OTHER: 'Khác',
}
export const ROUTE_SHORT: Record<Route, string> = {
  INTRAMUSCULAR: 'bắp', SUBCUTANEOUS: 'dưới da', INTRAVENOUS: 'tĩnh mạch', ORAL: 'uống',
  INTRANASAL: 'nhỏ mũi', TOPICAL: 'bôi ngoài da', OTHER: 'khác',
}
export const VACCINE_ROUTES: Route[] = ['INTRAMUSCULAR', 'SUBCUTANEOUS', 'ORAL', 'INTRANASAL', 'OTHER']
export const MEDICINE_ROUTES: Route[] = ['INTRAMUSCULAR', 'SUBCUTANEOUS', 'INTRAVENOUS', 'ORAL', 'TOPICAL', 'OTHER']
export const PURPOSE_TYPES: PurposeType[] = ['BREEDING', 'FATTENING', 'SIRE', 'UNDECIDED']
export const PURPOSE_TYPE_LABELS: Record<PurposeType, string> = {
  BREEDING: 'Sinh sản', FATTENING: 'Vỗ béo', SIRE: 'Đực giống', UNDECIDED: 'Chưa xác định',
}

// ---- Dùng / tham chiếu ----
export const vaccineUsage = (v: Pick<Vaccine, 'scheduleCount' | 'recordCount'>) => v.scheduleCount + v.recordCount
export function vaccineUsageLabel(v: Pick<Vaccine, 'scheduleCount' | 'recordCount'>): string {
  const parts = [v.scheduleCount > 0 && `${v.scheduleCount} lịch`, v.recordCount > 0 && `${v.recordCount} mũi`].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'Chưa dùng'
}
export function vaccineDoseRoute(v: Pick<Vaccine, 'dose' | 'route'>): { text: string; needsLabel: boolean } {
  if (!v.dose && !v.route) return { text: 'Bổ sung theo nhãn', needsLabel: true }
  return { text: [v.dose || '—', v.route ? ROUTE_SHORT[v.route] : '—'].join(' · '), needsLabel: false }
}
/** Số bò hoặc tiêu chí chuồng đang tham chiếu mục đích (MSG-FE18-09). */
export const purposeUsage = (p: Pick<Purpose, 'activeCattle' | 'receivingPens'>) => p.activeCattle + p.receivingPens.length

// ---- Lọc ----
const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\u0111/g, 'd').replace(/\u0110/g, 'D').toLowerCase()
export function matchesFilters(row: { available: boolean }, filters: CatalogueFilters, texts: Array<string | undefined>): boolean {
  const status: AvailabilityFilter = filters.status ?? ''
  if (status === 'ACTIVE' && !row.available) return false
  if (status === 'INACTIVE' && row.available) return false
  const q = fold((filters.q ?? '').trim())
  return !q || texts.some((t) => fold(t ?? '').includes(q))
}

// ---- Ngày ----
export const todayIso = businessDate
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return y && m && d ? `${d}/${m}/${y}` : iso
}
