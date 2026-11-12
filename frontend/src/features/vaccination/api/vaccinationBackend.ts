import { BackendError } from '../../../api/backendClient'
import { asRecord, asRows, textValue, type BackendTransport } from '../../../api/backendTransport'
import { STATIC_OPTIONS } from '../data/vaccinationMock'
import { addMonths, fmtDate } from '../domain/vaccinationFormat'
import {
  CONFLICT_MESSAGE, VaccinationValidationError, doseTextOf, dueStateOf, effectiveDate, hasErrors, plannedDoseRows, resolveTarget,
  validateDefer, validateReason, validateRecordFields, validateSchedule, type FieldErrors,
} from '../domain/vaccinationRules'
import type {
  CattleVaccination, CorrectVaccinationCommand, DeferDoseCommand, DoseFilters, DosePage, DoseRow, DoseStatus, DoseTab, HerdGroup,
  HistoryFilters, HistoryPage, HistoryRow, LifeStage, RecordContext, RecordVaccinationsCommand, Schedule, ScheduleCard, ScheduleCommand,
  ScheduleDetail, ScheduleResult, ScheduleTarget, ScheduledDose, VaccCattle, VaccinationBatchResult, VaccinationOptions,
  VaccinationRecord, VaccinationRevision, VaccineItem, VaccineRoute, VoidRecordCommand,
} from '../types'

/**
 * Adapter FE-09 cho chế độ backend (không bao giờ đọc mock).
 * Route dùng: GET /vaccines, /members, /pens, /cattle, /cattle/resolve, /vaccination-schedules, /vaccinations/history;
 * POST /vaccination-schedules, PUT /vaccination-schedules/{id}, POST /vaccination-schedules/{id}/stop,
 * POST /scheduled-doses/{id}/defer, POST /vaccinations, POST /vaccinations/{id}/correction, POST /vaccinations/{id}/void.
 * Phần backend chưa có route riêng (danh sách mũi theo tab, xem trước đối tượng, tab tiêm của một con) được ghép ở đây
 * từ các route trên, theo đúng quy tắc trong domain/vaccinationRules (GBR-41, GBR-43).
 */
export const DOSE_PAGE_SIZE = 6
const FARM_OFFSET = '+07:00'
const FARM_OFFSET_MS = 7 * 3600_000
const CATTLE_PAGE = 200

const num = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value)
  return undefined
}
const text = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() !== '' ? value : undefined)
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/** Instant → 'yyyy-mm-ddTHH:mm' giờ trại (UTC+7). */
export const toFarmTime = (instant: unknown): string => {
  const ms = Date.parse(textValue(instant))
  return Number.isNaN(ms) ? '' : new Date(ms + FARM_OFFSET_MS).toISOString().slice(0, 16)
}
/** 'yyyy-mm-ddTHH:mm' giờ trại → Instant có offset. */
export const toInstant = (farmTime: string): string => (farmTime.length === 16 ? `${farmTime}:00${FARM_OFFSET}` : farmTime)

// Danh mục FE-18 lưu đường tiêm dạng đầy đủ; màn tiêm phòng dùng mã ngắn.
const ROUTE_IN: Record<string, VaccineRoute> = { INTRAMUSCULAR: 'IM', IM: 'IM', SUBCUTANEOUS: 'SC', SC: 'SC', ORAL: 'ORAL', INTRANASAL: 'IN', IN: 'IN' }
const ROUTE_OUT: Record<VaccineRoute, string> = { IM: 'INTRAMUSCULAR', SC: 'SUBCUTANEOUS', ORAL: 'ORAL', IN: 'INTRANASAL', OTHER: 'OTHER' }
export const toRoute = (value: unknown): VaccineRoute | undefined => {
  const key = textValue(value).trim().toUpperCase()
  if (!key) return undefined
  return ROUTE_IN[key] ?? 'OTHER'
}

/** "2 ml" → { 2, 'ml' }; liều không có số giữ đơn vị là cả chuỗi. */
const splitDose = (dose: unknown): { amount: number; unit: string } => {
  const raw = textValue(dose).trim()
  const match = raw.match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/)
  return match ? { amount: Number(match[1].replace(',', '.')), unit: match[2] || 'ml' } : { amount: 0, unit: raw || 'ml' }
}

export function mapVaccine(raw: unknown): VaccineItem {
  const v = asRecord(raw)
  const { amount, unit } = splitDose(v.dose)
  const name = textValue(v.name)
  return {
    id: num(v.id) ?? 0, name, shortName: name, disease: textValue(v.diseasePrevented), referenceDose: amount, doseUnit: unit,
    route: toRoute(v.route) ?? 'OTHER', withdrawalDays: num(v.withdrawalDays) ?? 0, active: v.available === true,
  }
}

interface CattleRef extends VaccCattle { id: number }
export function mapCattle(raw: unknown): CattleRef {
  const p = asRecord(raw)
  return {
    id: num(p.id) ?? 0,
    code: textValue(p.displayCode),
    name: text(p.name),
    breed: textValue(p.breedName),
    sex: p.sex === 'FEMALE' ? 'Cái' : 'Đực',
    penCode: textValue(p.penCode),
    penName: textValue(p.penName),
    herdGroup: (text(p.herdGroup) ?? 'OTHER') as HerdGroup,
    lifeStage: textValue(p.lifeStage) as LifeStage,
    herdEntryDate: textValue(p.entryDate, textValue(asRecord(p.entry).entryDate)),
    status: p.herdStatus === undefined || p.herdStatus === 'ACTIVE' ? 'ACTIVE' : 'EXITED',
  }
}

