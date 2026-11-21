import { asRecord, textValue } from '../../../shared/api/parse'
import { fromFarmLocal, toFarmLocal } from '../../../shared/lib/date/farmTime'
import { dateOf, fmtTemp, ROUTE_LABEL, ROUTES } from '../domain/healthFormat'
import { caseDay, latestWithdrawalEnd } from '../domain/healthRules'
import type {
  CaseOutcome, CaseResultKind, CaseStatus, EntryType, HealthCaseCard, HealthCaseResult, HealthCaseRow, HealthCattle,
  HealthTimelineRow, PendingExit, Progress, RecordResult, Severity, TreatmentResult, TreatmentRoute, HealthState,
} from '../types'
import type {
  HealthBackendDto, HealthCattleDto, HealthMedicineDto, HealthTimelineDto, HealthOpenCaseRequestDto, HealthFollowUpRequestDto,
  HealthTreatmentRequestDto, HealthStatusRequestDto, HealthObservationCorrectionRequestDto, HealthTreatmentCorrectionRequestDto,
  HealthVoidRequestDto,
} from './health.dto'

type CaseRef = { caseCode: string; cattleCode: string; openedAt?: string; latestEntryAt?: string }
type EntryRef = { type: EntryType; caseId: number }

export const num = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value)
  return undefined
}
export const text = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() !== '' ? value : undefined)
export const nullableNum = (value: unknown): number | null => num(value) ?? null

/** Instant → 'yyyy-mm-ddTHH:mm' theo giờ trại. */
export const toFarmTime = (instant: unknown): string => toFarmLocal(textValue(instant))
/** 'yyyy-mm-ddTHH:mm' giờ trại → Instant có offset của trại. */
export const toInstant = (farmTime: string): string => fromFarmLocal(farmTime)

const ROUTE_IN: Record<string, TreatmentRoute> = { IM: 'INTRAMUSCULAR', SC: 'SUBCUTANEOUS', SQ: 'SUBCUTANEOUS', IV: 'INTRAVENOUS', PO: 'ORAL' }
export const toRoute = (value: unknown): TreatmentRoute | undefined => {
  const key = textValue(value).trim().toUpperCase()
  if (!key) return undefined
  const mapped = ROUTE_IN[key] ?? key
  return (ROUTES as string[]).includes(mapped) ? mapped as TreatmentRoute : 'OTHER'
}

export const SEVERITIES: Severity[] = ['MILD', 'MODERATE', 'SEVERE']
export const STATUSES: CaseStatus[] = ['OPEN', 'CHRONIC', 'CLOSED']
export const OUTCOMES: CaseOutcome[] = ['RECOVERED', 'DIED', 'MISSING', 'CLOSED_BY_EXIT']
const PROGRESSES: Progress[] = ['IMPROVED', 'UNCHANGED', 'WORSENED']
export const STATES: HealthState[] = ['HEALTHY', 'MONITORING', 'UNDER_TREATMENT']
export const pick = <T extends string>(list: readonly T[], value: unknown, fallback: T): T => {
  const key = textValue(value).toUpperCase()
  return (list as readonly string[]).includes(key) ? key as T : fallback
}
export const pickOptional = <T extends string>(list: readonly T[], value: unknown): T | undefined => {
  const key = textValue(value).toUpperCase()
  return (list as readonly string[]).includes(key) ? key as T : undefined
}

/** Tuổi hiển thị trên đầu hồ sơ: số tháng từ ngày sinh đến hôm nay (giờ trại). */
export function ageText(birthDate: string | undefined, today: string): string {
  if (!birthDate) return ''
  const [by, bm] = birthDate.split('-').map(Number)
  const [ty, tm, td] = today.split('-').map(Number)
  const bd = Number(birthDate.slice(8, 10))
  const months = (ty - by) * 12 + (tm - bm) - (td < bd ? 1 : 0)
  return months >= 0 ? `${months} tháng` : ''
}

export function mapCattle(raw: unknown, today: string): HealthCattle {
  const p = asRecord(raw)
  const exited = p.herdStatus !== undefined && p.herdStatus !== 'ACTIVE'
  return {
    code: textValue(p.displayCode), name: textValue(p.name), earTag: textValue(p.earTagNumber), breed: textValue(p.breedName),
    sex: p.sex === 'FEMALE' ? 'Cái' : 'Đực', ageText: ageText(text(p.birthDate), today), stage: textValue(p.lifeStage),
    penCode: textValue(p.penCode), penName: textValue(p.penName), entryDate: textValue(asRecord(p.entry).entryDate),
    status: exited ? 'EXITED' : 'ACTIVE', exitDate: text(p.exitDate), exitType: text(p.exitType),
  }
}

