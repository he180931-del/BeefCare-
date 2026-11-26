import { asRecord, asRows, textValue } from '../../../shared/api/parse'
import { toFarmLocal } from '../../../shared/lib/date/farmTime'
import { breedingDetails, calvingSummary } from '../domain/reproductionRules'
import { SIGN_CODE } from './reproductionDto'
import type {
  BreedingEligibility, CalfOutcome, CalvingRecord, DataSource, DeclaredPregnancy, OpenPregnancy, ReproductionEvent,
  ReproductionEventType, ReproductionFemale, ReproductiveStatus,
} from '../types'
const ID = { event: 'e', update: 'u', calving: 'c', calf: 'f', episode: 'p' } as const
const uid = (kind: keyof typeof ID, id: unknown) => `${ID[kind]}-${num(id) ?? 0}`

export function resolveReproductionSource(events: readonly ReproductionEvent[], sourceId: string, sourceType: string | null) {
  const kind = sourceType === 'CALVING_EVENT' ? 'CALVING' : sourceType
  const idType = kind === 'CALVING' ? 'calving' : kind === 'PREGNANCY_UPDATE' ? 'update' : 'event'
  return events.find((event) => (event.id === sourceId || event.id === uid(idType, sourceId))
    && (kind == null || event.type === kind))
}
export const backendId = (value: string | null | undefined, kind: keyof typeof ID): number | undefined => {
  const match = new RegExp(`^${ID[kind]}-(\\d+)$`).exec(value ?? '')
  return match ? Number(match[1]) : undefined
}

export const num = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value)
  return undefined
}
export const text = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() !== '' ? value : undefined)
const SIGN_LABEL = Object.fromEntries(Object.entries(SIGN_CODE).map(([label, code]) => [code, label])) as Record<string, string>
const METHOD_IN: Record<string, string> = { NATURAL: 'NATURAL_SERVICE', AI: 'ARTIFICIAL_INSEMINATION' }
const RESULT_TEXT: Record<string, string> = { PREGNANT: 'Có thai', NOT_PREGNANT: 'Không có thai', INCONCLUSIVE: 'Chưa xác định' }
const CHECK_METHOD_TEXT: Record<string, string> = { ULTRASOUND: 'Siêu âm', RECTAL: 'Khám trực tràng', OBSERVATION: 'Quan sát – không lên giống lại', OTHER: 'Khác' }
const UPDATE_TEXT: Record<string, string> = { OBSERVATION: 'Theo dõi', COMPLICATION: 'Biến chứng', LOSS: 'Sẩy thai' }
const STATUSES: ReproductiveStatus[] = ['AWAITING_BREEDING', 'IN_ESTRUS', 'BRED', 'PREGNANT', 'POST_CALVING']
/** "Việc tiếp theo" của A1 (mã) → nhãn cột SCR-38. */
export const NEXT_ACTION_TEXT: Record<string, string> = {
  CONSIDER_BREEDING: 'Cân nhắc phối', PREGNANCY_CHECK: 'Khám thai', PREPARE_CALVING_PEN: 'Chuẩn bị chuồng đẻ', MONITOR_WEIGHT: 'Theo dõi cân',
}
const EVENT_SUMMARY: Record<ReproductionEventType, string> = {
  ESTRUS: 'Động dục', BREEDING: 'Phối giống', PREGNANCY_CHECK: 'Khám thai', PREGNANCY_UPDATE: 'Diễn biến thai', CALVING: 'Sự kiện đẻ',
}
const pickStatus = (value: unknown): ReproductiveStatus | null => (STATUSES as string[]).includes(textValue(value)) ? value as ReproductiveStatus : null
const source = (value: unknown): DataSource => (['DIRECT_OBSERVATION', 'FARM_NOTEBOOK', 'EXTERNAL_REPORT'].includes(textValue(value)) ? value as DataSource : 'DIRECT_OBSERVATION')
const personName = (value: unknown) => textValue(asRecord(value).name)

