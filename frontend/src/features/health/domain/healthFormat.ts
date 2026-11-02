import type { CaseOutcome, CaseStatus, EntryType, HealthState, Progress, Severity, TreatmentRoute } from '../types'

export const SEVERITY_LABEL: Record<Severity, string> = { MILD: 'Nhẹ', MODERATE: 'Trung bình', SEVERE: 'Nặng' }
export const PROGRESS_LABEL: Record<Progress, string> = { IMPROVED: 'Cải thiện', UNCHANGED: 'Không đổi', WORSENED: 'Xấu đi' }
export const ROUTE_LABEL: Record<TreatmentRoute, string> = {
  INTRAMUSCULAR: 'Tiêm bắp', SUBCUTANEOUS: 'Tiêm dưới da', INTRAVENOUS: 'Tiêm tĩnh mạch', ORAL: 'Uống', TOPICAL: 'Bôi ngoài da', OTHER: 'Khác',
}
export const OUTCOME_LABEL: Record<CaseOutcome, string> = { RECOVERED: 'Khỏi', DIED: 'Chết', MISSING: 'Mất tích', CLOSED_BY_EXIT: 'Đã xuất' }
export const HEALTH_STATE_LABEL: Record<HealthState, string> = { HEALTHY: 'Khỏe mạnh', MONITORING: 'Theo dõi', UNDER_TREATMENT: 'Đang điều trị' }
export const ENTRY_LABEL: Record<EntryType, string> = { OPENING: 'Mở ca', OBSERVATION: 'Ghi nhận', FOLLOW_UP: 'Theo dõi', TREATMENT: 'Điều trị' }

export const SEVERITIES = Object.keys(SEVERITY_LABEL) as Severity[]
export const PROGRESSES = Object.keys(PROGRESS_LABEL) as Progress[]
export const ROUTES = Object.keys(ROUTE_LABEL) as TreatmentRoute[]

const pad = (n: number) => String(n).padStart(2, '0')

/** 'yyyy-mm-dd' hoặc 'yyyy-mm-ddThh:mm' -> 'dd/mm/yyyy'. */
export function fmtDate(value?: string | null): string {
  if (!value) return '—'
  const [y, m, d] = value.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}
export const fmtDateTime = (value?: string | null) => (value ? `${fmtDate(value)} ${value.slice(11, 16)}` : '—')
export const fmtMonth = (value?: string | null) => (value ? `${value.slice(5, 7)}/${value.slice(0, 4)}` : '—')
export const fmtTemp = (value: number) => value.toFixed(1).replace('.', ',')

export const dateOf = (value: string) => value.slice(0, 10)
export const toLocalDateTime = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${dateOf(to)}T00:00:00Z`) - Date.parse(`${dateOf(from)}T00:00:00Z`)) / 86_400_000)

export function statusText(status: CaseStatus, day: number, chronicSince?: string, outcome?: CaseOutcome): string {
  if (status === 'OPEN') return `OPEN · ngày ${day}`
  if (status === 'CHRONIC') return `CHRONIC · từ ${fmtDate(chronicSince)}`
  return `CLOSED · ${outcome ? OUTCOME_LABEL[outcome] : '—'}`
}