export function mapMedicine(raw: unknown): { id: number; name: string; active: boolean; defaultDose: string; doseNote: string; route: TreatmentRoute; withdrawalDays: number } {
  const m = asRecord(raw)
  return { id: num(m.id) ?? 0, name: textValue(m.name), active: m.available === true, defaultDose: textValue(m.dose), doseNote: textValue(m.description), route: toRoute(m.route) ?? 'OTHER', withdrawalDays: num(m.withdrawalDays) ?? 0 }
}

/** Dòng mô tả dựng sẵn cho bảng dòng thời gian (SCR-37 #8). */
export function describe(row: HealthTimelineRow): string {
  if (row.type === 'TREATMENT') {
    const dose = `${row.dose ?? ''}${(row.courseDays ?? 1) > 1 ? ` × ${row.courseDays} ngày` : ''}`
    return [row.medicineName, dose, row.route ? ROUTE_LABEL[row.route].toLowerCase() : '', `ngưng ${row.withdrawalDays ?? 0} ngày`].filter(Boolean).join(' · ')
  }
  return `${row.description ?? ''}${row.temperatureC !== null ? ` · ${fmtTemp(row.temperatureC)}°C` : ''}`
}

export function mapTimelineRow(raw: unknown, caseCode: string): HealthTimelineRow {
  const r = asRecord(raw)
  const type: EntryType = r.type === 'TREATMENT' ? 'TREATMENT' : r.type === 'OPENING' ? 'OPENING' : 'FOLLOW_UP'
  const row: HealthTimelineRow = {
    id: num(r.id) ?? 0, caseId: num(r.caseId) ?? 0, caseCode, type, occurredAt: toFarmTime(r.occurredAt), details: '',
    recordedBy: type === 'TREATMENT' ? textValue(r.performer) : textValue(r.observer, textValue(r.recordedBy)),
    status: textValue(r.status).toUpperCase() === 'VOIDED' ? 'VOIDED' : 'VALID', corrected: r.corrected === true,
    linkedVaccinationId: num(r.linkedVaccinationId), version: num(r.version) ?? 0, temperatureC: nullableNum(r.temperatureC),
    progress: type === 'FOLLOW_UP' ? pickOptional(PROGRESSES, r.progress) : undefined, description: type === 'TREATMENT' ? undefined : textValue(r.description),
    medicineId: num(r.medicineId), medicineName: text(r.medicineName), dose: text(r.dose), route: type === 'TREATMENT' ? toRoute(r.route) : undefined,
    courseDays: num(r.courseDays), withdrawalDays: num(r.withdrawalDays), veterinaryAdvice: text(r.veterinaryAdvice), withdrawalEndDate: text(r.withdrawalEndDate),
  }
  row.details = describe(row)
  return row
}

export function mapHealthCaseRow(raw: unknown, now: string): HealthCaseRow {
  const r = asRecord(raw)
  const openedAt = text(r.openedAt) ? toFarmTime(r.openedAt) : `${textValue(r.openedDate)}T00:00`
  return {
    id: num(r.id) ?? 0, caseCode: textValue(r.caseCode), cattleCode: textValue(r.cattleCode), cattleName: '', breed: textValue(r.breed), sex: r.sex === 'FEMALE' ? 'Cái' : r.sex === 'MALE' ? 'Đực' : '',
    penCode: textValue(r.penCode), penName: textValue(r.penName), diagnosis: textValue(r.diagnosis), signs: textValue(r.signs), suspectedContagious: r.suspectedContagious === true,
    severity: pick(SEVERITIES, r.severity, 'MILD'), openedDate: textValue(r.openedDate, dateOf(openedAt)), openedAt, status: pick(STATUSES, r.status, 'OPEN'), chronicSince: text(r.chronicSince),
    outcome: pickOptional(OUTCOMES, r.outcome), treatmentCount: num(r.treatmentCount) ?? 0, day: num(r.dayN) ?? caseDay(openedAt, now), version: num(r.version) ?? 0,
  }
}

