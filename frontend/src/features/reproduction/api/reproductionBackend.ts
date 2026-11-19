import { BackendError } from '../../../shared/api/backendClient'
import { asRecord, asRows, textValue } from '../../../shared/api/parse'
import { type BackendTransport } from '../../../shared/api/backendTransport'
import { fromFarmLocal, toFarmLocal } from '../../../shared/lib/date/farmTime'
import { ReproductionValidationError, breedingDetails, calvingSummary, formatDate, validateReproductionCommand } from '../domain/reproductionRules'
import type {
  BreedingEligibility, CalfOutcome, CalvingCommand, CalvingRecord, DataSource, OpenPregnancy, ReproductionCommand, ReproductionEvent,
  ReproductionEventType, ReproductionFemale, ReproductionFormOptions, ReproductionIssue, ReproductiveStatus,
} from '../types'

/**
 * Adapter FE-11 / FE-12 cho chế độ backend (không bao giờ đọc mock). Spec FE-11 §7 A1–A6, FE-12 §7 A1–A8:
 * A1 GET /reproduction-worklist · A2 GET /cattle/{id}/reproduction-history · A3 POST /cattle/{id}/estrus-events
 * · A4 POST …/breeding-events · FE-12 A2 POST …/pregnancy-checks · A3 POST /pregnancy-episodes/{id}/updates · A4 POST /calvings
 * · sửa / hủy: /reproduction-events/{id}, /pregnancy-updates/{id}, /calvings/{id}, /calf-outcomes/{id} + /correction | /void.
 * Lựa chọn của popup: /members, /cattle?sex=MALE, /catalogues/breeds, /pens, /catalogues/production-purposes, /health-cases/cattle/{id}.
 * Giờ theo múi giờ trại; mỗi lệnh có Idempotency-Key (transport) và version của bản ghi; lỗi → tiếng Việt, theo từng ô.
 */

/** Mã bản ghi phía UI: tiền tố theo bảng để không trùng giữa sự kiện, diễn biến thai, lần đẻ, bê và thai. */
const ID = { event: 'e', update: 'u', calving: 'c', calf: 'f', episode: 'p' } as const
const uid = (kind: keyof typeof ID, id: unknown) => `${ID[kind]}-${num(id) ?? 0}`

export function resolveReproductionSource(events: readonly ReproductionEvent[], sourceId: string, sourceType: string | null) {
  const kind = sourceType === 'CALVING_EVENT' ? 'CALVING' : sourceType
  const idType = kind === 'CALVING' ? 'calving' : kind === 'PREGNANCY_UPDATE' ? 'update' : 'event'
  return events.find((event) => (event.id === sourceId || event.id === uid(idType, sourceId))
    && (kind == null || event.type === kind))
}
const backendId = (value: string | null | undefined, kind: keyof typeof ID): number | undefined => {
  const match = new RegExp(`^${ID[kind]}-(\\d+)$`).exec(value ?? '')
  return match ? Number(match[1]) : undefined
}

const num = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value)
  return undefined
}
const text = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() !== '' ? value : undefined)
const rowsOf = (body: unknown, ...keys: string[]) => {
  if (Array.isArray(body)) return asRows(body)
  const record = asRecord(body)
  for (const key of keys) if (Array.isArray(record[key])) return asRows(record[key])
  return []
}
const query = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== '') search.set(key, String(value))
  const s = search.toString()
  return s ? `?${s}` : ''
}

