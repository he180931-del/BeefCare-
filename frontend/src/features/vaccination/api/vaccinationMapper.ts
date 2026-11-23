import { asRecord, asRows, textValue } from '../../../shared/api/parse'
import { fromFarmLocal, toFarmLocal } from '../../../shared/lib/date/farmTime'
import { type HerdGroup, type LifeStage, type Schedule, type ScheduleTarget, type ScheduledDose, type VaccCattle, type VaccinationRevision, type VaccineItem, type VaccineRoute, type DoseStatus, type HistoryRow } from '../types'

const num = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value)
  return undefined
}
const text = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() !== '' ? value : undefined)

/** Instant → 'yyyy-mm-ddTHH:mm' theo UTC+7. */
export const toFarmTime = (instant: unknown): string => toFarmLocal(textValue(instant))
/** 'yyyy-mm-ddTHH:mm' giờ trại → Instant có offset của trại. */
export const toInstant = (farmTime: string): string => fromFarmLocal(farmTime)

const ROUTE_IN: Record<string, VaccineRoute> = { INTRAMUSCULAR: 'IM', IM: 'IM', SUBCUTANEOUS: 'SC', SC: 'SC', ORAL: 'ORAL', INTRANASAL: 'IN', IN: 'IN' }
export const ROUTE_OUT: Record<VaccineRoute, string> = { IM: 'INTRAMUSCULAR', SC: 'SUBCUTANEOUS', ORAL: 'ORAL', IN: 'INTRANASAL', OTHER: 'OTHER' }
export const toRoute = (value: unknown): VaccineRoute | undefined => {
  const key = textValue(value).trim().toUpperCase()
  if (!key) return undefined
  return ROUTE_IN[key] ?? 'OTHER'
}

/** Đường tiêm không thuộc danh sách chuẩn là mô tả người dùng nhập cho "Khác" (D45). */
const customRoute = (value: unknown): string | undefined => {
  const raw = textValue(value).trim()
  return raw && !ROUTE_IN[raw.toUpperCase()] && raw.toUpperCase() !== 'OTHER' ? raw : undefined
}

/** Giá trị đường tiêm gửi lên API: mã chuẩn, hoặc mô tả người dùng nhập khi chọn "Khác" (D45). */
export const routeOut = (route: VaccineRoute | undefined, routeOther?: string): string | null =>
  !route ? null : route === 'OTHER' ? routeOther?.trim() || 'OTHER' : ROUTE_OUT[route]

const splitDose = (dose: unknown): { amount: number; unit: string } => {
  const raw = textValue(dose).trim()
  const match = raw.match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/)
  return match ? { amount: Number(match[1].replace(',', '.')), unit: match[2] || 'ml' } : { amount: 0, unit: raw || 'ml' }
}

export function mapVaccine(raw: unknown): VaccineItem {
  const v = asRecord(raw)
  const { amount, unit } = splitDose(v.dose)
  const name = textValue(v.name)
  return { id: num(v.id) ?? 0, name, shortName: name, disease: textValue(v.diseasePrevented), referenceDose: amount, doseUnit: unit, route: toRoute(v.route) ?? 'OTHER', withdrawalDays: num(v.withdrawalDays) ?? 0, active: v.available === true }
}

export interface CattleRef extends VaccCattle { id: number }
export function mapCattle(raw: unknown): CattleRef {
  const p = asRecord(raw)
  return { id: num(p.id) ?? 0, code: textValue(p.displayCode), name: text(p.name), breed: textValue(p.breedName), sex: p.sex === 'FEMALE' ? 'Cái' : 'Đực', penCode: textValue(p.penCode), penName: textValue(p.penName), herdGroup: (text(p.herdGroup) ?? 'OTHER') as HerdGroup, lifeStage: textValue(p.lifeStage) as LifeStage, herdEntryDate: textValue(p.entryDate, textValue(asRecord(p.entry).entryDate)), status: p.herdStatus === undefined || p.herdStatus === 'ACTIVE' ? 'ACTIVE' : 'EXITED' }
}

const DOSE_STATUSES: DoseStatus[] = ['PLANNED', 'DONE', 'CANCELLED']
export const doseStatus = (value: unknown): DoseStatus => {
  const s = textValue(value).toUpperCase()
  return (DOSE_STATUSES as string[]).includes(s) ? s as DoseStatus : 'PLANNED'
}

