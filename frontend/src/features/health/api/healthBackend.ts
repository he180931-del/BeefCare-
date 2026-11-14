import { BackendError } from '../../../api/backendClient'
import { backendPending } from '../../../api/backendPending'
import { asRecord, asRows, textValue, type BackendTransport } from '../../../api/backendTransport'
import { DEFAULT_FARM_TIME_ZONE, createFarmTimeZone, fromFarmLocal, toFarmLocal } from '../../../api/farmTimeZone'
import { dateOf, fmtTemp, ROUTE_LABEL, ROUTES } from '../domain/healthFormat'
import { caseDay, HealthValidationError, latestWithdrawalEnd, MSG } from '../domain/healthRules'
import type {
  CaseOutcome, CaseResultKind, CaseStatus, CorrectEntryCommand, EntryType, FollowUpCommand, HealthCaseCard, HealthCaseFilters, HealthCaseList, HealthCaseResult,
  HealthCaseRow, HealthCattle, HealthFormOptions, HealthProfile, HealthState, HealthTimelineRow, Medicine, OpenCaseCommand, PendingExit, Progress, RecordResult,
  Severity, StatusCommand, TreatmentCommand, TreatmentResult, TreatmentRoute, VoidEntryCommand,
} from '../types'

/**
 * Adapter FE-10 cho chế độ backend (không bao giờ đọc mock). Spec FE-10 §7:
 * A1 GET /health-cases · A2 GET /health-cases/cattle/{cattleId} · A3 POST /health-cases · A4 POST …/{caseId}/observations
 * · A5 POST …/{caseId}/status · A6 POST …/{caseId}/treatments · A7 POST /treatments/{id}/correction|void
 * · A8 POST /health-observations/{id}/correction|void. Kèm GET /cattle/resolve, /cattle/{id}, /members, /medicines, /pens.
 * Giờ gửi / nhận theo múi giờ trại (GET /context); lỗi backend đổi thành lỗi từng ô tiếng Việt (HealthValidationError).
 */
const LIST_SIZE = 200

const num = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value)
  return undefined
}
const text = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() !== '' ? value : undefined)
const nullableNum = (value: unknown): number | null => num(value) ?? null

/** Instant → 'yyyy-mm-ddTHH:mm' theo giờ trại. */
export const toFarmTime = (instant: unknown, timeZone: string = DEFAULT_FARM_TIME_ZONE): string => toFarmLocal(textValue(instant), timeZone)
/** 'yyyy-mm-ddTHH:mm' giờ trại → Instant có offset của trại. */
export const toInstant = (farmTime: string, timeZone: string = DEFAULT_FARM_TIME_ZONE): string => fromFarmLocal(farmTime, timeZone)

const ROUTE_IN: Record<string, TreatmentRoute> = { IM: 'INTRAMUSCULAR', SC: 'SUBCUTANEOUS', SQ: 'SUBCUTANEOUS', IV: 'INTRAVENOUS', PO: 'ORAL' }
export const toRoute = (value: unknown): TreatmentRoute | undefined => {
  const key = textValue(value).trim().toUpperCase()
  if (!key) return undefined
  const mapped = ROUTE_IN[key] ?? key
  return (ROUTES as string[]).includes(mapped) ? mapped as TreatmentRoute : 'OTHER'
}

const SEVERITIES: Severity[] = ['MILD', 'MODERATE', 'SEVERE']
const STATUSES: CaseStatus[] = ['OPEN', 'CHRONIC', 'CLOSED']
const OUTCOMES: CaseOutcome[] = ['RECOVERED', 'DIED', 'MISSING', 'CLOSED_BY_EXIT']
const PROGRESSES: Progress[] = ['IMPROVED', 'UNCHANGED', 'WORSENED']
const STATES: HealthState[] = ['HEALTHY', 'MONITORING', 'UNDER_TREATMENT']
const pick = <T extends string>(list: readonly T[], value: unknown, fallback: T): T => {
  const key = textValue(value).toUpperCase()
  return (list as readonly string[]).includes(key) ? key as T : fallback
}
const pickOptional = <T extends string>(list: readonly T[], value: unknown): T | undefined => {
  const key = textValue(value).toUpperCase()
  return (list as readonly string[]).includes(key) ? key as T : undefined
}