export const SIGN_CODE: Record<string, string> = {
  'Đứng yên cho nhảy': 'STANDING', 'Nhảy lên con khác': 'MOUNTING', 'Kêu rống': 'BELLOWING', 'Chảy dịch nhờn trong': 'MUCUS', 'Âm hộ sưng đỏ': 'SWOLLEN_VULVA',
}
const SIGN_LABEL = Object.fromEntries(Object.entries(SIGN_CODE).map(([label, code]) => [code, label])) as Record<string, string>
const METHOD_IN: Record<string, string> = { NATURAL: 'NATURAL_SERVICE', AI: 'ARTIFICIAL_INSEMINATION' }
const METHOD_OUT: Record<string, string> = { NATURAL_SERVICE: 'NATURAL', ARTIFICIAL_INSEMINATION: 'AI' }
const RESULT_TEXT: Record<string, string> = { PREGNANT: 'Có thai', NOT_PREGNANT: 'Không có thai', INCONCLUSIVE: 'Chưa xác định' }
const CHECK_METHOD_TEXT: Record<string, string> = { ULTRASOUND: 'Siêu âm', RECTAL: 'Khám trực tràng', OTHER: 'Khác' }
const UPDATE_TEXT: Record<string, string> = { OBSERVATION: 'Theo dõi', COMPLICATION: 'Biến chứng', LOSS: 'Sẩy thai' }
const ROLE_TEXT: Record<string, string> = { OWNER: 'Chủ trại', MANAGER: 'Quản lý', TECHNICIAN: 'Kỹ thuật viên' }
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
  const age = of('MINIMUM_AGE'), weight = of('MINIMUM_WEIGHT'), health = of('OPEN_HEALTH_CASE')
  const failed = criteria.filter((c) => c.met === false).map((c) => textValue(c.name))
  const label: Record<string, string> = { MINIMUM_AGE: 'tuổi', MINIMUM_WEIGHT: 'cân nặng', OPEN_HEALTH_CASE: 'sức khỏe' }
  return {
    status: e.met === false || failed.length ? 'NOT_MET' : 'MET',
    minimumAgeMet: age.met !== false, minimumWeightMet: weight.met !== false, noOpenHealthCase: health.met !== false,
    requiredAgeMonths: num(age.required) ?? 0, actualAgeMonths: num(age.value) ?? 0,
    requiredWeightKg: num(weight.required) ?? 0, actualWeightKg: num(weight.value) ?? null,
    failedConditions: failed.map((name) => label[name] ?? name),
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
  return {
    cattleId: String(num(p.cattleId) ?? ''), cattleCode: textValue(p.code), name: text(p.name) ?? '—', earTag: textValue(p.earTag), sex: 'FEMALE',
    breed: textValue(breed.name), penId: num(pen.id) === undefined ? '' : String(num(pen.id)), penCode: textValue(pen.code), penName: textValue(pen.name),
    herdStatus: herdStatus(p.herdStatus), lifeStage: lifeStage(p.lifeStage), purposeType: purposeType(p.purposeType),
    applicable: p.applicable === true, status, statusAt: text(p.statusSince) ? toFarmLocal(p.statusSince) : null,
    ageMonths: num(p.ageMonths) ?? 0, latestWeightKg: num(asRecord(p.latestWeight).kg) ?? null, parity: num(p.parity) ?? 0,
    earlierCalvings: Math.max(0, (num(p.parity) ?? 0) - calvings.filter((c) => c.status === 'VALID').length),
    servicesInCurrentCycle: num(p.servicesInCycle) ?? 0, lastCalvingAt: text(asRecord(p.lastCalving).at) ? toFarmLocal(asRecord(p.lastCalving).at) : null,
    breedingWindow: window.configured === true ? { from: toFarmLocal(window.from), to: toFarmLocal(window.to) } : null,
    nextAction: status === 'IN_ESTRUS' || status === 'AWAITING_BREEDING' || status === 'POST_CALVING' ? NEXT_ACTION_TEXT.CONSIDER_BREEDING
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
    declaredPregnancyAtEntryMonths: num(p.declaredPregnancyMonths) ?? null, version: num(p.version) ?? 0,
  }
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
    declaredPregnancyAtEntryMonths: null, version: num(i.version) ?? 0,
  }
}

/** Lỗi MSG-FE11-03: popup hỏi lại, rồi gửi `confirmDuplicate`. */
export class ReproductionDuplicateError extends Error {
  constructor(message: string) { super(message); this.name = 'ReproductionDuplicateError' }
}