/** Tiêu chí GBR-55 của A1 / A2 → dạng BreedingEligibility của màn hình. */
export function mapEligibility(raw: unknown): BreedingEligibility | null {
  const e = asRecord(raw)
  const criteria = asRows(e.criteria)
  if (!criteria.length && e.met === undefined) return null
  const of = (name: string) => asRecord(criteria.find((c) => c.name === name))
  const age = of('MINIMUM_AGE'), weight = of('MINIMUM_WEIGHT'), health = of('OPEN_HEALTH_CASE'), postpartum = of('POSTPARTUM_INTERVAL')
  const failed = criteria.filter((c) => c.met === false).map((c) => textValue(c.name))
  const label: Record<string, string> = { MINIMUM_AGE: 'tuổi', MINIMUM_WEIGHT: 'cân nặng', OPEN_HEALTH_CASE: 'sức khỏe', POSTPARTUM_INTERVAL: 'sau đẻ' }
  return {
    status: e.met === false || failed.length ? 'NOT_MET' : 'MET',
    minimumAgeMet: age.met !== false, minimumWeightMet: weight.met !== false, noOpenHealthCase: health.met !== false,
    requiredAgeMonths: num(age.required) ?? 0, actualAgeMonths: num(age.value) ?? 0,
    requiredWeightKg: num(weight.required) ?? 0, actualWeightKg: num(weight.value) ?? null,
    failedConditions: failed.map((name) => label[name] ?? name),
    ...(postpartum.name ? { postpartumMet: postpartum.met !== false, requiredPostpartumDays: num(postpartum.required) ?? 45, daysSinceCalving: num(postpartum.value) ?? 0 } : {}),
  }
}

function mapCalf(raw: unknown): CalfOutcome {
  const c = asRecord(raw)
  const registration = textValue(c.registration)
  const live = c.outcome === 'LIVE'
  return {
    id: uid('calf', c.calfId), number: num(c.calfNo) ?? 0, outcome: live ? 'LIVE' : 'STILLBORN',
    sex: c.sex === 'MALE' || c.sex === 'FEMALE' ? c.sex : 'UNKNOWN', weightKg: num(c.birthWeightKg) ?? null,
    weightBasis: c.weightBasis === 'MEASURED' || c.weightBasis === 'ESTIMATED' ? c.weightBasis : null, earTag: text(c.tagCode) ?? null,
    penId: num(asRecord(c.pen).id) === undefined ? null : String(num(asRecord(c.pen).id)), penCode: text(asRecord(c.pen).code) ?? null,
    breed: text(asRecord(c.breed).name) ?? null,
    registrationChoice: !live ? null : registration === 'REGISTERED' ? 'REGISTER_NOW' : 'DRAFT',
    registrationStatus: registration === 'REGISTERED' ? 'REGISTERED' : live && registration === 'PENDING_CONFIRMATION' ? 'PENDING_CONFIRMATION' : null,
    productionPurpose: text(asRecord(c.purpose).name) ?? null, status: c.status === 'VOIDED' ? 'VOIDED' : 'VALID',
    cattleCode: text(c.cattleCode) ?? null, version: num(c.version) ?? 0,
  }
}

export function mapCalving(raw: unknown, recorded: { recordedAt: string; recorder: string } | undefined): CalvingRecord {
  const c = asRecord(raw)
  return {
    id: uid('calving', c.calvingId), birthAt: toFarmLocal(c.at), recordedAt: recorded?.recordedAt ?? '', recorder: recorded?.recorder ?? '',
    attendant: personName(c.attendant) || undefined, dataSource: source(c.source), pregnancyId: num(c.episodeId) === undefined ? null : uid('episode', c.episodeId),
    course: c.course === 'ASSISTED' || c.course === 'CAESAREAN' ? c.course : 'NORMAL',
    damCondition: c.damCondition === 'NEEDS_MONITORING' ? 'MONITORING' : c.damCondition === 'CRITICAL' ? 'CRITICAL' : 'GOOD',
    retainedPlacenta: c.retainedPlacenta === true, calves: asRows(c.calves).map((calf) => mapCalf(calf)),
    status: c.status === 'VOIDED' ? 'VOIDED' : 'VALID', corrected: c.corrected === true, version: num(c.version) ?? 0,
  }
}