export function mapHealthCaseCard(raw: unknown, cattleCode: string, now: string, closed = false): { card: HealthCaseCard; rows: HealthTimelineRow[]; ref: CaseRef } {
  const c = asRecord(raw)
  const id = num(c.id) ?? 0
  const caseCode = textValue(c.caseCode)
  const rows = (Array.isArray(c.timeline) ? c.timeline : []).map((t) => mapTimelineRow(t as HealthTimelineDto, caseCode))
  const openedAt = text(c.openedAt) ? toFarmTime(c.openedAt) : `${textValue(c.openedDate)}T00:00`
  const latestEntryAt = text(c.latestEntryAt) ? toFarmTime(c.latestEntryAt) : openedAt
  const openingSigns = textValue(c.openingSigns)
  const card: HealthCaseCard = closed ? {
    id, caseCode, status: 'CLOSED', severity: pick(SEVERITIES, c.severity, 'MILD'), diagnosis: textValue(c.diagnosis), signs: openingSigns, openingSigns, suspectedContagious: false,
    openedAt: `${textValue(c.openedDate)}T00:00`, openedDate: textValue(c.openedDate), outcome: pickOptional(OUTCOMES, c.outcome), closedAt: text(c.closedDate) ? `${textValue(c.closedDate)}T00:00` : undefined,
    treatmentCount: 0, day: 0, withdrawalEndDate: null, latestEntryAt: `${textValue(c.openedDate)}T00:00`, version: 0,
  } : {
    id, caseCode, status: pick(STATUSES, c.status, 'OPEN'), severity: pick(SEVERITIES, c.severity, 'MILD'), diagnosis: textValue(c.diagnosis), signs: openingSigns, openingSigns,
    suspectedContagious: c.suspectedContagious === true, openedAt, openedDate: textValue(c.openedDate, dateOf(openedAt)), chronicSince: text(c.chronicSince),
    treatmentCount: num(c.treatmentCount) ?? rows.filter((r) => r.type === 'TREATMENT' && r.status === 'VALID').length, day: num(c.dayN) ?? caseDay(openedAt, now),
    withdrawalEndDate: latestWithdrawalEnd(rows), latestEntryAt, version: num(c.version) ?? 0,
  }
  return { card, rows, ref: closed ? { caseCode, cattleCode } : { caseCode, cattleCode, openedAt, latestEntryAt } }
}

export function mapPendingExit(raw: unknown, cattleCode: string): PendingExit | null {
  if (!raw) return null
  const pending = asRecord(raw)
  const missing = textValue(pending.lossKind).toUpperCase() === 'MISSING'
  return { id: num(pending.voucherId) ?? 0, cattleCode, caseCode: textValue(pending.caseCode), type: missing ? 'OTHER' : 'DEATH', reason: missing ? 'Mất tích' : 'Chết', date: textValue(pending.exitDate), reportedBy: '', status: 'PENDING' }
}

export function mapHealthCaseResult(raw: unknown, kind: CaseResultKind, fallback: CaseRef | undefined, deathVoucher: PendingExit | null = null): HealthCaseResult {
  const r = asRecord(raw)
  return {
    id: num(r.id) ?? 0, caseCode: textValue(r.caseCode, fallback?.caseCode), cattleCode: textValue(r.cattleCode, fallback?.cattleCode), status: pick(STATUSES, r.status, 'OPEN'), version: num(r.version) ?? 0,
    observationId: nullableNum(r.observationId), healthState: pick(STATES, r.healthState, 'MONITORING'), kind, outcome: pickOptional(OUTCOMES, r.outcome), deathVoucher,
  }
}

export function mapTreatmentResult(raw: unknown, caseId: number, caseCode: string, defaultCourseDays: number | null | undefined): TreatmentResult {
  const r = asRecord(raw)
  return {
    id: num(r.id) ?? 0, caseId, caseCode, caseVersion: num(r.caseVersion) ?? 0, caseStatus: pick(STATUSES, r.caseStatus, 'OPEN'), withdrawalEndDate: textValue(r.withdrawalEndDate),
    courseDays: num(r.courseDays) ?? defaultCourseDays ?? 1, medicineName: textValue(r.medicineName), healthState: pick(STATES, r.healthState, 'UNDER_TREATMENT'), returnedToOpen: r.returnedToOpen === true,
  }
}

export function mapRecordResult(raw: unknown, action: RecordResult['action'], entry: EntryRef, cattleCode: string): RecordResult {
  const r = asRecord(raw)
  return {
    id: num(r.id) ?? 0, status: textValue(r.status).toUpperCase() === 'VOIDED' ? 'VOIDED' : 'VALID', version: num(r.version) ?? 0, healthState: pick(STATES, r.healthState, 'MONITORING'),
    action, recordType: entry.type === 'TREATMENT' ? 'TREATMENT' : 'FOLLOW_UP', cattleCode, withdrawalBefore: text(r.withdrawalBefore) ?? null, withdrawalAfter: text(r.withdrawalAfter) ?? null,
  }
}