const FIELD: Record<string, string> = {
  observedAt: 'occurredAt', bredAt: 'occurredAt', checkedAt: 'occurredAt', occurredAt: 'occurredAt', birthAt: 'birthAt',
  tagCode: 'earTag', birthWeightKg: 'weight', weightBasis: 'weightBasis', penId: 'penId', sex: 'sex', purposeId: 'purpose', registration: 'registration',
  outcome: 'outcome', breedId: 'breed',
}
const LABEL: Record<string, string> = {
  occurredAt: 'Thời điểm', birthAt: 'Thời điểm đẻ', method: 'Phương pháp', sireSource: 'Nguồn đực giống', sireCattleId: 'Đực giống trong trại',
  sireBreed: 'Giống tinh / đực giống', sireBreedId: 'Giống tinh / đực giống', semenCode: 'Mã ống tinh / lô tinh', semenSupplier: 'Nhà cung cấp tinh',
  performerName: 'Người thực hiện', observerName: 'Người quan sát', examinerName: 'Người khám', attendantName: 'Người đỡ đẻ', result: 'Kết quả',
  estimatedMonths: 'Số tháng mang thai', details: 'Chi tiết', description: 'Mô tả', note: 'Ghi chú', reason: 'Lý do', type: 'Loại cập nhật',
  healthCaseId: 'Ca sức khỏe liên kết', calves: 'Kết quả bê', earTag: 'Mã thẻ tai / QR', weight: 'Cân sơ sinh', penId: 'Chuồng ban đầu', sex: 'Giới tính',
  purpose: 'Mục đích nuôi', registration: 'Hình thức đăng ký', outcome: 'Kết quả', breed: 'Giống', course: 'Kiểu đẻ', damCondition: 'Tình trạng bò mẹ',
}

/** Lỗi backend → ReproductionValidationError (theo ô, theo bê) hoặc Error tiếng Việt. */
export function mapReproductionError(error: unknown): unknown {
  if (!(error instanceof BackendError)) return error
  const code = textValue(error.code).replace(/^MSG-/, '')
  const p = error.params
  const rawField = textValue(p.field)
  const calfMatch = /^calves\[(\d+)\]\.(\w+)$/.exec(rawField)
  const calf = calfMatch ? Number(calfMatch[1]) : num(p.calf)
  const field = FIELD[calfMatch ? calfMatch[2] : rawField] ?? (calfMatch ? calfMatch[2] : rawField)
  const issue = (message: string): ReproductionValidationError => {
    const item: ReproductionIssue = { message }
    if (field) item.field = field
    if (calf !== undefined) item.calf = calf
    return new ReproductionValidationError([item])
  }
  const prefix = calf !== undefined ? `Bê số ${calf + 1}: ` : ''
  const at = (value: unknown) => (text(value) ? toFarmLocal(value).replace(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2}).*$/, '$3/$2/$1 $4') : textValue(value))
  switch (code) {
    case 'FE11-03': return new ReproductionDuplicateError(`Đã có ${textValue(p.event_type, 'bản ghi')} tương tự của ${textValue(p.cattle_code)} lúc ${textValue(p.time) || at(p.at)}. Vẫn lưu?`)
    case 'FE11-04': return issue('Đực giống phải là một bò đực khác của trại này.')
    case 'FE11-05': return new Error(`${textValue(p.cattle_code)} đang có thai đã xác nhận. Hãy xem lại trạng thái sinh sản trước khi ghi.`)
    case 'FE11-07': return new Error(`Bản ghi này đang được các bản ghi sau dùng (${textValue(p.records)}). Hãy sửa hoặc hủy các bản ghi đó trước.`)
    case 'FE11-10': return issue(`Thời điểm không được sớm hơn ${textValue(p.event, 'sự kiện')} liên kết (${textValue(p.time) || at(p.at)}).`)
    case 'FE11-11': return new Error('Con này không được theo dõi sinh sản. Nếu thực sự đã khám thai hoặc đẻ, hãy ghi từ Thao tác khác.')
    case 'FE12-02': return new Error(`Lần khám này mâu thuẫn với lần khám hoặc thai đã có của ${textValue(p.cattle_code)}. Vui lòng xem lại.`)
    case 'FE12-06': return issue('Hãy thêm ít nhất một kết quả bê.')
    case 'FE12-07': return issue(`${prefix}Cân sơ sinh phải từ 1 đến 80 kg và cần cơ sở đo hoặc ước tính.`)
    case 'FE12-08': return issue(`${prefix}Mã thẻ ${textValue(p.tag_code, textValue(p.code))} đã được dùng trong trại.`)
    case 'FE12-12': return new Error(`Đã có lần đẻ hoặc thay đổi thai cho ${textValue(p.dam_code)}. Vui lòng tải lại và xem lại.`)
    case 'FE04-05': return issue(`${prefix}Chuồng ${textValue(p.pen_code)} không nhận thêm bê: chuồng đang ngừng sử dụng hoặc đã đầy.`)
    case 'FE05-12': return issue(`${prefix}Mục đích SIRE chỉ cho bò đực và mục đích BREEDING chỉ cho bò cái.`)
    case 'COM-07': return issue('Thời điểm không được ở tương lai.')
    case 'COM-15': return issue(`Thời điểm không được trước ngày nhập đàn (${formatDate(textValue(p.date))}).`)
    case 'COM-13': return new Error(`${textValue(p.cattle_code, 'Bò này')} đã rời đàn; không ghi thêm sự kiện.`)
    case 'COM-17': return new Error('Bò đang chờ xác nhận chết / mất; không ghi thêm sự kiện.')
    case 'COM-01': return new Error('Chỉ Chủ trại và Quản lý mới được ghi, sửa hoặc hủy sự kiện sinh sản.')
    case 'COM-05': return new Error('Dữ liệu đã thay đổi hoặc bản ghi không còn hợp lệ. Vui lòng tải lại trang.')
    case 'COM-06': return issue(`${prefix}${LABEL[field] ?? 'Trường này'} là bắt buộc.`)
    case 'COM-10': return issue(`${prefix}${LABEL[field] ?? 'Giá trị'} không hợp lệ.`)
    default: return error.status === 409 ? new Error('Dữ liệu đã thay đổi. Vui lòng tải lại trang.') : error
  }
}