/** Một dòng dòng thời gian A2 → sự kiện của màn hình (summary / details dựng như chế độ local). */
export function mapTimelineRow(raw: unknown, services = 0): ReproductionEvent {
  const r = asRecord(raw)
  const kind = textValue(r.kind) as ReproductionEventType
  const id = kind === 'PREGNANCY_UPDATE' ? uid('update', r.id) : kind === 'CALVING' ? uid('calving', r.id) : uid('event', r.id)
  const event: ReproductionEvent = {
    id, type: kind, occurredAt: toFarmLocal(r.at), recordedAt: toFarmLocal(r.recordedAt), recorder: textValue(r.recordedBy),
    status: r.status === 'VOIDED' ? 'VOIDED' : 'VALID', dataSource: source(r.source), summary: EVENT_SUMMARY[kind] ?? kind, details: '',
    corrected: r.corrected === true, voidReason: text(r.voidReason), version: num(r.version) ?? 0,
    pregnancyId: num(r.episodeId) === undefined ? null : uid('episode', r.episodeId),
  }
  if (kind === 'ESTRUS') {
    event.signs = Array.isArray(r.signs) ? (r.signs as unknown[]).map((s) => SIGN_LABEL[textValue(s)] ?? textValue(s)) : []
    event.description = text(r.description)
    event.observer = personName(r.observer) || undefined
    event.details = event.description || event.signs?.join(', ') || 'Chưa có mô tả dấu hiệu'
  } else if (kind === 'BREEDING') {
    const sire = asRecord(r.sire)
    event.method = METHOD_IN[textValue(r.method)] ?? text(r.method)
    event.sireLabel = text(sire.code) ? [text(sire.name), text(sire.code)].filter(Boolean).join(' · ') : text(asRecord(r.sireBreed).name) ?? text(r.sireBreedText)
    event.semenCode = text(r.semenCode)
    event.semenSupplier = text(r.semenSupplier)
    event.performer = personName(r.performer) || undefined
    event.linkedEstrusId = num(r.linkedEventId) === undefined ? null : uid('event', r.linkedEventId)
    event.expectedCalvingAt = text(r.tentativeCalvingDate) ? `${r.tentativeCalvingDate}T00:00` : null
    event.expectedDateBasis = event.expectedCalvingAt ? 'TENTATIVE' : null
    event.description = text(r.description)
    event.summary = services ? `Phối giống · lần ${services}` : 'Phối giống'
    event.details = breedingDetails(event)
  } else if (kind === 'PREGNANCY_CHECK') {
    event.result = (['PREGNANT', 'NOT_PREGNANT', 'INCONCLUSIVE'].includes(textValue(r.result)) ? r.result : undefined) as ReproductionEvent['result']
    event.method = text(r.method)
    event.examiner = personName(r.examiner) || undefined
    event.estimatedMonths = num(r.estimatedMonths) ?? null
    event.linkedBreedingId = num(r.linkedEventId) === undefined ? null : uid('event', r.linkedEventId)
    event.description = text(r.description)
    event.summary = event.result ? `Khám thai · ${RESULT_TEXT[event.result]}` : 'Khám thai'
    event.details = [event.result ? RESULT_TEXT[event.result] : null, event.method ? CHECK_METHOD_TEXT[event.method] ?? event.method : null, event.examiner].filter(Boolean).join(' · ')
  } else if (kind === 'PREGNANCY_UPDATE') {
    event.updateType = (['OBSERVATION', 'COMPLICATION', 'LOSS'].includes(textValue(r.updateType)) ? r.updateType : 'OBSERVATION') as ReproductionEvent['updateType']
    event.description = text(r.description)
    event.linkedHealthCaseId = num(r.healthCaseId) === undefined ? null : String(num(r.healthCaseId))
    event.summary = `Diễn biến thai · ${UPDATE_TEXT[event.updateType ?? 'OBSERVATION']}`
    event.details = [UPDATE_TEXT[event.updateType ?? 'OBSERVATION'], event.description, text(r.healthCaseCode) ? `ca ${r.healthCaseCode}` : null].filter(Boolean).join(' · ')
  }
  return event
}

const herdStatus = (value: unknown): ReproductionFemale['herdStatus'] => (['ACTIVE', 'EXITED', 'VOIDED'].includes(textValue(value)) ? value as ReproductionFemale['herdStatus'] : 'ACTIVE')
const lifeStage = (value: unknown): ReproductionFemale['lifeStage'] => (value === 'YOUNG_STOCK' || value === 'ADULT' ? value : 'OTHER')
const purposeType = (value: unknown): ReproductionFemale['purposeType'] => (value === 'BREEDING' || value === 'UNDECIDED' ? value : 'OTHER')
const dateTime = (date: unknown) => (text(date) ? `${date}T00:00` : null)