/** Tuổi hiển thị trên đầu hồ sơ: số tháng từ ngày sinh đến hôm nay (giờ trại). */
function ageText(birthDate: string | undefined, today: string): string {
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

export function mapMedicine(raw: unknown): Medicine {
  const m = asRecord(raw)
  return { id: num(m.id) ?? 0, name: textValue(m.name), active: m.available === true, defaultDose: textValue(m.dose), doseNote: textValue(m.description), route: toRoute(m.route) ?? 'OTHER', withdrawalDays: num(m.withdrawalDays) ?? 0 }
}

/** Dòng mô tả dựng sẵn cho bảng dòng thời gian (SCR-37 #8). */
function describe(row: HealthTimelineRow): string {
  if (row.type === 'TREATMENT') {
    const dose = `${row.dose ?? ''}${(row.courseDays ?? 1) > 1 ? ` × ${row.courseDays} ngày` : ''}`
    return [row.medicineName, dose, row.route ? ROUTE_LABEL[row.route].toLowerCase() : '', `ngưng ${row.withdrawalDays ?? 0} ngày`].filter(Boolean).join(' · ')
  }
  return `${row.description ?? ''}${row.temperatureC !== null ? ` · ${fmtTemp(row.temperatureC)}°C` : ''}`
}

export function mapTimelineRow(raw: unknown, caseCode: string, timeZone: string): HealthTimelineRow {
  const r = asRecord(raw)
  const type: EntryType = r.type === 'TREATMENT' ? 'TREATMENT' : r.type === 'OPENING' ? 'OPENING' : 'FOLLOW_UP'
  const row: HealthTimelineRow = {
    id: num(r.id) ?? 0, caseId: num(r.caseId) ?? 0, caseCode, type, occurredAt: toFarmTime(r.occurredAt, timeZone), details: '',
    // Quan sát: người quan sát (mặc định người ghi); điều trị: người thực hiện.
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

const FIELD_ALIASES: Record<string, string> = {
  administeredAt: 'treatmentTime', latestProgress: 'progressText', suspectedDiagnosis: 'diagnosis', performerName: 'performer', performerId: 'performer',
  observerId: 'observer', confirmedById: 'confirmedBy', existingCaseId: 'form', cattleId: 'form', action: 'form',
}
const FIELD_LABELS: Record<string, string> = {
  signs: 'Dấu hiệu / mô tả', description: 'Mô tả', progress: 'Diễn biến', progressText: 'Diễn biến mới', diagnosis: 'Chẩn đoán nghi ngờ', severity: 'Mức độ',
  temperatureC: 'Thân nhiệt', observedAt: 'Thời điểm', observer: 'Người quan sát', medicineId: 'Thuốc', dose: 'Liều', route: 'Đường dùng', treatmentTime: 'Thời điểm bắt đầu',
  courseDays: 'Liệu trình (ngày)', withdrawalDays: 'Số ngày ngưng', performer: 'Người thực hiện', veterinaryAdvice: 'Lời khuyên thú y', outcome: 'Kết quả',
  closedAt: 'Thời điểm đóng', confirmedBy: 'Người xác nhận', reason: 'Lý do', vaccinationId: 'Mũi tiêm liên kết',
}

/**
 * Lỗi backend → lỗi từng ô (HealthValidationError) hoặc thông báo chung tiếng Việt. {@code timeField}: ô thời điểm của
 * popup đang mở (observedAt / treatmentTime / closedAt) nhận các lỗi COM-07, COM-15, FE10-07.
 */
export function mapHealthError(error: unknown, timeField = 'observedAt', timeZone = DEFAULT_FARM_TIME_ZONE): unknown {
  if (!(error instanceof BackendError)) return error
  const code = textValue(error.code).replace(/^MSG-/, '')
  const p = error.params
  if (code === 'FE10-13') return new Error(MSG.voidOpening)
  if (code === 'COM-17') return new Error(MSG.pendingExit)
  if (code === 'COM-13') return new Error(MSG.exited(textValue(p.cattle_code), textValue(p.date), textValue(p.exit_type, 'Xuất')))
  if (code === 'COM-05' || error.status === 409 || error.status === 412) return new Error(MSG.changed)
  if (code === 'COM-07') return new HealthValidationError({ [timeField]: MSG.future })
  if (code === 'COM-15') return new HealthValidationError({ [timeField]: text(p.date) ? MSG.beforeEntry(textValue(p.date)) : 'Thời điểm không được trước ngày nhập đàn.' })
  if (code === 'FE10-07') return new HealthValidationError({ [timeField]: MSG.beforeCase(toFarmTime(p.date, timeZone), 'lần ghi gần nhất của ca này') })
  if (code === 'FE10-06') return new HealthValidationError({ temperatureC: MSG.temperature })
  if (code === 'FE18-08') return new HealthValidationError({ medicineId: 'Thuốc đã ngưng sử dụng, không thể chọn cho bản ghi mới.' })
  const fields: Record<string, string> = {}
  const add = (field: string, message: string | undefined) => {
    const key = FIELD_ALIASES[field] ?? field
    const label = FIELD_LABELS[key]
    fields[key] = code === 'COM-06' && label ? MSG.required(label) : code === 'COM-10' && label ? `${label} không hợp lệ.` : message || error.message
  }
  if (text(p.field)) add(textValue(p.field), undefined)
  for (const fe of error.fieldErrors) add(fe.field, fe.message)
  for (const v of error.violations) if (v.field || v.propertyPath) add(v.field ?? v.propertyPath ?? 'form', v.message)
  return Object.keys(fields).length ? new HealthValidationError(fields) : error
}

const query = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== '') search.set(key, String(value))
  const s = search.toString()
  return s ? `?${s}` : ''
}

interface CaseRef { caseCode: string; cattleCode: string }
interface EntryRef { type: EntryType; caseId: number }

export function createHealthBackend({ farmId, transport, clock = () => new Date() }: { farmId: string | number; transport: BackendTransport; clock?: () => Date }) {
  const path = (suffix: string) => transport.farmPath(farmId, suffix)
  const zone = createFarmTimeZone(transport, farmId)
  let timeZone = DEFAULT_FARM_TIME_ZONE
  const syncZone = async () => { timeZone = await zone() }
  const now = () => toFarmTime(clock().toISOString(), timeZone)
  const resolved = new Map<string, { cattleId: number; cattle: HealthCattle }>()
  // Ca / bản ghi đã đọc qua A1, A2: để các lệnh A5–A8 biết mã ca, mã bò và loại bản ghi (route điều trị hay quan sát).
  const cases = new Map<number, CaseRef>()
  const entries = new Map<number, EntryRef>()
  let memberList: Array<{ id: number; name: string }> | undefined

  async function run<T>(action: () => Promise<T>, timeField = 'observedAt'): Promise<T> {
    try {
      await syncZone()
      return await action()
    } catch (error) {
      throw mapHealthError(error, timeField, timeZone)
    }
  }

  async function resolve(code: string) {
    const hit = resolved.get(code)
    if (hit) return hit
    const body = asRecord(await transport.get(path(`/cattle/resolve${query({ code })}`)))
    const cattleId = num(body.cattleId)
    if (cattleId === undefined) throw new Error(`Không tìm thấy bò ${code}.`)
    // /cattle/resolve không trả thông tin nhập đàn; hồ sơ chi tiết có ngày nhập đàn, ngày / loại xuất.
    const cattle = mapCattle(await transport.get(path(`/cattle/${cattleId}`)), now().slice(0, 10))
    if (!cattle.code) cattle.code = code
    const value = { cattleId, cattle }
    resolved.set(code, value)
    return value
  }

  const members = async () => {
    if (memberList) return memberList
    const response = await transport.get(path('/members'))
    const rows = Array.isArray(response) ? asRows(response) : asRows(asRecord(response).members ?? asRecord(response).items)
    memberList = rows.filter((m) => m.status === undefined || m.status === 'ACTIVE').map((m) => ({ id: num(m.userId) ?? num(m.id) ?? 0, name: textValue(m.fullName, textValue(m.email)) }))
    return memberList
  }
  /** Tên thành viên (popup chọn theo tên) → id; tên không khớp thành viên nào → undefined. */
  const memberId = async (name: string | undefined) => {
    const wanted = (name ?? '').trim()
    if (!wanted) return undefined
    return (await members()).find((m) => m.name === wanted)?.id
  }
  const performerBody = async (name: string | undefined) => {
    const id = await memberId(name)
    return id !== undefined ? { performerId: id } : { performerName: (name ?? '').trim() || null }
  }
  const pens = async () => {
    const response = await transport.get(path('/pens'))
    const rows = Array.isArray(response) ? asRows(response) : asRows(asRecord(response).pens)
    return rows.map((p) => ({ id: num(p.id) ?? 0, code: textValue(p.code), name: textValue(p.name, textValue(p.code)) }))
  }

  function mapRow(raw: unknown): HealthCaseRow {
    const r = asRecord(raw)
    const openedAt = text(r.openedAt) ? toFarmTime(r.openedAt, timeZone) : `${textValue(r.openedDate)}T00:00`
    const status = pick(STATUSES, r.status, 'OPEN')
    const row: HealthCaseRow = {
      id: num(r.id) ?? 0, caseCode: textValue(r.caseCode), cattleCode: textValue(r.cattleCode), cattleName: '', breed: textValue(r.breed), sex: r.sex === 'FEMALE' ? 'Cái' : r.sex === 'MALE' ? 'Đực' : '',
      penCode: textValue(r.penCode), penName: textValue(r.penName), diagnosis: textValue(r.diagnosis), signs: textValue(r.signs), suspectedContagious: r.suspectedContagious === true,
      severity: pick(SEVERITIES, r.severity, 'MILD'), openedDate: textValue(r.openedDate, dateOf(openedAt)), openedAt, status, chronicSince: text(r.chronicSince),
      outcome: pickOptional(OUTCOMES, r.outcome), treatmentCount: num(r.treatmentCount) ?? 0, day: num(r.dayN) ?? caseDay(openedAt, now()), version: num(r.version) ?? 0,
    }
    cases.set(row.id, { caseCode: row.caseCode, cattleCode: row.cattleCode })
    return row
  }

  function result(raw: unknown, kind: CaseResultKind, fallback: CaseRef | undefined, deathVoucher: PendingExit | null = null): HealthCaseResult {
    const r = asRecord(raw)
    const id = num(r.id) ?? 0
    const ref: CaseRef = { caseCode: textValue(r.caseCode, fallback?.caseCode), cattleCode: textValue(r.cattleCode, fallback?.cattleCode) }
    cases.set(id, ref)
    return {
      id, caseCode: ref.caseCode, cattleCode: ref.cattleCode, status: pick(STATUSES, r.status, 'OPEN'), version: num(r.version) ?? 0, observationId: nullableNum(r.observationId),
      healthState: pick(STATES, r.healthState, 'MONITORING'), kind, outcome: pickOptional(OUTCOMES, r.outcome), deathVoucher,
    }
  }

  function recordResult(raw: unknown, action: RecordResult['action'], entry: EntryRef): RecordResult {
    const r = asRecord(raw)
    return {
      id: num(r.id) ?? 0, status: textValue(r.status).toUpperCase() === 'VOIDED' ? 'VOIDED' : 'VALID', version: num(r.version) ?? 0, healthState: pick(STATES, r.healthState, 'MONITORING'),
      action, recordType: entry.type === 'TREATMENT' ? 'TREATMENT' : 'FOLLOW_UP', cattleCode: cases.get(num(r.caseId) ?? entry.caseId)?.cattleCode ?? '',
      withdrawalBefore: text(r.withdrawalBefore) ?? null, withdrawalAfter: text(r.withdrawalAfter) ?? null,
    }
  }

  const entryOf = (entryId: number): EntryRef => {
    const entry = entries.get(entryId)
    if (!entry) throw new Error('Bản ghi chưa được tải. Vui lòng mở lại hồ sơ bò rồi thử lại.')
    return entry
  }

  const api = {
    now,

    // A1 + GET /pens (bộ lọc chuồng theo mã).
    async listCases(filters: HealthCaseFilters = {}): Promise<HealthCaseList> {
      return run(async () => {
        const penList = await pens()
        const penId = filters.penCode ? penList.find((p) => p.code === filters.penCode)?.id : undefined
        if (filters.penCode && penId === undefined) return { rows: [], counts: { open: 0, chronic: 0, closed: 0, all: 0 }, pens: penList }
        const body = asRecord(await transport.get(path(`/health-cases${query({
          tab: (filters.tab ?? 'open').toUpperCase(), search: filters.search?.trim(), severity: filters.severity || undefined, penId, from: filters.from, to: filters.to,
          sort: filters.sort, dir: filters.dir, page: 0, size: LIST_SIZE,
        })}`)))
        const counts = asRecord(body.counts)
        return {
          rows: asRows(body.items).map(mapRow),
          counts: { open: num(counts.open) ?? 0, chronic: num(counts.chronic) ?? 0, closed: num(counts.closed) ?? 0, all: num(counts.all) ?? 0 },
          pens: penList,
        }
      })
    },

    // A2 (+ GET /cattle/resolve, /cattle/{id} cho phần đầu hồ sơ).
    async getProfile(cattleCode: string): Promise<HealthProfile> {
      return run(async () => {
        const { cattleId, cattle } = await resolve(cattleCode)
        const body = asRecord(await transport.get(path(`/health-cases/cattle/${cattleId}`)))
        const timeline: HealthTimelineRow[] = []
        const activeCases = asRows(body.openCases).map((raw): HealthCaseCard => {
          const c = asRecord(raw)
          const id = num(c.id) ?? 0
          const caseCode = textValue(c.caseCode)
          cases.set(id, { caseCode, cattleCode })
          const rows = asRows(c.timeline).map((t) => mapTimelineRow(t, caseCode, timeZone))
          for (const row of rows) entries.set(row.id, { type: row.type, caseId: id })
          timeline.push(...rows)
          const openedAt = text(c.openedAt) ? toFarmTime(c.openedAt, timeZone) : `${textValue(c.openedDate)}T00:00`
          const openingSigns = textValue(c.openingSigns)
          return {
            id, caseCode, status: pick(STATUSES, c.status, 'OPEN'), severity: pick(SEVERITIES, c.severity, 'MILD'), diagnosis: textValue(c.diagnosis), signs: openingSigns, openingSigns,
            suspectedContagious: c.suspectedContagious === true, openedAt, openedDate: textValue(c.openedDate, dateOf(openedAt)), chronicSince: text(c.chronicSince),
            treatmentCount: num(c.treatmentCount) ?? rows.filter((r) => r.type === 'TREATMENT' && r.status === 'VALID').length, day: num(c.dayN) ?? caseDay(openedAt, now()),
            withdrawalEndDate: latestWithdrawalEnd(rows), latestEntryAt: text(c.latestEntryAt) ? toFarmTime(c.latestEntryAt, timeZone) : openedAt, version: num(c.version) ?? 0,
          }
        })
        const previousCases = asRows(body.previousCases).map((raw): HealthCaseCard => {
          const c = asRecord(raw)
          const id = num(c.id) ?? 0
          const caseCode = textValue(c.caseCode)
          cases.set(id, { caseCode, cattleCode })
          const openedDate = textValue(c.openedDate)
          const openingSigns = textValue(c.openingSigns)
          return {
            id, caseCode, status: 'CLOSED', severity: pick(SEVERITIES, c.severity, 'MILD'), diagnosis: textValue(c.diagnosis), signs: openingSigns, openingSigns, suspectedContagious: false,
            openedAt: `${openedDate}T00:00`, openedDate, outcome: pickOptional(OUTCOMES, c.outcome), closedAt: text(c.closedDate) ? `${textValue(c.closedDate)}T00:00` : undefined,
            treatmentCount: 0, day: 0, withdrawalEndDate: null, latestEntryAt: `${openedDate}T00:00`, version: 0,
          }
        })
        timeline.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.id - a.id)
        const pending = body.pendingExit === null || body.pendingExit === undefined ? undefined : asRecord(body.pendingExit)
        const pendingExit: PendingExit | null = pending ? {
          id: num(pending.voucherId) ?? 0, cattleCode, caseCode: textValue(pending.caseCode), type: textValue(pending.lossKind).toUpperCase() === 'MISSING' ? 'OTHER' : 'DEATH',
          reason: textValue(pending.lossKind).toUpperCase() === 'MISSING' ? 'Mất tích' : 'Chết', date: textValue(pending.exitDate), reportedBy: '', status: 'PENDING',
        } : null
        return {
          cattle, healthState: pick(STATES, body.healthState, 'HEALTHY'), withdrawalEndDate: text(body.withdrawalEndDate) ?? null, suspectedContagious: body.suspectedContagious === true,
          pendingExit, activeCases, previousCases, timeline,
        }
      })
    },

    // GET /medicines, /members và chẩn đoán đã dùng trong trại (gợi ý Q4) từ A1 tab ALL.
    async formOptions(): Promise<HealthFormOptions> {
      return run(async () => {
        const [medicineRows, memberRows, caseBody] = await Promise.all([
          transport.get(path('/medicines')), members(), transport.get(path(`/health-cases${query({ tab: 'ALL', from: '2000-01-01', to: now().slice(0, 10), page: 0, size: LIST_SIZE })}`)),
        ])
        const medicineList = Array.isArray(medicineRows) ? asRows(medicineRows) : asRows(asRecord(medicineRows).items)
        const diagnoses = [...new Set(asRows(asRecord(caseBody).items).map((c) => textValue(c.diagnosis)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'))
        return { medicines: medicineList.map(mapMedicine), members: memberRows.map((m) => m.name), diagnoses }
      })
    },

    /** Phiếu xuất chờ Chủ trại thuộc FE-13 (herd-exit); tab sức khỏe đọc phiếu của từng con qua A2 (pendingExit). */
    async listPendingExits(): Promise<PendingExit[]> { throw backendPending('danh sách phiếu xuất chờ xác nhận (FE-13)') },

    // A3
    async openCase(cattleCode: string, cmd: OpenCaseCommand): Promise<HealthCaseResult> {
      return run(async () => {
        const [{ cattleId }, observerId] = await Promise.all([resolve(cattleCode), memberId(cmd.observer)])
        const r = await transport.command(path('/health-cases'), {
          cattleId, existingCaseId: cmd.existingCaseId ?? null, expectedVersion: cmd.expectedVersion ?? null, observedAt: toInstant(cmd.observedAt, timeZone), observerId: observerId ?? null,
          temperatureC: cmd.temperatureC, signs: cmd.signs.trim(), diagnosis: cmd.diagnosis.trim() || null, suspectedContagious: cmd.suspectedContagious, severity: cmd.severity || null,
        })
        return result(r, cmd.existingCaseId !== undefined ? 'ADDED' : 'OPENED', { caseCode: '', cattleCode })
      })
    },

    // A4
    async recordFollowUp(caseId: number, cmd: FollowUpCommand): Promise<HealthCaseResult> {
      return run(async () => {
        const observerId = await memberId(cmd.observer)
        const r = await transport.command(path(`/health-cases/${caseId}/observations`), {
          expectedVersion: cmd.expectedVersion ?? null, observedAt: toInstant(cmd.observedAt, timeZone), temperatureC: cmd.temperatureC, progress: cmd.progress || null,
          description: cmd.description.trim(), observerId: observerId ?? null,
        })
        return result(r, 'FOLLOWED', cases.get(caseId))
      })
    },

    // A6
    async recordTreatment(caseId: number, cmd: TreatmentCommand): Promise<TreatmentResult> {
      return run(async () => {
        const r = asRecord(await transport.command(path(`/health-cases/${caseId}/treatments`), {
          expectedVersion: cmd.expectedVersion ?? null, medicineId: cmd.medicineId, administeredAt: toInstant(cmd.treatmentTime, timeZone), dose: cmd.dose.trim(), route: cmd.route || null,
          courseDays: cmd.courseDays, withdrawalDays: cmd.withdrawalDays, ...(await performerBody(cmd.performer)), veterinaryAdvice: cmd.veterinaryAdvice.trim() || null,
        }))
        return {
          id: num(r.id) ?? 0, caseId, caseCode: cases.get(caseId)?.caseCode ?? '', caseVersion: num(r.caseVersion) ?? 0, caseStatus: pick(STATUSES, r.caseStatus, 'OPEN'),
          withdrawalEndDate: textValue(r.withdrawalEndDate), courseDays: num(r.courseDays) ?? cmd.courseDays ?? 1, medicineName: textValue(r.medicineName),
          healthState: pick(STATES, r.healthState, 'UNDER_TREATMENT'), returnedToOpen: r.returnedToOpen === true,
        }
      }, 'treatmentTime')
    },

    // A5
    async updateStatus(caseId: number, cmd: StatusCommand): Promise<HealthCaseResult> {
      const closing = cmd.action === 'CLOSE'
      return run(async () => {
        const confirmedById = await memberId(cmd.confirmedBy)
        // D25: gửi đúng diễn biến người dùng chọn; backend báo MSG-COM-06 nếu thiếu khi có theo dõi.
        const r = asRecord(await transport.command(path(`/health-cases/${caseId}/status`), {
          expectedVersion: cmd.expectedVersion ?? null, action: cmd.action, latestProgress: cmd.progressText.trim() || null, progress: cmd.progress || null, suspectedDiagnosis: cmd.diagnosis.trim() || null,
          suspectedContagious: cmd.suspectedContagious, outcome: closing ? cmd.outcome || null : null, closedAt: closing && cmd.closedAt ? toInstant(cmd.closedAt, timeZone) : null,
          confirmedById: confirmedById ?? null,
        }))
        const kind: CaseResultKind = cmd.action === 'TO_CHRONIC' ? 'CHRONIC' : cmd.action === 'TO_OPEN' ? 'REOPENED' : closing ? 'CLOSED' : 'KEPT'
        const ref = cases.get(caseId)
        const voucherId = num(r.pendingExitVoucherId)
        const deathVoucher: PendingExit | null = voucherId === undefined ? null : {
          id: voucherId, cattleCode: textValue(r.cattleCode, ref?.cattleCode), caseCode: textValue(r.caseCode, ref?.caseCode), type: cmd.outcome === 'MISSING' ? 'OTHER' : 'DEATH',
          reason: cmd.outcome === 'MISSING' ? 'Mất tích' : 'Chết', date: dateOf(text(r.closedAt) ? toFarmTime(r.closedAt, timeZone) : cmd.closedAt ?? now()), reportedBy: cmd.confirmedBy, status: 'PENDING',
        }
        return result(r, kind, ref, deathVoucher)
      }, closing ? 'closedAt' : 'observedAt')
    },

    // A7 / A8 sửa: route theo loại bản ghi đã đọc ở A2.
    async correctEntry(entryId: number, cmd: CorrectEntryCommand): Promise<RecordResult> {
      const entry = entryOf(entryId)
      const treatment = entry.type === 'TREATMENT'
      return run(async () => {
        const body = treatment
          ? {
              expectedVersion: cmd.expectedVersion ?? null, reason: cmd.reason.trim(), medicineId: cmd.medicineId ?? null, administeredAt: cmd.treatmentTime ? toInstant(cmd.treatmentTime, timeZone) : null,
              dose: cmd.dose?.trim() || null, route: cmd.route || null, courseDays: cmd.courseDays ?? null, withdrawalDays: cmd.withdrawalDays ?? null,
              ...(cmd.performer === undefined ? {} : await performerBody(cmd.performer)),
            }
          : {
              expectedVersion: cmd.expectedVersion ?? null, reason: cmd.reason.trim(), observedAt: cmd.observedAt ? toInstant(cmd.observedAt, timeZone) : null,
              temperatureC: cmd.temperatureC === undefined ? null : cmd.temperatureC, signs: cmd.description?.trim() || null, progress: cmd.progress || null,
              observerId: (await memberId(cmd.observer)) ?? null,
            }
        const r = await transport.command(path(treatment ? `/treatments/${entryId}/correction` : `/health-observations/${entryId}/correction`), body)
        return recordResult(r, 'CORRECTED', entry)
      }, treatment ? 'treatmentTime' : 'observedAt')
    },

    // A7 / A8 hủy.
    async voidEntry(entryId: number, cmd: VoidEntryCommand): Promise<RecordResult> {
      const entry = entryOf(entryId)
      if (entry.type === 'OPENING') throw new Error(MSG.voidOpening)
      return run(async () => {
        const r = await transport.command(path(entry.type === 'TREATMENT' ? `/treatments/${entryId}/void` : `/health-observations/${entryId}/void`), { expectedVersion: cmd.expectedVersion ?? null, reason: cmd.reason.trim() })
        return recordResult(r, 'VOIDED', entry)
      })
    },
  }
  return api
}

export type HealthBackend = ReturnType<typeof createHealthBackend>