const DOSE_STATUSES: DoseStatus[] = ['PLANNED', 'DEFERRED', 'DONE', 'CANCELLED']
const doseStatus = (value: unknown): DoseStatus => {
  const s = textValue(value).toUpperCase()
  return (DOSE_STATUSES as string[]).includes(s) ? s as DoseStatus : 'PLANNED'
}

interface ScheduleView { schedule: Schedule; vaccineName: string; doses: ScheduledDose[] }
/** Backend chỉ lưu mô tả đối tượng (targetGroup), không lưu điều kiện: đối tượng dựng lại là danh sách bò có mũi. */
export function mapSchedule(raw: unknown): ScheduleView {
  const s = asRecord(raw)
  const doseCount = num(s.doseCount) ?? 1
  const id = num(s.id) ?? 0
  const doses: ScheduledDose[] = asRows(s.doses).map((d) => {
    const doseNo = num(d.doseNo) ?? 1
    return {
      id: num(d.id) ?? 0, scheduleId: id, cattleCode: textValue(d.cattleCode), doseNo,
      // Mũi nhắc lại backend sinh với số mũi tiếp theo sau mũi cuối (planBooster).
      kind: doseNo > doseCount ? 'BOOSTER' : 'DOSE',
      dueDate: textValue(d.dueDate), newExpectedDate: text(d.newExpectedDate), status: doseStatus(d.status),
      deferralReason: text(d.deferralReason), version: num(d.version) ?? 0,
    }
  })
  const codes = [...new Set(doses.filter((d) => d.status !== 'CANCELLED').map((d) => d.cattleCode))]
  return {
    vaccineName: textValue(s.vaccineName),
    doses,
    schedule: {
      id, name: textValue(s.name), vaccineId: num(s.vaccineId) ?? 0, firstDueDate: textValue(s.firstDueDate), doseCount,
      intervalDays: doseCount > 1 ? num(s.intervalDays) : undefined, boosterIntervalMonths: num(s.boosterIntervalMonths),
      status: textValue(s.status).toUpperCase() === 'STOPPED' ? 'STOPPED' : 'ACTIVE', version: num(s.version) ?? 0,
      target: { penCodes: [], herdGroups: [], lifeStages: [], excluded: [], added: codes }, stopReason: text(s.stopReason),
    },
  }
}

const SOURCES = ['ON_FARM', 'HISTORICAL'] as const
/** Số ngày ngưng suy từ ngày hết ngưng khi backend không trả số ngày (bản ghi / revision cũ). */
const daysBetween = (from: string, to: string | undefined) => (to && from ? Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) : 0)

/** Revision của bản ghi tiêm (GAP-FE09-03): giá trị trước khi sửa / hủy, người, thời điểm, lý do (BR-D15). */
export function mapRevision(raw: unknown): VaccinationRevision {
  const r = asRecord(raw)
  const b = asRecord(r.before)
  const date = textValue(b.vaccinationDate)
  return {
    at: toFarmTime(r.changedAt),
    by: textValue(r.changedBy),
    action: textValue(r.action).toUpperCase() === 'VOID' ? 'VOID' : 'CORRECT',
    reason: textValue(r.reason),
    before: {
      vaccineId: num(b.vaccineId) ?? 0,
      administeredAt: text(b.administeredAt) ? toFarmTime(b.administeredAt) : date ? `${date}T00:00` : '',
      batchNo: text(b.batchNo),
      dose: text(b.dose),
      route: toRoute(b.route),
      withdrawalDays: num(b.withdrawalDays) ?? daysBetween(date, text(b.withdrawalEndDate)),
      vaccinator: text(b.vaccinator),
    },
  }
}

export function mapRecord(raw: unknown): HistoryRow {
  const r = asRecord(raw)
  const date = textValue(r.vaccinationDate)
  const administeredAt = text(r.administeredAt) ? toFarmTime(r.administeredAt) : `${date}T00:00`
  const withdrawalEndDate = text(r.withdrawalEndDate)
  const source = (SOURCES as readonly string[]).includes(textValue(r.source).toUpperCase()) ? textValue(r.source).toUpperCase() as 'ON_FARM' | 'HISTORICAL' : 'ON_FARM'
  const days = num(r.withdrawalDays) ?? daysBetween(date, withdrawalEndDate)
  return {
    id: num(r.id) ?? 0,
    cattleCode: textValue(r.cattleCode),
    penCode: textValue(r.penCode),
    vaccineId: num(r.vaccineId),
    vaccineLabel: textValue(r.vaccineName),
    batchNo: text(r.batchNo),
    dose: text(r.dose),
    route: toRoute(r.route),
    administeredAt,
    precision: 'EXACT',
    source,
    vaccinator: text(r.vaccinator),
    withdrawalDays: days,
    withdrawalEndDate,
    reactionCaseCode: text(r.reactionCaseCode),
    status: textValue(r.status).toUpperCase() === 'VOIDED' ? 'VOIDED' : 'VALID',
    corrected: r.corrected === true,
    version: num(r.version) ?? 0,
    revisions: asRows(r.revisions).map(mapRevision),
  }
}