/** A2 (FE-11) / A1 (FE-12) → hồ sơ sinh sản của màn hình. */
export function mapProfile(raw: unknown): ReproductionFemale {
  const p = asRecord(raw)
  const breed = asRecord(p.breed), pen = asRecord(p.pen)
  const ind = asRecord(p.indicators)
  // Thứ tự phối trong cùng chu kỳ để đặt nhãn "Phối giống · lần n" (bản ghi VALID, tính từ cũ đến mới).
  const rows = asRows(p.timeline)
  const breedings = rows.filter((r) => r.kind === 'BREEDING' && r.status !== 'VOIDED').sort((a, b) => textValue(a.at).localeCompare(textValue(b.at)))
  const events = rows.map((r) => mapTimelineRow(r, r.kind === 'BREEDING' ? breedings.indexOf(r) + 1 : 0))
  const calvingRows = asRows(p.calvings)
  const calvings = calvingRows.map((c) => {
    const row = events.find((event) => event.id === uid('calving', c.calvingId))
    const record = mapCalving(c, row ? { recordedAt: row.recordedAt, recorder: row.recorder } : undefined)
    if (row) row.details = calvingSummary(record.calves)
    return record
  })
  const preg = asRecord(p.currentPregnancy)
  const check = events.find((event) => event.id === uid('event', preg.confirmingCheckId))
  const openPregnancy: OpenPregnancy | null = num(preg.episodeId) === undefined ? null : {
    id: uid('episode', preg.episodeId), pregnancyNumber: num(preg.parity) ?? 0,
    linkedBreedingId: num(preg.linkedBreedingId) === undefined ? null : uid('event', preg.linkedBreedingId),
    confirmedAt: toFarmLocal(preg.confirmedAt), expectedCalvingAt: dateTime(preg.expectedDate),
    expectedDateBasis: (['CONFIRMED', 'ESTIMATED', 'TENTATIVE'].includes(textValue(preg.basis)) ? preg.basis : null) as OpenPregnancy['expectedDateBasis'],
    estimatedMonths: check?.estimatedMonths ?? null, status: 'OPEN', version: num(preg.version) ?? 0,
  }
  const window = asRecord(p.window)
  const status = pickStatus(p.status)
  const eligibility = mapEligibility(p.eligibility)
  const latestBreeding = asRecord(p.latestBreeding)
  const declaredPregnancy = mapDeclaredPregnancy(p.declaredPregnancy)
  return {
    cattleId: String(num(p.cattleId) ?? ''), cattleCode: textValue(p.code), name: text(p.name) ?? '—', earTag: textValue(p.earTag), sex: 'FEMALE',
    breed: textValue(breed.name), penId: num(pen.id) === undefined ? '' : String(num(pen.id)), penCode: textValue(pen.code), penName: textValue(pen.name),
    herdStatus: herdStatus(p.herdStatus), lifeStage: lifeStage(p.lifeStage), purposeType: purposeType(p.purposeType),
    applicable: p.applicable === true, status, statusAt: text(p.statusSince) ? toFarmLocal(p.statusSince) : null,
    ageMonths: num(p.ageMonths) ?? 0, latestWeightKg: num(asRecord(p.latestWeight).kg) ?? null, parity: num(p.parity) ?? 0,
    earlierCalvings: Math.max(0, (num(p.parity) ?? 0) - calvings.filter((c) => c.status === 'VALID').length),
    servicesInCurrentCycle: num(p.servicesInCycle) ?? 0, lastCalvingAt: text(asRecord(p.lastCalving).at) ? toFarmLocal(asRecord(p.lastCalving).at) : null,
    breedingWindow: window.configured === true ? { from: toFarmLocal(window.from), to: toFarmLocal(window.to) } : null,
    nextAction: declaredPregnancy ? NEXT_ACTION_TEXT.PREGNANCY_CHECK
      : status === 'IN_ESTRUS' || status === 'AWAITING_BREEDING' || status === 'POST_CALVING' ? NEXT_ACTION_TEXT.CONSIDER_BREEDING
      : status === 'BRED' ? NEXT_ACTION_TEXT.PREGNANCY_CHECK : status === 'PREGNANT' ? NEXT_ACTION_TEXT.PREPARE_CALVING_PEN : '',
    dueAt: status === 'BRED' ? dateTime(latestBreeding.checkFrom) : status === 'PREGNANT' ? openPregnancy?.expectedCalvingAt ?? null : null,
    eligibility, openHealthCase: eligibility ? !eligibility.noOpenHealthCase : false, openPregnancy,
    events: events.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)), calvings: calvings.sort((a, b) => b.birthAt.localeCompare(a.birthAt)),
    revisions: [],
    indicators: {
      ageAtFirstCalvingMonths: num(ind.ageAtFirstCalvingMonths) ?? null, lastCalvingIntervalDays: num(ind.lastIntervalDays) ?? null,
      daysSinceLastCalving: num(ind.daysSinceCalving) ?? null, daysOpen: num(ind.daysOpen) ?? null,
      conceptionSummary: `${num(ind.conceptions) ?? 0} lần có thai / ${num(ind.services) ?? 0} lần phối`, overdueForConception: ind.overdue === true,
    },
    declaredPregnancy, version: num(p.version) ?? 0,
  }
}