interface Cached { cattleId: number; profile?: ReproductionFemale }

export function createReproductionBackend({ farmId, transport }: { farmId: string | number; transport: BackendTransport }) {
  const path = (suffix: string) => transport.farmPath(farmId, suffix)
  const cache = new Map<string, Cached>()
  let options: Omit<ReproductionFormOptions, 'healthCases'> & { breedIds: Map<string, number>; memberIds: Map<string, number> } | undefined

  async function run<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action()
    } catch (error) {
      throw mapReproductionError(error)
    }
  }
  const instant = (local: string) => fromFarmLocal(local)

  async function cattleId(code: string): Promise<number> {
    const hit = cache.get(code)
    if (hit) return hit.cattleId
    const id = num(asRecord(await transport.get(path(`/cattle/resolve${query({ code })}`))).cattleId)
    if (id === undefined) throw new Error(`Không tìm thấy bò ${code}.`)
    cache.set(code, { cattleId: id })
    return id
  }
  async function profile(code: string): Promise<ReproductionFemale> {
    const id = await cattleId(code)
    const loaded = mapProfile(await transport.get(path(`/cattle/${id}/reproduction-history`)))
    cache.set(code, { cattleId: id, profile: loaded })
    return loaded
  }
  async function known(code: string): Promise<ReproductionFemale> {
    return cache.get(code)?.profile ?? profile(code)
  }

  async function catalogue() {
    if (options) return options
    const [membersBody, siresBody, breedsBody, pensBody, purposesBody] = await Promise.all([
      transport.get(path('/members')), transport.get(path(`/cattle${query({ sex: 'MALE', herdStatus: 'ACTIVE', size: 200 })}`)),
      transport.get(path('/catalogues/breeds')), transport.get(path('/pens')), transport.get(path('/catalogues/production-purposes')),
    ])
    const members = rowsOf(membersBody, 'members', 'items').filter((m) => m.status === undefined || m.status === 'ACTIVE')
      .map((m) => ({ id: String(num(m.userId) ?? num(m.id) ?? ''), name: textValue(m.fullName, textValue(m.email)), role: ROLE_TEXT[textValue(m.role)] ?? textValue(m.role) }))
    const breeds = rowsOf(breedsBody, 'items').filter((b) => b.available !== false).map((b) => ({ id: num(b.id) ?? 0, name: textValue(b.name, textValue(b.code)) }))
    options = {
      members, externalPeople: [],
      sires: rowsOf(siresBody, 'items').map((c) => {
        const code = textValue(c.code, textValue(c.displayCode))
        return { id: String(num(c.id) ?? ''), label: [text(c.name), code, text(c.earTagNumber) ?? text(c.earTag)].filter(Boolean).join(' · ') }
      }),
      breeds: breeds.map((b) => b.name),
      pens: rowsOf(pensBody, 'pens', 'items').filter((p) => p.status === undefined || p.status === 'ACTIVE')
        .map((p) => ({ id: String(num(p.id) ?? ''), code: textValue(p.code), label: `${textValue(p.code)} – ${textValue(p.name, textValue(p.code))}` })),
      purposes: rowsOf(purposesBody, 'items').filter((p) => p.available !== false)
        .map((p) => ({ value: String(num(p.id) ?? ''), type: textValue(p.purposeType), label: textValue(p.name, textValue(p.code)) })),
      breedIds: new Map(breeds.map((b) => [b.name, b.id])),
      memberIds: new Map(members.map((m) => [m.name, Number(m.id)])),
    }
    return options
  }
  /** Tên trong ô "thành viên hoặc người ngoài": khớp thành viên ACTIVE → id, ngược lại là tên ngoài (P1). */
  async function person(name: string | undefined, idKey: string, nameKey: string): Promise<Record<string, unknown>> {
    const value = name?.trim()
    if (!value) return {}
    const id = (await catalogue()).memberIds.get(value)
    return id ? { [idKey]: id } : { [nameKey]: value }
  }
  const breedId = async (name: string | undefined) => (name ? (await catalogue()).breedIds.get(name) : undefined)

  async function eventCommand(code: string, command: ReproductionCommand): Promise<void> {
    const current = await known(code)
    const id = await cattleId(code)
    if (command.type === 'ESTRUS') {
      await transport.command(path(`/cattle/${id}/estrus-events`), {
        expectedCattleVersion: current.version, observedAt: instant(command.occurredAt), ...await person(command.observer, 'observerId', 'observerName'),
        signs: (command.signs ?? []).map((sign) => SIGN_CODE[sign] ?? sign), description: command.description?.trim() || null,
        dataSource: command.dataSource ?? 'DIRECT_OBSERVATION', confirmDuplicate: command.confirmDuplicate === true,
      })
    } else if (command.type === 'BREEDING') {
      const internal = command.sireSource === 'FARM'
      const breed = internal ? undefined : command.externalSireBreed?.trim()
      const sireBreedId = await breedId(breed)
      await transport.command(path(`/cattle/${id}/breeding-events`), {
        expectedCattleVersion: current.version, bredAt: instant(command.occurredAt), dataSource: command.dataSource ?? 'DIRECT_OBSERVATION',
        method: METHOD_OUT[command.method] ?? command.method, sireSource: internal ? 'INTERNAL' : 'EXTERNAL',
        sireCattleId: internal ? num(command.farmSireId) ?? null : null, sireBreedId: sireBreedId ?? null, sireBreed: sireBreedId ? null : breed || null,
        semenCode: command.semenCode?.trim() || null, semenSupplier: command.semenSupplier?.trim() || null,
        ...await person(command.performer, 'performerId', 'performerName'), linkedEstrusId: backendId(command.linkedEstrusId, 'event') ?? null,
        note: command.note?.trim() || null, confirmDuplicate: command.confirmDuplicate === true,
      })
    } else if (command.type === 'PREGNANCY_CHECK') {
      await transport.command(path(`/cattle/${id}/pregnancy-checks`), {
        expectedCattleVersion: current.version, linkedBreedingId: backendId(command.linkedBreedingId, 'event') ?? null, checkedAt: instant(command.occurredAt),
        dataSource: command.dataSource ?? 'DIRECT_OBSERVATION', result: command.result, method: command.method ?? null,
        estimatedMonths: command.result === 'PREGNANT' ? command.estimatedMonths ?? null : null,
        ...await person(command.examiner, 'examinerId', 'examinerName'), note: command.note?.trim() || null,
      })
    } else {
      const episode = current.openPregnancy
      const episodeId = backendId(episode?.id, 'episode')
      if (!episode || episodeId === undefined) throw new Error('Không có thai kỳ đang mở để ghi diễn biến.')
      await transport.command(path(`/pregnancy-episodes/${episodeId}/updates`), {
        expectedEpisodeVersion: episode.version ?? null, type: command.updateType, occurredAt: instant(command.occurredAt),
        dataSource: command.dataSource ?? 'DIRECT_OBSERVATION', details: command.details.trim() || null,
        healthCaseId: command.updateType === 'COMPLICATION' ? num(command.linkedHealthCaseId) ?? null : null,
      })
    }
  }

  async function calving(code: string, command: CalvingCommand): Promise<void> {
    const current = await known(code)
    const damId = await cattleId(code)
    const catalog = await catalogue()
    const episodeId = backendId(command.pregnancyId, 'episode')
    await transport.command(path('/calvings'), {
      damId, expectedCattleVersion: current.version, episodeId: episodeId ?? null,
      expectedEpisodeVersion: episodeId !== undefined ? current.openPregnancy?.version ?? null : null, noTrackedPregnancy: episodeId === undefined,
      birthAt: instant(command.birthAt), dataSource: command.dataSource ?? 'DIRECT_OBSERVATION', ...await person(command.attendant, 'attendantId', 'attendantName'),
      course: command.course, damCondition: command.damCondition === 'MONITORING' ? 'NEEDS_MONITORING' : command.damCondition,
      retainedPlacenta: command.retainedPlacenta,
      calves: command.calves.map((calf) => {
        const live = calf.outcome === 'LIVE'
        return {
          outcome: calf.outcome, sex: calf.sex === 'UNKNOWN' ? (live ? null : 'UNKNOWN') : calf.sex,
          birthWeightKg: calf.weightKg ?? null, weightBasis: calf.weightKg != null ? calf.weightBasis ?? null : null,
          // Q5 / D36: thẻ tai không bắt buộc khi Đăng ký ngay; để trống thì backend cấp mã khi ghi sổ phiếu FARM_BORN.
          tagCode: live ? calf.earTag?.trim() || null : null, penId: live ? num(calf.penId) ?? null : null,
          breedId: live ? catalog.breedIds.get(calf.breed ?? '') ?? null : null, registration: live ? calf.registration ?? 'DRAFT' : null,
          purposeId: live && calf.registration === 'REGISTER_NOW' ? num(calf.productionPurpose) ?? null : null,
        }
      }),
    })
  }

  /** Chỉ gửi các trường đã đổi so với bản đã đọc (sửa đực giống khi bê đã đăng ký là MSG-FE11-07, kể cả khi gửi lại giá trị cũ). */
  async function correctEvent(code: string, eventId: string, patch: Partial<ReproductionEvent>, reason: string): Promise<void> {
    const original = (await known(code)).events.find((event) => event.id === eventId)
    if (!original) throw new Error('Không tìm thấy bản ghi. Vui lòng tải lại trang.')
    const changed = <K extends keyof ReproductionEvent>(key: K) => patch[key] !== undefined && (patch[key] ?? null) !== (original[key] ?? null)
    const body: Record<string, unknown> = { expectedVersion: original.version, reason }
    if (changed('occurredAt')) body.occurredAt = instant(patch.occurredAt as string)
    if (changed('dataSource')) body.dataSource = patch.dataSource
    const updateId = backendId(eventId, 'update')
    if (updateId !== undefined) {
      if (changed('updateType')) body.type = patch.updateType
      if (changed('description')) body.details = patch.description
      if (changed('linkedHealthCaseId')) { if (patch.linkedHealthCaseId) body.healthCaseId = num(patch.linkedHealthCaseId); else body.unlinkHealthCase = true }
      await transport.command(path(`/pregnancy-updates/${updateId}/correction`), body)
      return
    }
    if (original.type === 'ESTRUS') {
      // Popup khởi tạo ô Mô tả bằng mô tả, hoặc dòng chi tiết khi chưa có mô tả.
      if (patch.description !== undefined && (patch.description ?? '') !== (original.description ?? original.details ?? '')) body.description = patch.description
      if (changed('observer')) Object.assign(body, await person(patch.observer, 'observerId', 'observerName'))
    } else if (original.type === 'BREEDING') {
      if (changed('method')) body.method = METHOD_OUT[patch.method as string] ?? patch.method
      if (changed('semenCode')) body.semenCode = patch.semenCode ?? ''
      if (changed('performer')) Object.assign(body, await person(patch.performer, 'performerId', 'performerName'))
      if (changed('linkedEstrusId')) { if (patch.linkedEstrusId) body.linkedEventId = backendId(patch.linkedEstrusId, 'event'); else body.unlinkEvent = true }
      if (changed('sireLabel')) {
        const label = (patch.sireLabel ?? '').trim()
        const sire = (await catalogue()).sires.find((item) => item.label === label || item.label.split(' · ').includes(label))
        if (sire) Object.assign(body, { sireSource: 'INTERNAL', sireCattleId: num(sire.id) })
        else { const id = await breedId(label); Object.assign(body, { sireSource: 'EXTERNAL', sireBreedId: id ?? null, sireBreed: id ? null : label }) }
      }
    } else if (original.type === 'PREGNANCY_CHECK') {
      if (changed('result')) body.result = patch.result
      if (changed('method')) body.method = patch.method
      if (changed('examiner')) Object.assign(body, await person(patch.examiner, 'examinerId', 'examinerName'))
      if (changed('linkedBreedingId')) { if (patch.linkedBreedingId) body.linkedEventId = backendId(patch.linkedBreedingId, 'event'); else body.unlinkEvent = true }
    }
    await transport.command(path(`/reproduction-events/${backendId(eventId, 'event')}/correction`), body)
  }

  async function correctCalving(code: string, calvingId: string, patch: Partial<CalvingRecord>, reason: string): Promise<void> {
    const original = (await known(code)).calvings.find((item) => item.id === calvingId)
    if (!original) throw new Error('Không tìm thấy lần đẻ. Vui lòng tải lại trang.')
    if (patch.calves) {
      // Popup "Kết quả bê" gửi lại cả lần đẻ với một bê đã sửa.
      for (const calf of patch.calves) {
        const before = original.calves.find((item) => item.id === calf.id)
        if (!before) continue
        const body: Record<string, unknown> = { expectedVersion: before.version, reason }
        if (calf.sex !== before.sex) body.sex = calf.sex === 'UNKNOWN' ? '' : calf.sex
        if (calf.weightKg !== before.weightKg || calf.weightBasis !== before.weightBasis) {
          if (calf.weightKg == null) body.clearWeight = true
          else Object.assign(body, { birthWeightKg: calf.weightKg, weightBasis: calf.weightBasis })
        }
        if ((calf.earTag ?? '') !== (before.earTag ?? '')) body.tagCode = calf.earTag ?? ''
        if (Object.keys(body).length > 2) await transport.command(path(`/calf-outcomes/${backendId(calf.id, 'calf')}/correction`), body)
      }
      return
    }
    const body: Record<string, unknown> = { expectedVersion: original.version, reason }
    if (patch.birthAt !== undefined && patch.birthAt !== original.birthAt) body.birthAt = instant(patch.birthAt)
    if (patch.dataSource !== undefined && patch.dataSource !== original.dataSource) body.dataSource = patch.dataSource
    if (patch.attendant !== undefined && (patch.attendant ?? '') !== (original.attendant ?? '')) Object.assign(body, await person(patch.attendant, 'attendantId', 'attendantName'))
    if (patch.course !== undefined && patch.course !== original.course) body.course = patch.course
    if (patch.damCondition !== undefined && patch.damCondition !== original.damCondition) body.damCondition = patch.damCondition === 'MONITORING' ? 'NEEDS_MONITORING' : patch.damCondition
    if (patch.retainedPlacenta !== undefined && patch.retainedPlacenta !== original.retainedPlacenta) body.retainedPlacenta = patch.retainedPlacenta
    await transport.command(path(`/calvings/${backendId(calvingId, 'calving')}/correction`), body)
  }

  async function voidRecord(code: string, recordId: string, reason: string): Promise<void> {
    const current = await known(code)
    const event = current.events.find((item) => item.id === recordId)
    const calvingRecord = current.calvings.find((item) => item.id === recordId)
    const version = event?.version ?? calvingRecord?.version
    if (version === undefined) throw new Error('Không tìm thấy bản ghi. Vui lòng tải lại trang.')
    const target = recordId.startsWith('u-') ? `/pregnancy-updates/${backendId(recordId, 'update')}` : recordId.startsWith('c-')
      ? `/calvings/${backendId(recordId, 'calving')}` : `/reproduction-events/${backendId(recordId, 'event')}`
    await transport.command(path(`${target}/void`), { expectedVersion: version, reason })
  }

  return {
    async listWorklist(): Promise<ReproductionFemale[]> {
      return run(async () => {
        const rows = asRows(asRecord(await transport.get(path(`/reproduction-worklist${query({ tab: 'ALL' })}`))).items)
        return rows.map((row) => {
          const mapped = mapWorklistItem(row)
          const id = num(row.cattleId)
          if (id !== undefined && !cache.has(mapped.cattleCode)) cache.set(mapped.cattleCode, { cattleId: id })
          return mapped
        })
      })
    },
    getProfile: (code: string) => run(() => profile(code)),
    async formOptions(code: string): Promise<ReproductionFormOptions> {
      return run(async () => {
        const catalog = await catalogue()
        const cases = asRecord(await transport.get(path(`/health-cases/cattle/${await cattleId(code)}`)))
        const healthCases = [...asRows(cases.openCases), ...asRows(cases.previousCases)].map((c) => ({
          id: String(num(c.id) ?? ''), label: [textValue(c.caseCode), text(c.diagnosis) ?? text(c.openingSigns) ?? text(c.signs)].filter(Boolean).join(' · '),
        }))
        const { breedIds: _ids, memberIds: _members, ...visible } = catalog
        void _ids; void _members
        return { ...visible, healthCases }
      })
    },
    recordEvent: (code: string, command: ReproductionCommand) => run(async () => {
      // Kiểm tra trước khi gửi bằng đúng quy tắc của chế độ local (spec FE-11 / FE-12 mục 6), cùng cách báo lỗi.
      // Ca sức khỏe chỉ đi kèm Biến chứng (R-12-06); ô này ẩn với loại khác nên giá trị cũ được bỏ khi gửi, không báo lỗi.
      const checked = command.type === 'PREGNANCY_UPDATE' && command.updateType !== 'COMPLICATION' ? { ...command, linkedHealthCaseId: undefined } : command
      const errors = validateReproductionCommand(checked, { today: toFarmLocal(new Date().toISOString()), profile: await known(code) })
      if (errors.length) throw new Error(errors[0])
      await eventCommand(code, command)
      return profile(code)
    }),
    recordCalving: (code: string, command: CalvingCommand) => run(async () => { await calving(code, command); return profile(code) }),
    correctEvent: (code: string, eventId: string, patch: Partial<ReproductionEvent>, reason: string) =>
      run(async () => { await correctEvent(code, eventId, patch, reason); return profile(code) }),
    voidEvent: (code: string, eventId: string, reason: string) => run(async () => { await voidRecord(code, eventId, reason); return profile(code) }),
    correctCalving: (code: string, calvingId: string, patch: Partial<CalvingRecord>, reason: string) =>
      run(async () => { await correctCalving(code, calvingId, patch, reason); return profile(code) }),
    voidCalving: (code: string, calvingId: string, reason: string) => run(async () => { await voidRecord(code, calvingId, reason); return profile(code) }),
    voidCalf: (code: string, calvingId: string, calfId: string, reason: string) => run(async () => {
      const calf = (await known(code)).calvings.find((item) => item.id === calvingId)?.calves.find((item) => item.id === calfId)
      if (!calf) throw new Error('Không tìm thấy kết quả bê. Vui lòng tải lại trang.')
      await transport.command(path(`/calf-outcomes/${backendId(calfId, 'calf')}/void`), { expectedVersion: calf.version ?? null, reason })
      return profile(code)
    }),
  }
}

export type ReproductionBackend = ReturnType<typeof createReproductionBackend>