// Mã lỗi COM-06 / COM-10 trả về {field}; tên trường backend → ô trên màn hình.
const FIELD_ALIASES: Record<string, string> = {
  vaccinationDate: 'administeredAt', firstDueDate: 'firstDueDate', targetCattle: 'form', animals: 'form', scheduledDoseId: 'form',
  deferralReason: 'form', decision: 'form', period: 'form', page: 'form',
}
const FIELD_MESSAGES: Record<string, string> = {
  name: 'Tên lịch là bắt buộc, tối đa 100 ký tự.',
  vaccineId: 'Vắc-xin là bắt buộc.',
  firstDueDate: 'Ngày bắt đầu không được trước hôm nay.',
  doseCount: 'Số mũi phải là số nguyên từ 1 đến 10.',
  intervalDays: 'Cách giữa mũi phải từ 1 đến 365 ngày.',
  boosterIntervalMonths: 'Nhắc lại sau phải từ 1 đến 60 tháng.',
  batchNo: 'Số lô là bắt buộc khi tiêm tại trại, tối đa 50 ký tự.',
  administeredAt: 'Thời điểm tiêm không hợp lệ.',
  withdrawalDays: 'Số ngày ngưng phải là số nguyên từ 0 đến 365.',
  vaccinator: 'Người tiêm là bắt buộc.',
  dose: 'Liều là bắt buộc.',
  route: 'Đường tiêm là bắt buộc.',
  reason: 'Lý do là bắt buộc, tối đa 500 ký tự.',
  newExpectedDate: 'Ngày mới phải từ hôm nay trở đi.',
  source: 'Nguồn ghi nhận không hợp lệ.',
  form: 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.',
}

/** Đổi lỗi backend sang lỗi màn hình đang bắt; lỗi khác (quyền, xung đột…) giữ nguyên cho userFacingError. */
export function mapVaccinationError(error: unknown): unknown {
  if (!(error instanceof BackendError)) return error
  const reason = textValue(error.params.reason)
  if (error.code === 'COM-05' && reason === 'active_schedule_name_exists') return new VaccinationValidationError({ name: 'Đã có lịch đang chạy cùng tên.' })
  if (error.code === 'COM-05' && reason === 'vaccine_inactive') return new VaccinationValidationError({ vaccineId: 'Vắc-xin đã ngừng sử dụng, không thể chọn cho bản ghi mới.' })
  if (error.code === 'COM-05' || error.status === 409 || error.status === 412) return new Error(CONFLICT_MESSAGE)
  const fields: FieldErrors = {}
  const field = textValue(error.params.field)
  if (field) {
    const key = FIELD_ALIASES[field] ?? field
    fields[key] = key === 'form' && field === 'targetCattle' ? 'Không có bò đang nuôi nào khớp với nhóm đã chọn.' : FIELD_MESSAGES[key] ?? error.message
  }
  for (const fe of error.fieldErrors) {
    const key = FIELD_ALIASES[fe.field] ?? fe.field
    fields[key] = FIELD_MESSAGES[key] ?? fe.message
  }
  return hasErrors(fields) ? new VaccinationValidationError(fields) : error
}

const query = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== '') search.set(key, String(value))
  const s = search.toString()
  return s ? `?${s}` : ''
}

const sameList = (a: string[], b: string[]) => a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i])
const sameTarget = (a: ScheduleTarget, b: ScheduleTarget) =>
  sameList(a.penCodes, b.penCodes) && sameList(a.herdGroups, b.herdGroups) && sameList(a.lifeStages, b.lifeStages) && sameList(a.excluded, b.excluded) && sameList(a.added, b.added)