export function toOpenCaseRequest(cattleId: number, cmd: { existingCaseId?: number; expectedVersion?: number; observedAt: string; observerId?: number; temperatureC: number | null; signs: string; diagnosis: string; suspectedContagious: boolean; severity: string }): HealthOpenCaseRequestDto {
  return { cattleId, existingCaseId: cmd.existingCaseId ?? null, expectedVersion: cmd.expectedVersion ?? null, observedAt: toInstant(cmd.observedAt), observerId: cmd.observerId ?? null, temperatureC: cmd.temperatureC, signs: cmd.signs.trim(), diagnosis: cmd.diagnosis.trim() || null, suspectedContagious: cmd.suspectedContagious, severity: cmd.severity || null }
}
export function toFollowUpRequest(cmd: { expectedVersion?: number; observedAt: string; temperatureC: number | null; progress: string; description: string; observerId?: number }): HealthFollowUpRequestDto {
  return { expectedVersion: cmd.expectedVersion ?? null, observedAt: toInstant(cmd.observedAt), temperatureC: cmd.temperatureC, progress: cmd.progress || null, description: cmd.description.trim(), observerId: cmd.observerId ?? null }
}
export function toTreatmentRequest(cmd: { expectedVersion?: number; medicineId: number | null; treatmentTime: string; dose: string; route: string; courseDays: number | null; withdrawalDays: number | null; performerBody: Record<string, unknown>; veterinaryAdvice: string }): HealthTreatmentRequestDto {
  const performer = cmd.performerBody.performerId !== undefined ? { performerId: cmd.performerBody.performerId as number } : { performerName: (cmd.performerBody.performerName as string | null | undefined) ?? null }
  return { expectedVersion: cmd.expectedVersion ?? null, medicineId: cmd.medicineId, administeredAt: toInstant(cmd.treatmentTime), dose: cmd.dose.trim(), route: cmd.route || null, courseDays: cmd.courseDays, withdrawalDays: cmd.withdrawalDays, ...performer, veterinaryAdvice: cmd.veterinaryAdvice.trim() || null }
}
export function toStatusRequest(cmd: { expectedVersion?: number; action: string; progressText: string; progress?: string; diagnosis: string; suspectedContagious: boolean; outcome?: string; closedAt?: string; confirmedById?: number }): HealthStatusRequestDto {
  const closing = cmd.action === 'CLOSE'
  return { expectedVersion: cmd.expectedVersion ?? null, action: cmd.action, latestProgress: cmd.progressText.trim() || null, progress: cmd.progress || null, suspectedDiagnosis: cmd.diagnosis.trim() || null, suspectedContagious: cmd.suspectedContagious, outcome: closing ? cmd.outcome || null : null, closedAt: closing && cmd.closedAt ? toInstant(cmd.closedAt) : null, confirmedById: cmd.confirmedById ?? null }
}
export function toObservationCorrectionRequest(cmd: { expectedVersion?: number; reason: string; observedAt?: string; temperatureC?: number | null; description?: string; progress?: string; observerId?: number }): HealthObservationCorrectionRequestDto {
  return { expectedVersion: cmd.expectedVersion ?? null, reason: cmd.reason.trim(), observedAt: cmd.observedAt ? toInstant(cmd.observedAt) : null, temperatureC: cmd.temperatureC === undefined ? null : cmd.temperatureC, signs: cmd.description?.trim() || null, progress: cmd.progress || null, observerId: cmd.observerId ?? null }
}
export function toTreatmentCorrectionRequest(cmd: { expectedVersion?: number; reason: string; medicineId?: number | null; treatmentTime?: string; dose?: string; route?: string; courseDays?: number | null; withdrawalDays?: number | null; performerBody?: Record<string, unknown> }): HealthTreatmentCorrectionRequestDto {
  const performer = cmd.performerBody?.performerId !== undefined ? { performerId: cmd.performerBody.performerId as number } : { performerName: (cmd.performerBody?.performerName as string | null | undefined) ?? null }
  return { expectedVersion: cmd.expectedVersion ?? null, reason: cmd.reason.trim(), medicineId: cmd.medicineId ?? null, administeredAt: cmd.treatmentTime ? toInstant(cmd.treatmentTime) : null, dose: cmd.dose?.trim() || null, route: cmd.route || null, courseDays: cmd.courseDays ?? null, withdrawalDays: cmd.withdrawalDays ?? null, ...performer }
}
export const toVoidRequest = (cmd: { expectedVersion?: number; reason: string }): HealthVoidRequestDto => ({ expectedVersion: cmd.expectedVersion ?? null, reason: cmd.reason.trim() })

export type { CaseRef, EntryRef }