export interface ScheduleView { schedule: Schedule; vaccineName: string; doses: ScheduledDose[] }
const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [])
export function mapSchedule(raw: unknown): ScheduleView {
  const s = asRecord(raw)
  const doseCount = num(s.doseCount) ?? 1
  const id = num(s.id) ?? 0
  const doses: ScheduledDose[] = asRows(s.doses).map((d) => {
    const doseNo = num(d.doseNo) ?? 1
    return { id: num(d.id) ?? 0, scheduleId: id, cattleCode: textValue(d.cattleCode), doseNo, kind: doseNo > doseCount ? 'BOOSTER' : 'DOSE', dueDate: textValue(d.dueDate), status: doseStatus(d.status), version: num(d.version) ?? 0 }
  })
  const codes = [...new Set(doses.filter((d) => d.status !== 'CANCELLED').map((d) => d.cattleCode))]
  const stored = s.target === null || s.target === undefined ? undefined : asRecord(s.target)
  const target: ScheduleTarget = stored ? { penCodes: strings(stored.penCodes), herdGroups: strings(stored.herdGroups) as HerdGroup[], lifeStages: strings(stored.lifeStages) as LifeStage[], excluded: strings(stored.excludedCattleCodes), added: strings(stored.cattleCodes) } : { penCodes: [], herdGroups: [], lifeStages: [], excluded: [], added: codes }
  return { vaccineName: textValue(s.vaccineName), doses, schedule: { id, name: textValue(s.name), vaccineId: num(s.vaccineId) ?? 0, firstDueDate: textValue(s.firstDueDate), doseCount, intervalDays: doseCount > 1 ? num(s.intervalDays) : undefined, boosterIntervalMonths: num(s.boosterIntervalMonths), status: textValue(s.status).toUpperCase() === 'STOPPED' ? 'STOPPED' : 'ACTIVE', completed: s.completed === true, version: num(s.version) ?? 0, target, stopReason: text(s.stopReason) } }
}

const SOURCES = ['ON_FARM', 'HISTORICAL'] as const
const daysBetween = (from: string, to: string | undefined) => (to && from ? Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) : 0)
export function mapRevision(raw: unknown): VaccinationRevision {
  const r = asRecord(raw); const b = asRecord(r.before); const date = textValue(b.vaccinationDate)
  return { at: toFarmTime(r.changedAt), by: textValue(r.changedBy), action: textValue(r.action).toUpperCase() === 'VOID' ? 'VOID' : 'CORRECT', reason: textValue(r.reason), before: { vaccineId: num(b.vaccineId) ?? 0, administeredAt: text(b.administeredAt) ? toFarmTime(b.administeredAt) : date ? `${date}T00:00` : '', batchNo: text(b.batchNo), dose: text(b.dose), route: toRoute(b.route), withdrawalDays: num(b.withdrawalDays) ?? daysBetween(date, text(b.withdrawalEndDate)), vaccinator: text(b.vaccinator) } }
}
export function mapRecord(raw: unknown): HistoryRow {
  const r = asRecord(raw); const date = textValue(r.vaccinationDate); const administeredAt = text(r.administeredAt) ? toFarmTime(r.administeredAt) : `${date}T00:00`; const withdrawalEndDate = text(r.withdrawalEndDate); const source = (SOURCES as readonly string[]).includes(textValue(r.source).toUpperCase()) ? textValue(r.source).toUpperCase() as 'ON_FARM' | 'HISTORICAL' : 'ON_FARM'; const days = num(r.withdrawalDays) ?? daysBetween(date, withdrawalEndDate)
  return { id: num(r.id) ?? 0, cattleCode: textValue(r.cattleCode), penCode: textValue(r.penCode), vaccineId: num(r.vaccineId), vaccineLabel: textValue(r.vaccineName), batchNo: text(r.batchNo), dose: text(r.dose), route: toRoute(r.route), routeText: customRoute(r.route), administeredAt, precision: 'EXACT', source, vaccinator: text(r.vaccinator), withdrawalDays: days, withdrawalEndDate, reactionCaseCode: text(r.reactionCaseCode), status: textValue(r.status).toUpperCase() === 'VOIDED' ? 'VOIDED' : 'VALID', corrected: r.corrected === true, version: num(r.version) ?? 0, revisions: asRows(r.revisions).map(mapRevision) }
}
export function mapSkipped(raw: unknown): { cattleCode: string; message: string } {
  const s = asRecord(raw); const code = textValue(s.cattleCode); const messageCode = textValue(s.messageCode).replace(/^MSG-/, '')
  if (messageCode === 'FE09-09') return { cattleCode: code, message: `${code} đã tiêm mũi ${num(s.doseNo) ?? ''} của lịch này nên được bỏ qua.` }
  if (messageCode === 'COM-13') return { cattleCode: code, message: `${code} đã rời đàn nên được bỏ qua.` }
  return { cattleCode: code, message: `${code} được bỏ qua.` }
}