export function createVaccinationBackend({ farmId, transport, clock = () => new Date() }: { farmId: string | number; transport: BackendTransport; clock?: () => Date }) {
  const path = (suffix: string) => transport.farmPath(farmId, suffix)
  const now = () => toFarmTime(clock().toISOString())
  const today = () => now().slice(0, 10)
  const records = new Map<number, VaccinationRecord>()

  async function run<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action()
    } catch (error) {
      throw mapVaccinationError(error)
    }
  }

  const vaccines = async () => asRows(await transport.get(path('/vaccines'))).map(mapVaccine)
  const pens = async () => {
    const response = await transport.get(path('/pens'))
    const rows = Array.isArray(response) ? asRows(response) : asRows(asRecord(response).pens)
    return rows.map((p) => ({ id: num(p.id) ?? 0, code: textValue(p.code), name: textValue(p.name, textValue(p.code)) }))
  }
  const members = async () => {
    const response = await transport.get(path('/members'))
    const rows = Array.isArray(response) ? asRows(response) : asRows(asRecord(response).members ?? asRecord(response).items)
    return rows.filter((m) => m.status === undefined || m.status === 'ACTIVE').map((m) => ({ id: num(m.userId) ?? num(m.id) ?? 0, name: textValue(m.fullName, textValue(m.email)) }))
  }
  /** Mọi bò của trại (kể cả đã rời đàn, để dòng mũi cũ vẫn có tên); đọc theo trang 200 con. */
  const cattle = async (): Promise<CattleRef[]> => {
    const all: CattleRef[] = []
    for (let page = 0; page < 500; page++) {
      const body = asRecord(await transport.get(path(`/cattle${query({ herdStatus: 'ALL', page, size: CATTLE_PAGE })}`)))
      const items = asRows(body.items).map(mapCattle)
      all.push(...items)
      if (items.length < CATTLE_PAGE || all.length >= (num(body.total) ?? 0)) break
    }
    return all
  }
  const schedules = async () => asRows(await transport.get(path('/vaccination-schedules'))).map(mapSchedule)

  const placeholder = (code: string): VaccCattle => ({ code, breed: '', sex: 'Cái', penCode: '', penName: '', herdGroup: 'OTHER', lifeStage: 'ADULT', herdEntryDate: '', status: 'EXITED' })

  /** Ngữ cảnh đọc: lịch, mũi, bò và vắc-xin cần cho các màn suy ra. */
  async function snapshot() {
    const [views, herd, catalogue] = await Promise.all([schedules(), cattle(), vaccines()])
    const byCode = new Map(herd.map((c) => [c.code, c]))
    const scheduleOf = (id: number) => views.find((v) => v.schedule.id === id)
    const allDoses = views.flatMap((v) => v.doses)
    const rowOf = (d: ScheduledDose): DoseRow => {
      const view = scheduleOf(d.scheduleId)!
      const s = view.schedule
      const c = byCode.get(d.cattleCode) ?? placeholder(d.cattleCode)
      const state = dueStateOf(d, today())
      return {
        id: d.id, cattleCode: c.code, cattleName: c.name, breed: c.breed, sex: c.sex, penName: c.penName,
        scheduleId: s.id, scheduleName: s.name, scheduleShort: s.name.split(' – ')[0], doseNo: d.doseNo, doseCount: s.doseCount, kind: d.kind,
        doseText: doseTextOf(d.kind, d.doseNo, s.doseCount), dueDate: d.dueDate, effectiveDate: effectiveDate(d), newExpectedDate: d.newExpectedDate,
        state, daysOverdue: state === 'OVERDUE' ? Math.round((Date.parse(today()) - Date.parse(d.dueDate)) / 86_400_000) : 0,
        rawStatus: d.status, version: d.version,
      }
    }
    const vaccineOf = (view: ScheduleView): VaccineItem =>
      catalogue.find((v) => v.id === view.schedule.vaccineId)
      ?? { id: view.schedule.vaccineId, name: view.vaccineName, shortName: view.vaccineName, disease: '', referenceDose: 0, doseUnit: 'ml', route: 'OTHER', withdrawalDays: 0, active: false }
    const open = (d: ScheduledDose) => (d.status === 'PLANNED' || d.status === 'DEFERRED') && scheduleOf(d.scheduleId)?.schedule.status === 'ACTIVE'
    return { views, herd, byCode, catalogue, scheduleOf, allDoses, rowOf, vaccineOf, open }
  }

  /** Mỗi (lịch, bò) một dòng: mũi đang cần tiêm, hoặc mũi cuối đã tiêm; mũi nhắc lại chỉ chen vào khi đã đến hạn. */
  const headDoses = (list: ScheduledDose[]): ScheduledDose[] => {
    const groups = new Map<string, ScheduledDose[]>()
    list.forEach((d) => groups.set(`${d.scheduleId}|${d.cattleCode}`, [...(groups.get(`${d.scheduleId}|${d.cattleCode}`) ?? []), d]))
    const heads: ScheduledDose[] = []
    groups.forEach((own) => {
      const regular = own.filter((d) => d.kind === 'DOSE').sort((a, b) => a.doseNo - b.doseNo)
      const boosters = own.filter((d) => d.kind === 'BOOSTER' && d.status !== 'DONE').sort((a, b) => a.doseNo - b.doseNo)
      const pending = regular.find((d) => d.status !== 'DONE')
      const dueBooster = boosters.find((d) => ['OVERDUE', 'DUE'].includes(dueStateOf(d, today())))
      const head = pending ?? dueBooster ?? regular[regular.length - 1] ?? boosters[0]
      if (head) heads.push(head)
    })
    return heads
  }

  const targetCountOf = (view: ScheduleView) => new Set(view.doses.filter((d) => d.status !== 'CANCELLED').map((d) => d.cattleCode)).size

  const api = {
    async options(): Promise<VaccinationOptions> {
      const [catalogue, people, pensList] = await Promise.all([vaccines(), members(), pens()])
      return {
        vaccines: catalogue.filter((v) => v.active),
        members: people,
        pens: pensList.map((p) => ({ code: p.code, label: p.name })),
        herdGroups: structuredClone(STATIC_OPTIONS.herdGroups),
        lifeStages: structuredClone(STATIC_OPTIONS.lifeStages),
        now: now(),
      }
    },

    async listSchedules(): Promise<ScheduleCard[]> {
      const snap = await snapshot()
      return snap.views.filter((v) => v.schedule.status === 'ACTIVE').map((v) => {
        const live = v.doses.filter((d) => d.status !== 'CANCELLED')
        const byCattle = new Map<string, ScheduledDose[]>()
        live.filter((d) => d.kind === 'DOSE').forEach((d) => byCattle.set(d.cattleCode, [...(byCattle.get(d.cattleCode) ?? []), d]))
        return {
          schedule: v.schedule, vaccine: snap.vaccineOf(v), targetCount: byCattle.size,
          doneCount: [...byCattle.values()].filter((list) => list.find((d) => d.doseNo === v.schedule.doseCount)?.status === 'DONE').length,
          overdueCount: live.filter((d) => dueStateOf(d, today()) === 'OVERDUE').length,
        }
      })
    },

    async listDoses(filters: DoseFilters = {}): Promise<DosePage> {
      const snap = await snapshot()
      const live = snap.allDoses.filter((d) => d.status !== 'CANCELLED' && snap.scheduleOf(d.scheduleId)?.schedule.status === 'ACTIVE' && (!filters.scheduleId || d.scheduleId === filters.scheduleId))
      const all = headDoses(live).map(snap.rowOf)
      const count = (state: DoseRow['state']) => all.filter((r) => r.state === state).length
      const counts: Record<DoseTab, number> = { all: all.length, overdue: count('OVERDUE'), due: count('DUE'), upcoming: count('UPCOMING'), deferred: count('DEFERRED'), done: count('DONE') }
      const tab = filters.tab ?? 'all'
      const stateOf: Record<string, DoseRow['state']> = { overdue: 'OVERDUE', due: 'DUE', upcoming: 'UPCOMING', deferred: 'DEFERRED', done: 'DONE' }
      const sign = filters.dir === 'desc' ? -1 : 1
      const rows = all.filter((r) => tab === 'all' || r.state === stateOf[tab]).sort((a, b) => sign * cmp(a.effectiveDate, b.effectiveDate) || cmp(a.cattleCode, b.cattleCode))
      const size = filters.size ?? DOSE_PAGE_SIZE
      const page = Math.min(Math.max(1, filters.page ?? 1), Math.max(1, Math.ceil(rows.length / size)))
      return { rows: rows.slice((page - 1) * size, page * size), total: rows.length, page, size, counts }
    },

    async getDose(id: number): Promise<DoseRow> {
      const snap = await snapshot()
      const dose = snap.allDoses.find((d) => d.id === id)
      if (!dose) throw new Error('Không tìm thấy mũi tiêm.')
      return snap.rowOf(dose)
    },

    async getSchedule(id: number): Promise<ScheduleDetail> {
      const snap = await snapshot()
      const view = snap.scheduleOf(id)
      if (!view) throw new Error('Không tìm thấy lịch tiêm.')
      const targetCount = targetCountOf(view)
      return { schedule: view.schedule, vaccine: snap.vaccineOf(view), targetCount, plannedRows: plannedDoseRows(view.schedule, view.doses, targetCount, today()) }
    },

    async previewTarget(target: ScheduleTarget): Promise<VaccCattle[]> {
      return resolveTarget(await cattle(), target).map(stripId)
    },

    async previewPlan(cmd: ScheduleCommand, targetCount: number) {
      return plannedDoseRows({ firstDueDate: cmd.firstDueDate || today(), intervalDays: cmd.intervalDays, doseCount: cmd.doseCount ?? 0, boosterIntervalMonths: cmd.boosterIntervalMonths }, [], targetCount, today())
    },

    async createSchedule(cmd: ScheduleCommand): Promise<ScheduleResult> {
      return run(async () => {
        const [views, herd, catalogue, pensList] = await Promise.all([schedules(), cattle(), vaccines(), pens()])
        const errors = validateSchedule(cmd, { activeNames: views.filter((v) => v.schedule.status === 'ACTIVE').map((v) => v.schedule.name), vaccine: catalogue.find((v) => v.id === cmd.vaccineId) })
        if (cmd.firstDueDate && cmd.firstDueDate < today()) errors.firstDueDate = 'Ngày bắt đầu không được trước hôm nay.'
        if (!hasErrors(errors) && resolveTarget(herd, cmd.target).length === 0) errors.form = 'Không có bò đang nuôi nào khớp với nhóm đã chọn.'
        if (hasErrors(errors)) throw new VaccinationValidationError(errors)
        const idOf = (code: string) => herd.find((c) => c.code === code)?.id
        const body = {
          name: cmd.name.trim(), vaccineId: cmd.vaccineId, firstDueDate: cmd.firstDueDate, doseCount: cmd.doseCount,
          // Backend bắt buộc intervalDays kể cả lịch 1 mũi; khi đó giá trị không dùng tới.
          intervalDays: cmd.doseCount! > 1 ? cmd.intervalDays : cmd.intervalDays ?? 1,
          boosterIntervalMonths: cmd.boosterIntervalMonths ?? null,
          cattleIds: cmd.target.added.map(idOf).filter((id): id is number => id !== undefined),
          penIds: cmd.target.penCodes.map((code) => pensList.find((p) => p.code === code)?.id).filter((id): id is number => id !== undefined),
          herdGroups: cmd.target.herdGroups,
          lifeStages: cmd.target.lifeStages,
          excludedCattleIds: cmd.target.excluded.map(idOf).filter((id): id is number => id !== undefined),
        }
        const result = asRecord(await transport.command(path('/vaccination-schedules'), body))
        const targetCount = num(result.targetCount) ?? 0
        const planned = num(result.plannedDoseCount) ?? 0
        const schedule: Schedule = {
          id: num(result.id) ?? 0, name: textValue(result.name, body.name), vaccineId: cmd.vaccineId!, firstDueDate: cmd.firstDueDate, doseCount: cmd.doseCount!,
          intervalDays: cmd.doseCount! > 1 ? cmd.intervalDays : undefined, boosterIntervalMonths: cmd.boosterIntervalMonths,
          status: 'ACTIVE', version: num(result.version) ?? 0, target: structuredClone(cmd.target),
        }
        return { schedule, targetCount, plannedDoseCount: planned, message: `Đã lưu lịch ${schedule.name}: ${planned} mũi dự kiến cho ${targetCount} bò.` }
      })
    },

    async updateSchedule(id: number, cmd: ScheduleCommand): Promise<ScheduleResult> {
      return run(async () => {
        const [views, catalogue] = await Promise.all([schedules(), vaccines()])
        const view = views.find((v) => v.schedule.id === id)
        if (!view) throw new Error('Không tìm thấy lịch tiêm.')
        const s = view.schedule
        if (s.status !== 'ACTIVE' || (cmd.expectedVersion !== undefined && cmd.expectedVersion !== s.version)) throw new Error(CONFLICT_MESSAGE)
        const errors = validateSchedule(cmd, { activeNames: views.filter((v) => v.schedule.status === 'ACTIVE' && v.schedule.id !== id).map((v) => v.schedule.name), vaccine: catalogue.find((v) => v.id === cmd.vaccineId) })
        const changed = {
          name: cmd.name.trim() !== s.name, vaccine: cmd.vaccineId !== s.vaccineId, start: cmd.firstDueDate !== s.firstDueDate,
          interval: (cmd.intervalDays ?? undefined) !== s.intervalDays, booster: (cmd.boosterIntervalMonths ?? undefined) !== s.boosterIntervalMonths,
        }
        if (changed.start && cmd.firstDueDate < today()) errors.firstDueDate = 'Ngày bắt đầu không được trước hôm nay.'
        // FE-09 Q3 (D13): đổi vắc-xin khi đã có mũi DONE thì dừng lịch và tạo lịch mới.
        if (changed.vaccine && view.doses.some((d) => d.status === 'DONE')) errors.vaccineId = 'Lịch đã có mũi được tiêm: hãy dừng lịch này và tạo lịch mới để đổi vắc-xin.'
        // Backend chưa cho sửa số mũi, đối tượng hay bỏ nhắc lại của lịch đang chạy (GAP-FE09-01).
        if (cmd.doseCount !== s.doseCount) errors.doseCount = 'Chưa đổi được số mũi của lịch đang chạy. Hãy dừng lịch và tạo lịch mới.'
        if (!sameTarget(cmd.target, s.target)) errors.form = 'Chưa đổi được đối tượng của lịch đang chạy. Hãy dừng lịch và tạo lịch mới.'
        if (changed.booster && cmd.boosterIntervalMonths === undefined) errors.boosterIntervalMonths = 'Chưa bỏ được nhắc lại của lịch đang chạy.'
        if (hasErrors(errors)) throw new VaccinationValidationError(errors)
        const body = {
          expectedVersion: s.version,
          name: changed.name ? cmd.name.trim() : null,
          vaccineId: changed.vaccine ? cmd.vaccineId : null,
          firstDueDate: changed.start ? cmd.firstDueDate : null,
          intervalDays: changed.interval ? cmd.intervalDays ?? null : null,
          boosterIntervalMonths: changed.booster ? cmd.boosterIntervalMonths ?? null : null,
        }
        const result = asRecord(await transport.command(path(`/vaccination-schedules/${id}`), body, { method: 'PUT' }))
        const targetCount = num(result.targetCount) ?? targetCountOf(view)
        const planned = num(result.plannedDoseCount) ?? 0
        const schedule: Schedule = {
          ...s, name: textValue(result.name, cmd.name.trim()), vaccineId: cmd.vaccineId ?? s.vaccineId, firstDueDate: cmd.firstDueDate,
          intervalDays: s.doseCount > 1 ? cmd.intervalDays : undefined, boosterIntervalMonths: cmd.boosterIntervalMonths, version: num(result.version) ?? s.version + 1,
        }
        return { schedule, targetCount, plannedDoseCount: planned, message: `Đã lưu lịch ${schedule.name}: còn ${planned} mũi dự kiến cho ${targetCount} bò.` }
      })
    },

    async stopSchedule(id: number, cmd: { reason: string; expectedVersion: number }): Promise<ScheduleResult> {
      const errors = validateReason(cmd.reason)
      if (hasErrors(errors)) throw new VaccinationValidationError(errors)
      return run(async () => {
        // A5: phiên bản đi qua If-Match, lý do trong body (R-09-06); backend lưu lý do vào lịch (stopReason).
        const result = asRecord(await transport.command(path(`/vaccination-schedules/${id}/stop`), { reason: cmd.reason.trim() }, { headers: { 'If-Match': String(cmd.expectedVersion) } }))
        const name = textValue(result.name)
        const schedule: Schedule = {
          id, name, vaccineId: 0, firstDueDate: '', doseCount: 0, status: 'STOPPED', version: num(result.version) ?? cmd.expectedVersion + 1,
          target: { penCodes: [], herdGroups: [], lifeStages: [], excluded: [], added: [] }, stopReason: cmd.reason.trim(),
        }
        return { schedule, targetCount: num(result.targetCount) ?? 0, plannedDoseCount: 0, message: `Đã dừng lịch ${name}.` }
      })
    },

    async recordContext(input: { doseIds?: number[]; cattleCodes?: string[] }): Promise<RecordContext> {
      const [snap, options] = await Promise.all([snapshot(), api.options()])
      const rows: RecordContext['rows'] = []
      ;(input.doseIds ?? []).forEach((id) => {
        const d = snap.allDoses.find((x) => x.id === id)
        const c = d && snap.byCode.get(d.cattleCode)
        if (d && c && snap.open(d)) rows.push({ cattle: c, dose: snap.rowOf(d) })
      })
      ;(input.cattleCodes ?? []).forEach((code) => {
        const c = snap.byCode.get(code)
        if (!c || rows.some((r) => r.cattle.code === code)) return
        const next = snap.allDoses.filter((d) => d.cattleCode === code && snap.open(d)).sort((a, b) => cmp(effectiveDate(a), effectiveDate(b)))[0]
        rows.push({ cattle: c, dose: next && snap.rowOf(next) })
      })
      const doseRows = rows.map((r) => r.dose)
      const same = doseRows.length > 0 && doseRows.every((d) => d && d.scheduleId === doseRows[0]!.scheduleId && d.doseText === doseRows[0]!.doseText)
      const title = same ? `Ghi nhận tiêm – ${doseRows[0]!.scheduleShort} · ${doseRows[0]!.doseText}` : rows.length === 1 ? `Ghi nhận tiêm – ${rows[0].cattle.code}` : 'Ghi nhận tiêm'
      const firstDose = doseRows.find(Boolean)
      return { rows: rows.map((r) => ({ ...r, cattle: stripId(r.cattle) })), options, title, vaccineId: firstDose ? snap.scheduleOf(firstDose.scheduleId)?.schedule.vaccineId : undefined }
    },

    async recordVaccinations(cmd: RecordVaccinationsCommand): Promise<VaccinationBatchResult> {
      if (!cmd.animals.length) throw new VaccinationValidationError({ form: 'Chưa chọn bò nào để ghi nhận.' })
      return run(async () => {
        const [herd, catalogue] = await Promise.all([cattle(), vaccines()])
        const byCode = new Map(herd.map((c) => [c.code, c]))
        const vaccinated = cmd.animals.filter((a) => a.decision === 'VACCINATE')
        const herdEntryDate = vaccinated.map((a) => byCode.get(a.cattleCode)?.herdEntryDate ?? '').sort().pop() || undefined
        const fields = validateRecordFields(cmd, { now: now(), vaccine: catalogue.find((v) => v.id === cmd.vaccineId), herdEntryDate })
        const rowErrors: FieldErrors = {}
        cmd.animals.forEach((a) => {
          if (!byCode.get(a.cattleCode)) rowErrors[a.cattleCode] = `Không tìm thấy bò ${a.cattleCode}.`
          else if (a.decision === 'DEFER') {
            const e = validateDefer({ reason: a.deferralReason, newExpectedDate: a.newExpectedDate }, today())
            if (!a.scheduledDoseId) rowErrors[a.cattleCode] = `${a.cattleCode} chưa có mũi theo lịch để hoãn.`
            else if (e.reason) rowErrors[a.cattleCode] = 'Lý do chưa tiêm là bắt buộc.'
            else if (e.newExpectedDate) rowErrors[a.cattleCode] = e.newExpectedDate
          }
        })
        if (hasErrors(fields) || hasErrors(rowErrors)) throw new VaccinationValidationError(fields, rowErrors)
        const onFarm = cmd.source === 'ON_FARM'
        const result = asRecord(await transport.command(path('/vaccinations'), {
          vaccineId: cmd.vaccineId,
          source: cmd.source,
          vaccinationDate: cmd.administeredAt.slice(0, 10),
          administeredAt: onFarm ? toInstant(cmd.administeredAt) : null,
          batchNo: cmd.batchNo?.trim() || null,
          dose: cmd.dose?.trim() || null,
          route: cmd.route ? ROUTE_OUT[cmd.route] : null,
          withdrawalDays: onFarm ? cmd.withdrawalDays ?? null : 0,
          vaccinator: cmd.vaccinator?.trim() || null,
          animals: cmd.animals.map((a) => ({
            cattleId: byCode.get(a.cattleCode)!.id,
            // Bản ghi tiêm cũ (HISTORICAL) không đóng mũi theo lịch.
            scheduledDoseId: onFarm || a.decision === 'DEFER' ? a.scheduledDoseId ?? null : null,
            expectedDoseVersion: a.expectedDoseVersion ?? null,
            decision: a.decision,
            deferralReason: a.decision === 'DEFER' ? a.deferralReason?.trim() ?? null : null,
            newExpectedDate: a.decision === 'DEFER' ? a.newExpectedDate || null : null,
          })),
        }))
        const vaccinatedCount = num(result.vaccinatedCount) ?? 0
        const deferredCount = num(result.deferredCount) ?? 0
        return {
          vaccinatedCount, deferredCount, vaccinationIds: (Array.isArray(result.vaccinationIds) ? result.vaccinationIds : []).map((v) => num(v) ?? 0),
          // Backend xử lý cả lô trong một giao dịch: lỗi một con là lỗi cả lô, không có danh sách bỏ qua.
          skipped: [],
          message: `Đã ghi nhận ${vaccinatedCount} mũi tiêm; hoãn ${deferredCount} mũi.`,
        }
      })
    },

    async deferDose(id: number, cmd: DeferDoseCommand) {
      const errors = validateDefer(cmd, today())
      if (hasErrors(errors)) throw new VaccinationValidationError(errors)
      return run(async () => {
        const r = asRecord(await transport.command(path(`/scheduled-doses/${id}/defer`), {
          expectedVersion: cmd.expectedVersion, reason: cmd.reason.trim(), newExpectedDate: cmd.newExpectedDate || null, note: cmd.note?.trim() || null,
        }))
        const newExpectedDate = text(r.newExpectedDate)
        return {
          id: num(r.id) ?? id, status: doseStatus(r.status), version: num(r.version) ?? cmd.expectedVersion + 1, reason: text(r.reason), newExpectedDate,
          message: `Đã hoãn mũi tiêm${newExpectedDate ? ` đến ${fmtDate(newExpectedDate)}` : ''}.`,
        }
      })
    },

    async listHistory(filters: HistoryFilters = {}): Promise<HistoryPage> {
      const from = filters.from || addMonths(today(), -3)
      const to = filters.to || today()
      const rows = asRows(await transport.get(path(`/vaccinations/history${query({ search: filters.q?.trim(), vaccineId: filters.vaccineId, source: filters.source, from, to })}`)))
        .map(mapRecord)
        .sort((a, b) => cmp(b.administeredAt, a.administeredAt) || cmp(a.cattleCode, b.cattleCode))
      rows.forEach((r) => records.set(r.id, r))
      const size = filters.size ?? DOSE_PAGE_SIZE
      const page = Math.min(Math.max(1, filters.page ?? 1), Math.max(1, Math.ceil(rows.length / size)))
      return { rows: rows.slice((page - 1) * size, page * size), total: rows.length, page, size, from, to }
    },

    async getCattleVaccination(code: string): Promise<CattleVaccination> {
      const resolved = asRecord(await transport.get(path(`/cattle/resolve${query({ code })}`)))
      const cattleId = num(resolved.cattleId)
      if (cattleId === undefined) throw new Error(`Không tìm thấy bò ${code}.`)
      const c = mapCattle(resolved.cattle)
      const [views, history] = await Promise.all([
        schedules(),
        // Tab của một con lấy toàn bộ lịch sử, không giới hạn 3 tháng như màn lịch sử đàn.
        transport.get(path(`/vaccinations/history${query({ cattleId, from: '1970-01-01', to: today() })}`)),
      ])
      const list = asRows(history).map(mapRecord).sort((a, b) => cmp(b.administeredAt, a.administeredAt))
      list.forEach((r) => records.set(r.id, r))
      const scheduleOf = (id: number) => views.find((v) => v.schedule.id === id)
      const doses = views.flatMap((v) => v.doses).filter((d) => d.cattleCode === code && (d.status === 'PLANNED' || d.status === 'DEFERRED') && scheduleOf(d.scheduleId)?.schedule.status === 'ACTIVE')
      const rowOf = (d: ScheduledDose): DoseRow => {
        const s = scheduleOf(d.scheduleId)!.schedule
        const state = dueStateOf(d, today())
        return {
          id: d.id, cattleCode: code, cattleName: c.name, breed: c.breed, sex: c.sex, penName: c.penName, scheduleId: s.id, scheduleName: s.name,
          scheduleShort: s.name.split(' – ')[0], doseNo: d.doseNo, doseCount: s.doseCount, kind: d.kind, doseText: doseTextOf(d.kind, d.doseNo, s.doseCount),
          dueDate: d.dueDate, effectiveDate: effectiveDate(d), newExpectedDate: d.newExpectedDate, state,
          daysOverdue: state === 'OVERDUE' ? Math.round((Date.parse(today()) - Date.parse(d.dueDate)) / 86_400_000) : 0, rawStatus: d.status, version: d.version,
        }
      }
      return {
        cattle: stripId(c),
        doses: doses.map(rowOf).sort((a, b) => cmp(a.effectiveDate, b.effectiveDate)),
        records: list.map(({ penCode: _pen, ...r }) => r),
      }
    },

    async correctRecord(id: number, cmd: CorrectVaccinationCommand): Promise<VaccinationRecord> {
      const before = records.get(id)
      const reasonErrors = validateReason(cmd.reason)
      const fields = { ...validateRecordFields({ vaccineId: cmd.vaccineId, source: before?.source ?? 'ON_FARM', administeredAt: cmd.administeredAt, batchNo: cmd.batchNo, withdrawalDays: cmd.withdrawalDays, vaccinator: cmd.vaccinator }, { now: now() }), ...reasonErrors }
      if (hasErrors(fields)) throw new VaccinationValidationError(fields)
      // TC-09-27: bản ghi tại trại sửa được số ngày ngưng; bản ghi lịch sử không có ngưng thịt (R-09-08).
      const onFarm = (before?.source ?? 'ON_FARM') === 'ON_FARM'
      return run(async () => {
        const r = asRecord(await transport.command(path(`/vaccinations/${id}/correction`), {
          expectedVersion: cmd.expectedVersion, vaccineId: cmd.vaccineId ?? null,
          vaccinationDate: cmd.administeredAt.slice(0, 10), administeredAt: toInstant(cmd.administeredAt),
          batchNo: cmd.batchNo?.trim() || null, dose: cmd.dose?.trim() || null, route: cmd.route ? ROUTE_OUT[cmd.route] : null,
          vaccinator: cmd.vaccinator?.trim() || null, reason: cmd.reason.trim(),
          withdrawalDays: onFarm ? cmd.withdrawalDays ?? null : null,
        }))
        const updated: VaccinationRecord = {
          ...(before ?? emptyRecord(id)),
          vaccineId: cmd.vaccineId ?? before?.vaccineId, administeredAt: cmd.administeredAt, batchNo: cmd.batchNo?.trim() || undefined, dose: cmd.dose, route: cmd.route,
          vaccinator: cmd.vaccinator?.trim() || undefined, withdrawalDays: num(r.withdrawalDays) ?? (onFarm ? cmd.withdrawalDays : undefined) ?? before?.withdrawalDays ?? 0,
          withdrawalEndDate: text(r.withdrawalEndDate), status: 'VALID', corrected: r.corrected !== false,
          version: num(r.version) ?? cmd.expectedVersion + 1, precision: 'EXACT',
        }
        records.set(id, updated)
        return updated
      })
    },

    async voidRecord(id: number, cmd: VoidRecordCommand): Promise<VaccinationRecord> {
      const errors = validateReason(cmd.reason)
      if (hasErrors(errors)) throw new VaccinationValidationError(errors)
      return run(async () => {
        const r = asRecord(await transport.command(path(`/vaccinations/${id}/void`), { expectedVersion: cmd.expectedVersion, reason: cmd.reason.trim() }))
        const updated: VaccinationRecord = { ...(records.get(id) ?? emptyRecord(id)), status: 'VOIDED', withdrawalEndDate: text(r.withdrawalEndDate), version: num(r.version) ?? cmd.expectedVersion + 1 }
        records.set(id, updated)
        return updated
      })
    },
  }
  return api
}

function stripId(c: VaccCattle & { id?: number }): VaccCattle {
  const { id: _id, ...rest } = c
  return rest
}

function emptyRecord(id: number): VaccinationRecord {
  return { id, cattleCode: '', vaccineLabel: '', administeredAt: '', precision: 'EXACT', source: 'ON_FARM', withdrawalDays: 0, status: 'VALID', corrected: false, version: 0, revisions: [] }
}
