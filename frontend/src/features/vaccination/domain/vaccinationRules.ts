import type { DueState, PlannedDoseRow, Schedule, ScheduledDose, ScheduleTarget, VaccCattle, VaccinationSource } from '../types'
import { addDays, addMonths, dayNumber } from './vaccinationFormat'

export const BATCH_MAX = 50
export const VACCINATOR_MAX = 50 * 2
export const REASON_MAX = 500
export const NOTE_MAX = 255
export const DUE_SOON_DAYS = 7

export type FieldErrors = Record<string, string>

export class VaccinationValidationError extends Error {
  fields: FieldErrors
  rows: FieldErrors
  constructor(fields: FieldErrors, rows: FieldErrors = {}) {
    super(Object.values(fields)[0] ?? Object.values(rows)[0] ?? 'Dữ liệu không hợp lệ.')
    this.name = 'VaccinationValidationError'
    this.fields = fields
    this.rows = rows
  }
}

export const hasErrors = (e: FieldErrors) => Object.keys(e).length > 0
export const CONFLICT_MESSAGE = 'Bản ghi đã thay đổi hoặc không còn ở trạng thái cho phép thao tác. Vui lòng tải lại và kiểm tra trước khi thử lại.'

export const effectiveDate = (d: Pick<ScheduledDose, 'status' | 'dueDate' | 'newExpectedDate'>) => (d.status === 'DEFERRED' && d.newExpectedDate ? d.newExpectedDate : d.dueDate)

/** GBR-43: trạng thái đến hạn suy ra từ ngày dự kiến và hôm nay. */
export function dueStateOf(d: Pick<ScheduledDose, 'status' | 'dueDate' | 'newExpectedDate'>, today: string): DueState {
  if (d.status === 'DONE') return 'DONE'
  if (d.status === 'DEFERRED') return 'DEFERRED'
  const diff = dayNumber(d.dueDate) - dayNumber(today)
  return diff < 0 ? 'OVERDUE' : diff <= DUE_SOON_DAYS ? 'DUE' : 'UPCOMING'
}

export const withdrawalEndOf = (source: VaccinationSource, administeredAt: string, days: number | undefined) =>
  source === 'ON_FARM' && days && days > 0 ? addDays(administeredAt.slice(0, 10), days) : undefined

/** GBR-41: các điều kiện kết hợp bằng AND; bỏ ra và thêm từng con áp dụng sau cùng. */
export function resolveTarget(cattle: VaccCattle[], t: ScheduleTarget): VaccCattle[] {
  const active = cattle.filter((c) => c.status === 'ACTIVE')
  const matched = active.filter(
    (c) =>
      !t.excluded.includes(c.code) &&
      (!t.penCodes.length || t.penCodes.includes(c.penCode)) &&
      (!t.herdGroups.length || t.herdGroups.includes(c.herdGroup)) &&
      (!t.lifeStages.length || t.lifeStages.includes(c.lifeStage)),
  )
  const extra = active.filter((c) => t.added.includes(c.code) && !matched.some((m) => m.code === c.code))
  return [...matched, ...extra]
}

export const doseDate = (s: Pick<Schedule, 'firstDueDate' | 'intervalDays'>, doseNo: number) => addDays(s.firstDueDate, (doseNo - 1) * (s.intervalDays ?? 0))

export const doseTextOf = (kind: 'DOSE' | 'BOOSTER', doseNo: number, doseCount: number) => (kind === 'BOOSTER' ? 'nhắc lại' : `mũi ${doseNo}/${doseCount}`)

/** Bảng "Các mũi theo lịch": tính từ mũi đã lưu, hoặc dự kiến khi lịch chưa lưu. */
export function plannedDoseRows(s: Pick<Schedule, 'firstDueDate' | 'intervalDays' | 'doseCount' | 'boosterIntervalMonths'>, doses: ScheduledDose[], count: number, today: string): PlannedDoseRow[] {
  const rows: PlannedDoseRow[] = []
  const n = Number.isInteger(s.doseCount) ? Math.min(Math.max(s.doseCount, 0), 10) : 0
  for (let i = 1; i <= n; i++) {
    const list = doses.filter((d) => d.kind === 'DOSE' && d.doseNo === i && d.status !== 'CANCELLED')
    const total = list.length || count
    const done = list.filter((d) => d.status === 'DONE').length
    const overdue = list.filter((d) => dueStateOf(d, today) === 'OVERDUE').length
    const deferred = list.filter((d) => d.status === 'DEFERRED').length
    const parts = [done && `${done} tiêm`, overdue && `${overdue} quá hạn`, deferred && `${deferred} hoãn`].filter(Boolean)
    const allDone = list.length > 0 && done === list.length
    rows.push({
      label: `Mũi ${i}`,
      date: doseDate(s, i),
      count: total,
      badge: !list.length ? 'Dự kiến' : allDone ? `Đã tiêm ${done}/${total}` : parts.length ? parts.join(' · ') : 'Dự kiến',
      tone: !list.length ? 'outline' : allDone ? 'ok' : overdue || deferred ? 'warn' : 'outline',
    })
  }
  if (s.boosterIntervalMonths && n > 0) {
    rows.push({ label: 'Nhắc lại', date: addMonths(doseDate(s, n), s.boosterIntervalMonths), count, badge: 'Dự kiến', tone: 'outline' })
  }
  return rows
}
