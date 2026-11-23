import { caseDay, computeHealthState, latestWithdrawalEnd, MSG, withdrawalEnd } from '../domain/healthRules'
import { hasFollowUp, HealthValidationError, observationErrors as observationFieldErrors, openCaseErrors, reasonErrors, statusErrors, textError, treatmentErrors as treatmentFieldErrors } from '../validation/healthValidation'
import { dateOf, fmtTemp, ROUTE_LABEL } from '../domain/healthFormat'
import type {
  CorrectEntryCommand, HealthCaseCard, HealthCaseFilters, HealthCaseList, HealthCaseResult, HealthCaseRow, HealthCattle, HealthFormOptions, HealthProfile,
  HealthTimelineRow, OpenCaseCommand, PendingExit, Progress, RecordResult, ReopenCaseCommand, StatusCommand, TreatmentCommand, TreatmentResult, VoidEntryCommand,
} from '../types'
import { HEALTH_DEMO_NOW, HEALTH_SEED, type CaseRecord, type EntryRecord, type HealthSeed } from './healthMock'

export function createHealthDemoStore(seed: HealthSeed = HEALTH_SEED, options: { now?: () => string } = {}) {
  let db = structuredClone(seed)
  const now = options.now ?? (() => HEALTH_DEMO_NOW)

  const placeholder = (code: string): HealthCattle => ({ code, name: '', earTag: '', breed: '', sex: '', ageText: '', stage: '', penCode: '', penName: '', entryDate: '2000-01-01', status: 'ACTIVE' })
  const cattleOf = (code: string) => db.cattle.find((c) => c.code === code) ?? placeholder(code)
  const ensureCattle = (code: string) => {
    let c = db.cattle.find((x) => x.code === code)
    if (!c) { c = placeholder(code); db.cattle.push(c) }
    return c
  }
  const pendingExitOf = (code: string) => db.vouchers.find((v) => v.cattleCode === code && v.status === 'PENDING') ?? null
  const nextEntryId = () => Math.max(0, ...db.entries.map((e) => e.id)) + 1

  // GBR-26: bò đã rời đàn chỉ xem; bò chờ xác nhận chết / mất không nhận sự kiện mới nhưng vẫn cho sửa / hủy bản ghi cũ.
  const assertExitedFree = (c: HealthCattle) => {
    if (c.status === 'EXITED') throw new Error(MSG.exited(c.code, c.exitDate ?? '', c.exitType ?? 'Xuất'))
  }
  const assertCanAdd = (c: HealthCattle) => {
    assertExitedFree(c)
    if (pendingExitOf(c.code)) throw new Error(MSG.pendingExit)
  }

  const caseById = (id: number) => {
    const c = db.cases.find((x) => x.id === id)
    if (!c) throw new Error('Không tìm thấy ca sức khỏe.')
    return c
  }
  const activeCase = (id: number, expectedVersion?: number) => {
    const c = caseById(id)
    if ((c.status !== 'OPEN' && c.status !== 'CHRONIC') || (expectedVersion !== undefined && expectedVersion !== c.version)) throw new Error(MSG.changed)
    return c
  }
  const validOf = (caseId: number) => db.entries.filter((e) => e.caseId === caseId && e.status === 'VALID')
  const entriesOfCattle = (code: string) => {
    const ids = new Set(db.cases.filter((c) => c.cattleCode === code).map((c) => c.id))
    return db.entries.filter((e) => ids.has(e.caseId))
  }
  const addEntry = (e: Omit<EntryRecord, 'id' | 'status' | 'corrected' | 'version' | 'revisions'>) => {
    const row: EntryRecord = { ...e, id: nextEntryId(), status: 'VALID', corrected: false, version: 1, revisions: [] }
    db.entries.push(row)
    return row
  }
  const healthStateOf = (code: string) => computeHealthState(db.cases.filter((c) => c.cattleCode === code), entriesOfCattle(code))
  const cattleWithdrawal = (code: string) => latestWithdrawalEnd(entriesOfCattle(code))

  function describe(e: EntryRecord): string {
    if (e.type === 'TREATMENT') {
      const dose = `${e.dose}${(e.courseDays ?? 1) > 1 ? ` × ${e.courseDays} ngày` : ''}`
      return [e.medicineName, dose, ROUTE_LABEL[e.route!].toLowerCase(), `ngưng ${e.withdrawalDays} ngày`].join(' · ')
    }
    return `${e.description ?? ''}${e.temperatureC !== null ? ` · ${fmtTemp(e.temperatureC)}°C` : ''}`
  }

  function toRow(e: EntryRecord): HealthTimelineRow {
    const { revisions: _revisions, ...rest } = e
    return {
      ...rest,
      caseCode: caseById(e.caseId).caseCode,
      details: describe(e),
      withdrawalEndDate: e.type === 'TREATMENT' ? withdrawalEnd(e.occurredAt, e.courseDays ?? 1, e.withdrawalDays ?? 0) : undefined,
    }
  }

  function toCard(c: CaseRecord): HealthCaseCard {
    const valid = validOf(c.id)
    const first = db.entries.find((e) => e.caseId === c.id && e.type === 'OPENING')
    return {
      id: c.id, caseCode: c.caseCode, status: c.status, severity: c.severity, diagnosis: c.diagnosis, signs: c.signs, openingSigns: first?.description ?? c.signs,
      suspectedContagious: c.suspectedContagious, openedAt: c.openedAt, openedDate: dateOf(c.openedAt), chronicSince: c.chronicSince, outcome: c.outcome, closedAt: c.closedAt, closedBy: c.closedBy,
      treatmentCount: valid.filter((e) => e.type === 'TREATMENT').length, day: caseDay(c.openedAt, now()),
      withdrawalEndDate: latestWithdrawalEnd(valid), latestEntryAt: valid.reduce((m, e) => (e.occurredAt > m ? e.occurredAt : m), c.openedAt), version: c.version,
    }
  }

  function toRowCase(c: CaseRecord): HealthCaseRow {
    const cattle = cattleOf(c.cattleCode)
    return {
      id: c.id, caseCode: c.caseCode, cattleCode: c.cattleCode, cattleName: cattle.name, breed: cattle.breed, sex: cattle.sex, penCode: cattle.penCode, penName: cattle.penName,
      diagnosis: c.diagnosis, signs: c.signs, suspectedContagious: c.suspectedContagious, severity: c.severity, openedDate: dateOf(c.openedAt), openedAt: c.openedAt,
      status: c.status, chronicSince: c.chronicSince, outcome: c.outcome, treatmentCount: validOf(c.id).filter((e) => e.type === 'TREATMENT').length, day: caseDay(c.openedAt, now()), version: c.version,
    }
  }

  function result(c: CaseRecord, kind: HealthCaseResult['kind'], observationId: number | null, deathVoucher: PendingExit | null = null): HealthCaseResult {
    return { id: c.id, caseCode: c.caseCode, cattleCode: c.cattleCode, status: c.status, version: c.version, observationId, healthState: healthStateOf(c.cattleCode), kind, outcome: c.outcome, deathVoucher }
  }

  const memberName = (id: number | null | undefined) => db.members.find((m) => m.id === id)?.name ?? ''

  function observationErrors(label: string, v: { time?: string; temperatureC?: number | null }, ctx: { cattle: HealthCattle; min?: string; minWhat?: string }, errors: Record<string, string>) {
    Object.assign(errors, observationFieldErrors(label, v, { now: now(), entryDate: ctx.cattle.entryDate, min: ctx.min, minWhat: ctx.minWhat }))
  }

  function treatmentErrors(v: Required<Pick<TreatmentCommand, 'medicineId' | 'treatmentTime' | 'dose' | 'route' | 'courseDays' | 'withdrawalDays' | 'performer'>> & { veterinaryAdvice?: string }, ctx: { cattle: HealthCattle; openedAt: string; currentMedicineId?: number }, errors: Record<string, string>) {
    Object.assign(errors, treatmentFieldErrors(v, { now: now(), entryDate: ctx.cattle.entryDate, openedAt: ctx.openedAt }))
    const medicine = db.medicines.find((m) => m.id === v.medicineId)
    if (v.medicineId && !medicine) errors.medicineId = 'Không tìm thấy thuốc trong danh mục của trại.'
    else if (medicine && !medicine.active && medicine.id !== ctx.currentMedicineId) errors.medicineId = MSG.inactiveMedicine(medicine.name)
    return medicine
  }

  const throwIf = (errors: Record<string, string>) => { if (Object.keys(errors).length) throw new HealthValidationError(errors) }

  return {
    now,

    async listCases(filters: HealthCaseFilters = {}): Promise<HealthCaseList> {
      const { tab = 'open', search = '', severity = '', penCode = '', from, to, sort = 'openedAt', dir = 'desc' } = filters
      const q = search.trim().toLowerCase()
      const rows = db.cases.map(toRowCase).filter((r) => {
        if (tab === 'open' && r.status !== 'OPEN') return false
        if (tab === 'chronic' && r.status !== 'CHRONIC') return false
        if (tab === 'closed' && r.status !== 'CLOSED') return false
        if (severity && r.severity !== severity) return false
        if (penCode && r.penCode !== penCode) return false
        if (q && !`${r.cattleCode} ${r.cattleName} ${r.caseCode}`.toLowerCase().includes(q)) return false
        if (r.status === 'CLOSED' && ((from && r.openedDate < from) || (to && r.openedDate > to))) return false
        return true
      })
      const sign = dir === 'asc' ? 1 : -1
      rows.sort((a, b) => sign * (sort === 'caseCode' ? a.caseCode.localeCompare(b.caseCode) : a.openedAt.localeCompare(b.openedAt) || a.caseCode.localeCompare(b.caseCode)))
      const count = (s: string) => db.cases.filter((c) => c.status === s).length
      const pens = new Map<string, string>()
      for (const c of db.cases) { const k = cattleOf(c.cattleCode); if (k.penCode) pens.set(k.penCode, k.penName) }
      return structuredClone({
        rows,
        counts: { open: count('OPEN'), chronic: count('CHRONIC'), closed: count('CLOSED'), all: db.cases.length },
        pens: [...pens].map(([code, name]) => ({ code, name })).sort((a, b) => a.code.localeCompare(b.code)),
      })
    },

    async getProfile(cattleCode: string): Promise<HealthProfile> {
      const cases = db.cases.filter((c) => c.cattleCode === cattleCode).sort((a, b) => b.openedAt.localeCompare(a.openedAt))
      const active = cases.filter((c) => c.status !== 'CLOSED')
      const timeline = entriesOfCattle(cattleCode).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.id - a.id).map(toRow)
      return structuredClone({
        cattle: cattleOf(cattleCode),
        healthState: healthStateOf(cattleCode),
        withdrawalEndDate: cattleWithdrawal(cattleCode),
        suspectedContagious: active.some((c) => c.suspectedContagious),
        pendingExit: pendingExitOf(cattleCode),
        activeCases: active.map(toCard),
        previousCases: cases.filter((c) => c.status === 'CLOSED').map(toCard),
        timeline,
      })
    },

    async formOptions(): Promise<HealthFormOptions> {
      const diagnoses = [...new Set([...db.diagnoses, ...db.cases.map((c) => c.diagnosis).filter(Boolean)])]
      return structuredClone({ medicines: db.medicines, members: db.members, diagnoses })
    },

    async openCase(cattleCode: string, cmd: OpenCaseCommand): Promise<HealthCaseResult> {
      const cattle = ensureCattle(cattleCode)
      assertCanAdd(cattle)
      throwIf(openCaseErrors(cmd, { now: now(), entryDate: cattle.entryDate }))

      const base = { occurredAt: cmd.observedAt, recordedBy: memberName(cmd.observerId) || 'Quản lý', observerId: cmd.observerId ?? undefined, temperatureC: cmd.temperatureC, description: cmd.signs.trim() }
      const id = Math.max(0, ...db.cases.map((c) => c.id)) + 1
      const created: CaseRecord = {
        id, caseCode: `HC-${String(id).padStart(4, '0')}`, cattleCode, diagnosis: cmd.diagnosis.trim(), signs: cmd.signs.trim(), suspectedContagious: cmd.suspectedContagious,
        severity: cmd.severity as CaseRecord['severity'], openedAt: cmd.observedAt, status: 'OPEN', version: 1,
      }
      db.cases.push(created)
      const row = addEntry({ ...base, caseId: id, type: 'OPENING' })
      return structuredClone(result(created, 'OPENED', row.id))
    },

    async recordTreatment(caseId: number, cmd: TreatmentCommand): Promise<TreatmentResult> {
      const c = activeCase(caseId, cmd.expectedVersion)
      const cattle = cattleOf(c.cattleCode)
      assertCanAdd(cattle)
      const errors: Record<string, string> = {}
      const medicine = treatmentErrors(cmd as never, { cattle, openedAt: c.openedAt }, errors)
      throwIf(errors)
      // D59: ca theo dõi dài hạn về Đang mở, trừ khi người dùng giữ trạng thái cho điều trị duy trì.
      const returnedToOpen = c.status === 'CHRONIC' && cmd.returnToOpen !== false
      const row = addEntry({
        caseId, type: 'TREATMENT', occurredAt: cmd.treatmentTime, recordedBy: cmd.performer.trim() || 'Quản lý', temperatureC: null, medicineId: medicine!.id, medicineName: medicine!.name,
        dose: cmd.dose.trim(), route: cmd.route as Exclude<typeof cmd.route, ''>, courseDays: cmd.courseDays ?? 1, withdrawalDays: cmd.withdrawalDays ?? medicine!.withdrawalDays ?? 0, veterinaryAdvice: cmd.veterinaryAdvice.trim(),
      })
      if (returnedToOpen) { c.status = 'OPEN'; c.chronicSince = undefined }
      c.version += 1
      return structuredClone({
        id: row.id, caseId, caseCode: c.caseCode, caseVersion: c.version, caseStatus: c.status, withdrawalEndDate: withdrawalEnd(row.occurredAt, row.courseDays!, row.withdrawalDays!),
        courseDays: row.courseDays!, medicineName: medicine!.name, healthState: healthStateOf(c.cattleCode), returnedToOpen,
      })
    },

    async updateStatus(caseId: number, cmd: StatusCommand): Promise<HealthCaseResult> {
      const c = activeCase(caseId, cmd.expectedVersion)
      const cattle = cattleOf(c.cattleCode)
      assertCanAdd(cattle)
      const allowed = c.status === 'OPEN' ? ['KEEP', 'TO_CHRONIC', 'CLOSE'] : ['KEEP', 'TO_OPEN', 'CLOSE']
      if (!allowed.includes(cmd.action)) throw new Error(MSG.changed)
      const closing = cmd.action === 'CLOSE'
      throwIf(statusErrors(cmd, { now: now(), entryDate: cattle.entryDate, latestAt: toCard(c).latestEntryAt }))

      c.diagnosis = cmd.diagnosis.trim()
      c.suspectedContagious = cmd.suspectedContagious
      // D58: phần theo dõi và trạng thái là một lần cập nhật, cùng một thời điểm.
      const observationId = hasFollowUp(cmd)
        ? addEntry({ caseId, type: 'FOLLOW_UP', occurredAt: cmd.observedAt, recordedBy: memberName(cmd.confirmedById) || 'Quản lý', observerId: cmd.confirmedById ?? undefined, temperatureC: cmd.temperatureC, progress: cmd.progress as Progress, description: cmd.description.trim() }).id
        : null
      let kind: HealthCaseResult['kind'] = 'KEPT'
      let voucher: PendingExit | null = null
      if (cmd.action === 'TO_CHRONIC') { c.status = 'CHRONIC'; c.chronicSince = dateOf(cmd.observedAt); kind = 'CHRONIC' }
      else if (cmd.action === 'TO_OPEN') { c.status = 'OPEN'; c.chronicSince = undefined; kind = 'REOPENED' }
      else if (closing) {
        c.status = 'CLOSED'; c.outcome = cmd.outcome as CaseRecord['outcome']; c.closedAt = cmd.observedAt; c.closedBy = memberName(cmd.confirmedById) || 'Quản lý'; kind = 'CLOSED'
        if (c.outcome === 'DIED' || c.outcome === 'MISSING') {
          // GBR-95: phiếu xuất chờ cho Chủ trại; bò vẫn ACTIVE đến khi Chủ trại xác nhận (herd-exit đọc phiếu này khi nối backend).
          voucher = {
            id: Math.max(0, ...db.vouchers.map((v) => v.id)) + 1, cattleCode: c.cattleCode, caseCode: c.caseCode, type: c.outcome === 'DIED' ? 'DEATH' : 'OTHER',
            reason: c.outcome === 'DIED' ? 'Chết' : 'Mất tích', date: dateOf(cmd.observedAt), reportedBy: c.closedBy, status: 'PENDING',
          }
          db.vouchers.push(voucher)
        }
      }
      c.version += 1
      return structuredClone(result(c, kind, observationId, voucher))
    },

    async reopenCase(caseId: number, cmd: ReopenCaseCommand): Promise<HealthCaseResult> {
      const c = caseById(caseId)
      if (c.status !== 'CLOSED' || !c.outcome || c.outcome === 'CLOSED_BY_EXIT' || (cmd.expectedVersion !== undefined && cmd.expectedVersion !== c.version)) throw new Error(MSG.changed)
      const cattle = cattleOf(c.cattleCode)
      assertExitedFree(cattle)
      throwIf(reasonErrors(cmd.reason))
      // D62: ca Chết / Mất tích mở lại thì phiếu chờ xác nhận của ca đó bị bác.
      if (c.outcome === 'DIED' || c.outcome === 'MISSING') db.vouchers = db.vouchers.filter((v) => v.caseCode !== c.caseCode)
      else assertCanAdd(cattle)
      Object.assign(c, { status: 'OPEN', outcome: undefined, closedAt: undefined, closedBy: undefined, chronicSince: undefined })
      c.version += 1
      return structuredClone(result(c, 'RESUMED', null))
    },

    async correctEntry(entryId: number, cmd: CorrectEntryCommand): Promise<RecordResult> {
      const e = db.entries.find((x) => x.id === entryId)
      if (!e || e.status !== 'VALID' || (cmd.expectedVersion !== undefined && cmd.expectedVersion !== e.version)) throw new Error(MSG.changed)
      const c = caseById(e.caseId)
      if (c.outcome === 'CLOSED_BY_EXIT') throw new Error(MSG.changed)
      const cattle = cattleOf(c.cattleCode)
      assertExitedFree(cattle)
      const before = cattleWithdrawal(c.cattleCode)
      const errors: Record<string, string> = {}
      Object.assign(errors, reasonErrors(cmd.reason))
      const snapshot: Record<string, unknown> = {}
      if (e.type === 'TREATMENT') {
        const next = {
          medicineId: cmd.medicineId ?? e.medicineId!, treatmentTime: cmd.treatmentTime ?? e.occurredAt, dose: cmd.dose ?? e.dose!, route: (cmd.route || e.route)!,
          courseDays: cmd.courseDays === undefined || cmd.courseDays === null ? e.courseDays! : cmd.courseDays, withdrawalDays: cmd.withdrawalDays === undefined || cmd.withdrawalDays === null ? e.withdrawalDays! : cmd.withdrawalDays, performer: cmd.performer ?? e.recordedBy,
        }
        const medicine = treatmentErrors(next as never, { cattle, openedAt: c.openedAt, currentMedicineId: e.medicineId }, errors)
        throwIf(errors)
        Object.assign(snapshot, { medicineId: e.medicineId, occurredAt: e.occurredAt, dose: e.dose, route: e.route, courseDays: e.courseDays, withdrawalDays: e.withdrawalDays, recordedBy: e.recordedBy })
        Object.assign(e, { medicineId: medicine!.id, medicineName: medicine!.name, occurredAt: next.treatmentTime, dose: next.dose.trim(), route: next.route, courseDays: next.courseDays, withdrawalDays: next.withdrawalDays, recordedBy: next.performer.trim() || e.recordedBy })
      } else {
        const opening = e.type === 'OPENING'
        const others = validOf(c.id).filter((x) => x.id !== e.id).map((x) => x.occurredAt).sort()
        const next = {
          time: cmd.observedAt ?? e.occurredAt, temperatureC: cmd.temperatureC === undefined ? e.temperatureC : cmd.temperatureC,
          progress: cmd.progress === undefined ? e.progress : cmd.progress, description: cmd.description ?? e.description ?? '',
        }
        observationErrors('Thời điểm quan sát', next, { cattle, min: opening ? undefined : c.openedAt, minWhat: 'lúc mở ca' }, errors)
        if (opening && next.time > (others[0] ?? next.time)) errors.observedAt = MSG.beforeCase(others[0], 'lần ghi kế tiếp của ca này').replace('không được trước', 'không được sau')
        if (e.type === 'FOLLOW_UP' && !next.progress) errors.progress = MSG.required('Diễn biến')
        const description = textError(opening ? 'Dấu hiệu / mô tả' : 'Mô tả', next.description, { required: true, max: 1000 }); if (description) errors.description = description
        throwIf(errors)
        Object.assign(snapshot, { occurredAt: e.occurredAt, temperatureC: e.temperatureC, progress: e.progress, description: e.description })
        Object.assign(e, { occurredAt: next.time, temperatureC: next.temperatureC, description: next.description.trim(), ...(cmd.observerId ? { recordedBy: memberName(cmd.observerId) || e.recordedBy, observerId: cmd.observerId } : {}) })
        if (e.type === 'FOLLOW_UP') e.progress = next.progress as Exclude<typeof next.progress, '' | undefined>
        if (opening) { c.openedAt = next.time; c.signs = next.description.trim() }
      }
      e.revisions.push({ at: now(), reason: cmd.reason.trim(), actor: 'Quản lý', kind: 'CORRECTED', before: snapshot })
      e.corrected = true
      e.version += 1
      return structuredClone({
        id: e.id, status: e.status, version: e.version, healthState: healthStateOf(c.cattleCode), action: 'CORRECTED', recordType: e.type === 'TREATMENT' ? 'TREATMENT' : 'FOLLOW_UP',
        cattleCode: c.cattleCode, withdrawalBefore: before, withdrawalAfter: cattleWithdrawal(c.cattleCode),
      })
    },

    async voidEntry(entryId: number, cmd: VoidEntryCommand): Promise<RecordResult> {
      const e = db.entries.find((x) => x.id === entryId)
      if (!e || e.status !== 'VALID' || (cmd.expectedVersion !== undefined && cmd.expectedVersion !== e.version)) throw new Error(MSG.changed)
      if (e.type === 'OPENING') throw new Error(MSG.voidOpening)
      const c = caseById(e.caseId)
      if (c.outcome === 'CLOSED_BY_EXIT') throw new Error(MSG.changed)
      assertExitedFree(cattleOf(c.cattleCode))
      throwIf(reasonErrors(cmd.reason))
      const before = cattleWithdrawal(c.cattleCode)
      e.revisions.push({ at: now(), reason: cmd.reason.trim(), actor: 'Quản lý', kind: 'VOIDED', before: {} })
      e.status = 'VOIDED'
      e.version += 1
      return structuredClone({
        id: e.id, status: e.status, version: e.version, healthState: healthStateOf(c.cattleCode), action: 'VOIDED', recordType: e.type === 'TREATMENT' ? 'TREATMENT' : 'FOLLOW_UP',
        cattleCode: c.cattleCode, withdrawalBefore: before, withdrawalAfter: cattleWithdrawal(c.cattleCode),
      })
    },

    async reset() { db = structuredClone(seed) },
  }
}

export type HealthDemoStore = ReturnType<typeof createHealthDemoStore>
export const healthDemoStore = createHealthDemoStore()
