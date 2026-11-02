import type {
  CattleVaccination, CorrectVaccinationCommand, DeferDoseCommand, DoseFilters, DosePage, DoseRow, DoseTab, HistoryFilters, HistoryPage, RecordContext, RecordVaccinationsCommand,
  Schedule, ScheduleCard, ScheduleCommand, ScheduleDetail, ScheduleResult, ScheduleTarget, ScheduledDose, VaccCattle, VaccinationBatchResult, VaccinationOptions, VaccinationRecord, VoidRecordCommand,
} from '../types'
import { addDays, addMonths, dayNumber, fmtDate } from '../domain/vaccinationFormat'
import {
  CONFLICT_MESSAGE, VaccinationValidationError, doseDate, doseTextOf, dueStateOf, effectiveDate, hasErrors, plannedDoseRows, resolveTarget, validateDefer, validateReason, validateRecordFields, validateSchedule, withdrawalEndOf,
  type FieldErrors,
} from '../domain/vaccinationRules'
import { MEMBERS, STATIC_OPTIONS, VACCINES, VACC_DEMO, VACC_NOW } from './vaccinationMock'

const PAGE_SIZE = 6
const clone = <T>(v: T): T => structuredClone(v)
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

export function createVaccinationDemoStore(seed = VACC_DEMO, now: () => string = () => VACC_NOW) {
  let cattle = clone(seed.cattle)
  let schedules = clone(seed.schedules)
  let doses = clone(seed.doses)
  let records = clone(seed.records)
  let ids = { dose: seed.nextDoseId, record: seed.nextRecordId, schedule: seed.nextScheduleId }

  const today = () => now().slice(0, 10)
  const vaccineOf = (id?: number) => VACCINES.find((v) => v.id === id)
  const cattleOf = (code: string) => cattle.find((c) => c.code === code)
  const scheduleOf = (id: number) => schedules.find((s) => s.id === id)
  const activeSchedules = () => schedules.filter((s) => s.status === 'ACTIVE')
  const live = (d: ScheduledDose) => d.status !== 'CANCELLED'

  const rowOf = (d: ScheduledDose): DoseRow => {
    const s = scheduleOf(d.scheduleId)!
    const c = cattleOf(d.cattleCode)!
    const state = dueStateOf(d, today())
    return {
      id: d.id, cattleCode: c.code, cattleName: c.name, breed: c.breed, sex: c.sex, penName: c.penName,
      scheduleId: s.id, scheduleName: s.name, scheduleShort: s.name.split(' – ')[0], doseNo: d.doseNo, doseCount: s.doseCount, kind: d.kind,
      doseText: doseTextOf(d.kind, d.doseNo, s.doseCount), dueDate: d.dueDate, effectiveDate: effectiveDate(d), newExpectedDate: d.newExpectedDate,
      state, daysOverdue: state === 'OVERDUE' ? dayNumber(today()) - dayNumber(d.dueDate) : 0, rawStatus: d.status, doneAt: d.doneAt, version: d.version,
    }
  }

  /** Mỗi (lịch, bò) chỉ hiện một dòng: mũi đang cần tiêm, hoặc mũi cuối đã tiêm; mũi nhắc lại chỉ chen vào khi đã đến hạn. */
  const headDoses = (scheduleId?: number): ScheduledDose[] => {
    const groups = new Map<string, ScheduledDose[]>()
    doses.filter((d) => live(d) && scheduleOf(d.scheduleId)?.status === 'ACTIVE' && (!scheduleId || d.scheduleId === scheduleId)).forEach((d) => {
      const key = `${d.scheduleId}|${d.cattleCode}`
      groups.set(key, [...(groups.get(key) ?? []), d])
    })
    const heads: ScheduledDose[] = []
    groups.forEach((list) => {
      const regular = list.filter((d) => d.kind === 'DOSE').sort((a, b) => a.doseNo - b.doseNo)
      const boosters = list.filter((d) => d.kind === 'BOOSTER' && d.status !== 'DONE').sort((a, b) => a.doseNo - b.doseNo)
      const open = regular.find((d) => d.status !== 'DONE')
      const dueBooster = boosters.find((d) => ['OVERDUE', 'DUE'].includes(dueStateOf(d, today())))
      const head = open ?? dueBooster ?? regular[regular.length - 1] ?? boosters[0]
      if (head) heads.push(head)
    })
    return heads
  }

  const mustHave = <T,>(v: T | undefined, message = 'Không tìm thấy dữ liệu.'): T => {
    if (v === undefined) throw new Error(message)
    return v
  }

  /** GBR-41: đồng bộ các mũi dự kiến theo định nghĩa lịch và tập bò đích. */
  const syncDoses = (s: Schedule, redate: boolean) => {
    const members = resolveTarget(cattle, s.target)
    const codes = new Set(members.map((m) => m.code))
    doses.forEach((d) => {
      if (d.scheduleId !== s.id || d.status === 'DONE' || d.status === 'CANCELLED') return
      if (!codes.has(d.cattleCode) || (d.kind === 'DOSE' && d.doseNo > s.doseCount)) d.status = 'CANCELLED'
      else if (redate && d.kind === 'DOSE' && d.status === 'PLANNED') d.dueDate = doseDate(s, d.doseNo)
    })
    let created = 0
    members.forEach((m) => {
      for (let n = 1; n <= s.doseCount; n++) {
        if (doses.some((d) => d.scheduleId === s.id && d.cattleCode === m.code && d.kind === 'DOSE' && d.doseNo === n && d.status !== 'CANCELLED')) continue
        doses.push({ id: ids.dose++, scheduleId: s.id, cattleCode: m.code, doseNo: n, kind: 'DOSE', dueDate: doseDate(s, n), status: 'PLANNED', version: 1 })
        created++
      }
    })
    return { targetCount: members.length, created }
  }

  const scheduleErrors = (cmd: ScheduleCommand, exceptId?: number): FieldErrors => {
    const errors = validateSchedule(cmd, { activeNames: activeSchedules().filter((s) => s.id !== exceptId).map((s) => s.name), vaccine: vaccineOf(cmd.vaccineId) })
    if (!hasErrors(errors) && resolveTarget(cattle, cmd.target).length === 0) errors.form = 'Không có bò đang nuôi nào khớp với nhóm đã chọn.'
    return errors
  }

  const detailOf = (s: Schedule): ScheduleDetail => {
    const targetCount = resolveTarget(cattle, s.target).length
    return { schedule: clone(s), vaccine: clone(vaccineOf(s.vaccineId)!), targetCount, plannedRows: plannedDoseRows(s, doses.filter((d) => d.scheduleId === s.id), targetCount, today()) }
  }

  /** Đóng một mũi theo lịch khi đã ghi nhận tiêm; sinh mũi nhắc lại khi là mũi cuối của chuỗi (AF3). */
  const closeDose = (d: ScheduledDose, r: VaccinationRecord) => {
    d.prior = { status: d.status, newExpectedDate: d.newExpectedDate, deferralReason: d.deferralReason }
    d.status = 'DONE'
    d.vaccinationId = r.id
    d.doneAt = r.administeredAt
    d.version++
    r.scheduledDoseId = d.id
    r.doseText = doseTextOf(d.kind, d.doseNo, scheduleOf(d.scheduleId)!.doseCount)
    const s = scheduleOf(d.scheduleId)!
    const hasOpenBooster = doses.some((x) => x.scheduleId === s.id && x.cattleCode === d.cattleCode && x.kind === 'BOOSTER' && x.status !== 'DONE' && x.status !== 'CANCELLED')
    if (s.status === 'ACTIVE' && s.boosterIntervalMonths && (d.kind === 'BOOSTER' || d.doseNo === s.doseCount) && !hasOpenBooster) {
      const nextNo = Math.max(s.doseCount, ...doses.filter((x) => x.scheduleId === s.id && x.cattleCode === d.cattleCode).map((x) => x.doseNo)) + 1
      const booster: ScheduledDose = { id: ids.dose++, scheduleId: s.id, cattleCode: d.cattleCode, doseNo: nextNo, kind: 'BOOSTER', dueDate: addMonths(r.administeredAt.slice(0, 10), s.boosterIntervalMonths), status: 'PLANNED', version: 1 }
      doses.push(booster)
      r.spawnedDoseId = booster.id
    }
  }

  const applyDefer = (d: ScheduledDose, cmd: Pick<DeferDoseCommand, 'reason' | 'newExpectedDate' | 'note'>) => {
    d.status = 'DEFERRED'
    d.deferralReason = cmd.reason.trim()
    d.newExpectedDate = cmd.newExpectedDate || undefined
    d.deferralNote = cmd.note?.trim() || undefined
    d.version++
  }

  const liveRecord = (id: number, expectedVersion: number) => {
    const r = mustHave(records.find((x) => x.id === id), 'Không tìm thấy bản ghi tiêm.')
    if (r.version !== expectedVersion || r.status !== 'VALID') throw new Error(CONFLICT_MESSAGE)
    return r
  }

  return {
    async options(): Promise<VaccinationOptions> {
      return clone({ ...STATIC_OPTIONS, members: MEMBERS, vaccines: VACCINES.filter((v) => v.active), now: now() })
    },

    async listSchedules(): Promise<ScheduleCard[]> {
      return clone(
        activeSchedules().map((s) => {
          const own = doses.filter((d) => d.scheduleId === s.id && live(d))
          const byCattle = new Map<string, ScheduledDose[]>()
          own.filter((d) => d.kind === 'DOSE').forEach((d) => byCattle.set(d.cattleCode, [...(byCattle.get(d.cattleCode) ?? []), d]))
          const doneCount = [...byCattle.values()].filter((list) => list.find((d) => d.doseNo === s.doseCount)?.status === 'DONE').length
          return {
            schedule: s, vaccine: vaccineOf(s.vaccineId)!, targetCount: resolveTarget(cattle, s.target).length, doneCount,
            overdueCount: own.filter((d) => dueStateOf(d, today()) === 'OVERDUE').length,
          }
        }),
      )
    },

    async listDoses(filters: DoseFilters = {}): Promise<DosePage> {
      const all = headDoses(filters.scheduleId).map(rowOf)
      const count = (state: DoseRow['state']) => all.filter((r) => r.state === state).length
      const counts: Record<DoseTab, number> = { all: all.length, overdue: count('OVERDUE'), due: count('DUE'), upcoming: count('UPCOMING'), deferred: count('DEFERRED'), done: count('DONE') }
      const tab = filters.tab ?? 'all'
      const stateOf: Record<string, DoseRow['state']> = { overdue: 'OVERDUE', due: 'DUE', upcoming: 'UPCOMING', deferred: 'DEFERRED', done: 'DONE' }
      const sign = filters.dir === 'desc' ? -1 : 1
      const rows = all.filter((r) => tab === 'all' || r.state === stateOf[tab]).sort((a, b) => sign * cmp(a.effectiveDate, b.effectiveDate) || cmp(a.cattleCode, b.cattleCode))
      const size = filters.size ?? PAGE_SIZE
      const page = Math.min(Math.max(1, filters.page ?? 1), Math.max(1, Math.ceil(rows.length / size)))
      return clone({ rows: rows.slice((page - 1) * size, page * size), total: rows.length, page, size, counts })
    },

    async getDose(id: number): Promise<DoseRow & { cattleCode: string }> {
      return clone(rowOf(mustHave(doses.find((d) => d.id === id), 'Không tìm thấy mũi tiêm.')))
    },

    async getSchedule(id: number): Promise<ScheduleDetail> {
      return clone(detailOf(mustHave(scheduleOf(id), 'Không tìm thấy lịch tiêm.')))
    },

    async previewTarget(target: ScheduleTarget): Promise<VaccCattle[]> {
      return clone(resolveTarget(cattle, target))
    },

    async previewPlan(cmd: ScheduleCommand, targetCount: number) {
      return plannedDoseRows({ firstDueDate: cmd.firstDueDate || today(), intervalDays: cmd.intervalDays, doseCount: cmd.doseCount ?? 0, boosterIntervalMonths: cmd.boosterIntervalMonths }, [], targetCount, today())
    },

    async createSchedule(cmd: ScheduleCommand): Promise<ScheduleResult> {
      const errors = scheduleErrors(cmd)
      if (hasErrors(errors)) throw new VaccinationValidationError(errors)
      const s: Schedule = {
        id: ids.schedule++, name: cmd.name.trim(), vaccineId: cmd.vaccineId!, firstDueDate: cmd.firstDueDate, doseCount: cmd.doseCount!, intervalDays: cmd.doseCount! > 1 ? cmd.intervalDays : undefined,
        boosterIntervalMonths: cmd.boosterIntervalMonths, status: 'ACTIVE', version: 1, target: clone(cmd.target),
      }
      schedules.push(s)
      const { targetCount, created } = syncDoses(s, false)
      return clone({ schedule: s, targetCount, plannedDoseCount: created, message: `Đã lưu lịch ${s.name}: ${created} mũi dự kiến cho ${targetCount} bò.` })
    },

    async updateSchedule(id: number, cmd: ScheduleCommand): Promise<ScheduleResult> {
      const s = mustHave(scheduleOf(id), 'Không tìm thấy lịch tiêm.')
      if (s.status !== 'ACTIVE' || (cmd.expectedVersion !== undefined && cmd.expectedVersion !== s.version)) throw new Error(CONFLICT_MESSAGE)
      const errors = scheduleErrors(cmd, id)
      if (hasErrors(errors)) throw new VaccinationValidationError(errors)
      const redate = cmd.firstDueDate !== s.firstDueDate || cmd.intervalDays !== s.intervalDays
      Object.assign(s, {
        name: cmd.name.trim(), vaccineId: cmd.vaccineId!, firstDueDate: cmd.firstDueDate, doseCount: cmd.doseCount!, intervalDays: cmd.doseCount! > 1 ? cmd.intervalDays : undefined,
        boosterIntervalMonths: cmd.boosterIntervalMonths, target: clone(cmd.target), version: s.version + 1,
      })
      const { targetCount, created } = syncDoses(s, redate)
      return clone({ schedule: s, targetCount, plannedDoseCount: created, message: `Đã lưu lịch ${s.name}: ${created} mũi dự kiến mới cho ${targetCount} bò.` })
    },

    async stopSchedule(id: number, cmd: { reason: string; expectedVersion: number }): Promise<ScheduleResult> {
      const s = mustHave(scheduleOf(id), 'Không tìm thấy lịch tiêm.')
      const errors = validateReason(cmd.reason)
      if (hasErrors(errors)) throw new VaccinationValidationError(errors)
      if (s.status !== 'ACTIVE' || s.version !== cmd.expectedVersion) throw new Error(CONFLICT_MESSAGE)
      let cancelled = 0
      doses.forEach((d) => {
        if (d.scheduleId === s.id && (d.status === 'PLANNED' || d.status === 'DEFERRED')) { d.status = 'CANCELLED'; cancelled++ }
      })
      Object.assign(s, { status: 'STOPPED', stopReason: cmd.reason.trim(), version: s.version + 1 })
      return clone({ schedule: s, targetCount: 0, plannedDoseCount: cancelled, message: `Đã dừng lịch ${s.name}.` })
    },

    async recordContext(input: { doseIds?: number[]; cattleCodes?: string[] }): Promise<RecordContext> {
      const rows: RecordContext['rows'] = []
      ;(input.doseIds ?? []).forEach((id) => {
        const d = doses.find((x) => x.id === id)
        const c = d && cattleOf(d.cattleCode)
        if (d && c && (d.status === 'PLANNED' || d.status === 'DEFERRED')) rows.push({ cattle: c, dose: rowOf(d) })
      })
      ;(input.cattleCodes ?? []).forEach((code) => {
        const c = cattleOf(code)
        if (!c || rows.some((r) => r.cattle.code === code)) return
        const open = doses.filter((d) => d.cattleCode === code && (d.status === 'PLANNED' || d.status === 'DEFERRED') && scheduleOf(d.scheduleId)?.status === 'ACTIVE').sort((a, b) => cmp(effectiveDate(a), effectiveDate(b)))[0]
        rows.push({ cattle: c, dose: open && rowOf(open) })
      })
      const doseRows = rows.map((r) => r.dose)
      const same = doseRows.length > 0 && doseRows.every((d) => d && d.scheduleId === doseRows[0]!.scheduleId && d.doseText === doseRows[0]!.doseText)
      const title = same ? `Ghi nhận tiêm – ${doseRows[0]!.scheduleShort} · ${doseRows[0]!.doseText}` : rows.length === 1 ? `Ghi nhận tiêm – ${rows[0].cattle.code}` : 'Ghi nhận tiêm'
      const firstDose = doseRows.find(Boolean)
      return clone({ rows, options: await this.options(), title, vaccineId: firstDose ? scheduleOf(firstDose.scheduleId)?.vaccineId : undefined })
    },

    async recordVaccinations(cmd: RecordVaccinationsCommand): Promise<VaccinationBatchResult> {
      if (!cmd.animals.length) throw new VaccinationValidationError({ form: 'Chưa chọn bò nào để ghi nhận.' })
      const vaccine = vaccineOf(cmd.vaccineId)
      const vaccinated = cmd.animals.filter((a) => a.decision === 'VACCINATE')
      const herdEntryDate = vaccinated.map((a) => cattleOf(a.cattleCode)?.herdEntryDate ?? '').sort().pop() || undefined
      const fields = validateRecordFields(cmd, { now: now(), vaccine, herdEntryDate })
      const rowErrors: FieldErrors = {}
      cmd.animals.filter((a) => a.decision === 'DEFER').forEach((a) => {
        const e = validateDefer({ reason: a.deferralReason, newExpectedDate: a.newExpectedDate }, today())
        if (e.reason) rowErrors[a.cattleCode] = 'Lý do chưa tiêm là bắt buộc.'
        else if (e.newExpectedDate) rowErrors[a.cattleCode] = e.newExpectedDate
      })
      if (hasErrors(fields) || hasErrors(rowErrors)) throw new VaccinationValidationError(fields, rowErrors)

      const skipped: VaccinationBatchResult['skipped'] = []
      const vaccinationIds: number[] = []
      let deferredCount = 0
      for (const a of cmd.animals) {
        const c = cattleOf(a.cattleCode)
        if (!c || c.status !== 'ACTIVE') { skipped.push({ cattleCode: a.cattleCode, message: `${a.cattleCode} đã rời đàn nên được bỏ qua.` }); continue }
        let dose = a.scheduledDoseId ? doses.find((d) => d.id === a.scheduledDoseId) : undefined
        if (!dose && a.decision === 'VACCINATE' && cmd.source === 'ON_FARM') {
          dose = doses.filter((d) => d.cattleCode === a.cattleCode && (d.status === 'PLANNED' || d.status === 'DEFERRED') && scheduleOf(d.scheduleId)?.status === 'ACTIVE' && scheduleOf(d.scheduleId)?.vaccineId === cmd.vaccineId).sort((x, y) => cmp(effectiveDate(x), effectiveDate(y)))[0]
        }
        if (dose && dose.status === 'DONE') { skipped.push({ cattleCode: a.cattleCode, message: `${a.cattleCode} đã tiêm mũi ${dose.doseNo} của lịch này nên được bỏ qua.` }); continue }
        if (dose && (dose.status === 'CANCELLED' || (a.expectedDoseVersion !== undefined && a.expectedDoseVersion !== dose.version))) { skipped.push({ cattleCode: a.cattleCode, message: `${a.cattleCode}: mũi tiêm đã thay đổi nên được bỏ qua.` }); continue }
        if (a.decision === 'DEFER') {
          if (!dose) { skipped.push({ cattleCode: a.cattleCode, message: `${a.cattleCode} chưa có mũi theo lịch để hoãn.` }); continue }
          applyDefer(dose, { reason: a.deferralReason!, newExpectedDate: a.newExpectedDate })
          deferredCount++
          continue
        }
        const days = cmd.source === 'ON_FARM' ? cmd.withdrawalDays ?? vaccine!.withdrawalDays : 0
        const r: VaccinationRecord = {
          id: ids.record++, cattleCode: c.code, vaccineId: vaccine!.id, vaccineLabel: vaccine!.shortName, batchNo: cmd.batchNo?.trim() || undefined, dose: cmd.dose, route: cmd.route,
          administeredAt: cmd.administeredAt, precision: 'EXACT', source: cmd.source, vaccinator: cmd.vaccinator?.trim() || undefined, withdrawalDays: days,
          withdrawalEndDate: withdrawalEndOf(cmd.source, cmd.administeredAt, days), status: 'VALID', corrected: false, version: 1, revisions: [],
        }
        records.push(r)
        if (dose && cmd.source === 'ON_FARM') closeDose(dose, r)
        vaccinationIds.push(r.id)
      }
      const result = { vaccinatedCount: vaccinationIds.length, deferredCount, vaccinationIds, skipped }
      return clone({ ...result, message: `Đã ghi nhận ${result.vaccinatedCount} mũi tiêm; hoãn ${deferredCount} mũi.` })
    },

    async deferDose(id: number, cmd: DeferDoseCommand) {
      const d = mustHave(doses.find((x) => x.id === id), 'Không tìm thấy mũi tiêm.')
      if (d.version !== cmd.expectedVersion || (d.status !== 'PLANNED' && d.status !== 'DEFERRED')) throw new Error(CONFLICT_MESSAGE)
      const errors = validateDefer(cmd, today())
      if (hasErrors(errors)) throw new VaccinationValidationError(errors)
      applyDefer(d, cmd)
      return clone({ id: d.id, status: d.status, version: d.version, reason: d.deferralReason, newExpectedDate: d.newExpectedDate, message: `Đã hoãn mũi tiêm${d.newExpectedDate ? ` đến ${fmtDate(d.newExpectedDate)}` : ''}.` })
    },

    async listHistory(filters: HistoryFilters = {}): Promise<HistoryPage> {
      const from = filters.from || addMonths(today(), -3)
      const to = filters.to || today()
      const q = filters.q?.trim().toLowerCase()
      const rows = records
        .filter((r) => {
          const day = r.administeredAt.slice(0, 10)
          const c = cattleOf(r.cattleCode)
          return day >= from && day <= to && (!filters.vaccineId || r.vaccineId === filters.vaccineId) && (!filters.source || r.source === filters.source) && (!q || [r.cattleCode, c?.name].some((v) => v?.toLowerCase().includes(q)))
        })
        .sort((a, b) => cmp(b.administeredAt, a.administeredAt) || cmp(a.cattleCode, b.cattleCode))
        .map((r) => ({ ...r, penCode: cattleOf(r.cattleCode)?.penCode ?? '' }))
      const size = filters.size ?? PAGE_SIZE
      const page = Math.min(Math.max(1, filters.page ?? 1), Math.max(1, Math.ceil(rows.length / size)))
      return clone({ rows: rows.slice((page - 1) * size, page * size), total: rows.length, page, size, from, to })
    },

    async getCattleVaccination(code: string): Promise<CattleVaccination> {
      const c = cattleOf(code) ?? ({ code, breed: '', sex: 'Cái', penCode: '', penName: '', herdGroup: 'OTHER', lifeStage: 'ADULT', herdEntryDate: '2020-01-01', status: 'ACTIVE' } as VaccCattle)
      const open = doses.filter((d) => d.cattleCode === code && (d.status === 'PLANNED' || d.status === 'DEFERRED') && scheduleOf(d.scheduleId)?.status === 'ACTIVE' && cattleOf(code))
      return clone({
        cattle: c,
        doses: open.map(rowOf).sort((a, b) => cmp(a.effectiveDate, b.effectiveDate)),
        records: records.filter((r) => r.cattleCode === code).sort((a, b) => cmp(b.administeredAt, a.administeredAt)),
      })
    },

    async correctRecord(id: number, cmd: CorrectVaccinationCommand): Promise<VaccinationRecord> {
      const r = liveRecord(id, cmd.expectedVersion)
      const c = cattleOf(r.cattleCode)
      const fields = { ...validateRecordFields({ vaccineId: cmd.vaccineId, source: r.source, administeredAt: cmd.administeredAt, batchNo: cmd.batchNo, withdrawalDays: cmd.withdrawalDays, vaccinator: cmd.vaccinator }, { now: now(), vaccine: vaccineOf(cmd.vaccineId), herdEntryDate: c?.herdEntryDate }), ...validateReason(cmd.reason) }
      if (hasErrors(fields)) throw new VaccinationValidationError(fields)
      const before = { vaccineId: r.vaccineId ?? 0, administeredAt: r.administeredAt, batchNo: r.batchNo, dose: r.dose, route: r.route, withdrawalDays: r.withdrawalDays, vaccinator: r.vaccinator }
      const vaccine = vaccineOf(cmd.vaccineId)!
      const days = r.source === 'ON_FARM' ? cmd.withdrawalDays ?? 0 : 0
      Object.assign(r, {
        vaccineId: vaccine.id, vaccineLabel: vaccine.shortName, administeredAt: cmd.administeredAt, batchNo: cmd.batchNo?.trim() || undefined, dose: cmd.dose, route: cmd.route,
        vaccinator: cmd.vaccinator?.trim() || undefined, withdrawalDays: days, withdrawalEndDate: withdrawalEndOf(r.source, cmd.administeredAt, days), corrected: true, version: r.version + 1,
        precision: 'EXACT',
      })
      r.revisions.push({ at: now(), by: 'Quản lý trại', action: 'CORRECT', reason: cmd.reason.trim(), before })
      return clone(r)
    },

    async voidRecord(id: number, cmd: VoidRecordCommand): Promise<VaccinationRecord> {
      const errors = validateReason(cmd.reason)
      if (hasErrors(errors)) throw new VaccinationValidationError(errors)
      const r = liveRecord(id, cmd.expectedVersion)
      const before = { vaccineId: r.vaccineId ?? 0, administeredAt: r.administeredAt, batchNo: r.batchNo, dose: r.dose, route: r.route, withdrawalDays: r.withdrawalDays, vaccinator: r.vaccinator }
      const dose = r.scheduledDoseId ? doses.find((d) => d.id === r.scheduledDoseId) : undefined
      if (dose) {
        const stopped = scheduleOf(dose.scheduleId)?.status !== 'ACTIVE'
        dose.status = stopped ? 'CANCELLED' : dose.prior?.status === 'DEFERRED' ? 'DEFERRED' : 'PLANNED'
        dose.newExpectedDate = dose.prior?.newExpectedDate
        dose.deferralReason = dose.prior?.deferralReason
        dose.vaccinationId = undefined
        dose.doneAt = undefined
        dose.version++
      }
      if (r.spawnedDoseId) doses = doses.filter((d) => !(d.id === r.spawnedDoseId && d.status === 'PLANNED'))
      Object.assign(r, { status: 'VOIDED', withdrawalEndDate: undefined, version: r.version + 1 })
      r.revisions.push({ at: now(), by: 'Quản lý trại', action: 'VOID', reason: cmd.reason.trim(), before })
      return clone(r)
    },

    async reset() {
      cattle = clone(seed.cattle)
      schedules = clone(seed.schedules)
      doses = clone(seed.doses)
      records = clone(seed.records)
      ids = { dose: seed.nextDoseId, record: seed.nextRecordId, schedule: seed.nextScheduleId }
    },
  }
}
export type VaccinationDemoStore = ReturnType<typeof createVaccinationDemoStore>
export const vaccinationDemoStore = createVaccinationDemoStore()