/** D82: khai báo mang thai lúc nhập (`declaredPregnancy` của A1 / A2); thiếu ngày nhập coi như không có. */
export function mapDeclaredPregnancy(raw: unknown): DeclaredPregnancy | null {
  const d = asRecord(raw)
  const entryDate = dateTime(d.entryDate)
  return entryDate ? { months: num(d.estMonths) ?? null, entryDate } : null
}

/** Một dòng A1 → dòng SCR-38 (đủ trường cho lọc, tab, ô thống kê và cột của màn danh sách). */
export function mapWorklistItem(raw: unknown): ReproductionFemale {
  const i = asRecord(raw)
  const breed = asRecord(i.breed), pen = asRecord(i.pen), due = asRecord(i.due), latest = asRecord(i.latestEvent)
  const status = pickStatus(i.status)
  const type = textValue(latest.type) as ReproductionEventType
  const expected = dateTime(i.expectedCalvingDate)
  return {
    cattleId: String(num(i.cattleId) ?? ''), cattleCode: textValue(i.code), name: text(i.name) ?? '—', earTag: textValue(i.earTag), sex: 'FEMALE',
    breed: textValue(breed.name), penId: num(pen.id) === undefined ? '' : String(num(pen.id)), penCode: textValue(pen.code), penName: textValue(pen.name),
    herdStatus: 'ACTIVE', lifeStage: 'OTHER', purposeType: 'OTHER', applicable: true, status,
    statusAt: text(i.statusSince) ? toFarmLocal(i.statusSince) : null, ageMonths: num(i.ageMonths) ?? 0, latestWeightKg: num(i.latestWeightKg) ?? null,
    parity: 0, earlierCalvings: 0, servicesInCurrentCycle: 0, lastCalvingAt: null,
    breedingWindow: text(due.windowFrom) && text(due.windowTo) ? { from: toFarmLocal(due.windowFrom), to: toFarmLocal(due.windowTo) } : null,
    nextAction: NEXT_ACTION_TEXT[textValue(i.nextAction)] ?? textValue(i.nextAction), dueAt: dateTime(due.date),
    eligibility: mapEligibility(i.eligibility), openHealthCase: false,
    openPregnancy: status === 'PREGNANT' ? {
      id: '', pregnancyNumber: 0, linkedBreedingId: null, confirmedAt: '', expectedCalvingAt: expected,
      expectedDateBasis: (['CONFIRMED', 'ESTIMATED', 'TENTATIVE'].includes(textValue(i.expectedBasis)) ? i.expectedBasis : null) as OpenPregnancy['expectedDateBasis'],
      estimatedMonths: null, status: 'OPEN',
    } : null,
    events: type ? [{
      id: `latest-${num(i.cattleId) ?? 0}`, type, occurredAt: toFarmLocal(latest.at), recordedAt: '', recorder: '', status: 'VALID',
      summary: EVENT_SUMMARY[type] ?? type, version: 0,
    }] : [],
    calvings: [], revisions: [],
    indicators: { ageAtFirstCalvingMonths: null, lastCalvingIntervalDays: null, daysSinceLastCalving: null, daysOpen: null, conceptionSummary: '', overdueForConception: false },
    declaredPregnancy: mapDeclaredPregnancy(i.declaredPregnancy), version: num(i.version) ?? 0,
  }
}
