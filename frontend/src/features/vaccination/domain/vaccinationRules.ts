import type { DueState, PlannedDoseRow, Schedule, ScheduledDose, ScheduleCommand, ScheduleTarget, VaccCattle, VaccineItem, VaccinationSource } from '../types'
import { addDays, addMonths, dayNumber, fmtDate } from './vaccinationFormat'

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

interface RecordFields {
  vaccineId?: number
  source: VaccinationSource
  administeredAt?: string
  batchNo?: string
  withdrawalDays?: number
  vaccinator?: string
}

/** UC-FE09-05 bước 6 và GBR-42: kiểm tra phần dùng chung cho cả lô. */
export function validateRecordFields(input: RecordFields, ctx: { now: string; vaccine?: VaccineItem; herdEntryDate?: string }): FieldErrors {
  const e: FieldErrors = {}
  if (!input.vaccineId) e.vaccineId = 'Vắc-xin là bắt buộc.'
  else if (ctx.vaccine && !ctx.vaccine.active) e.vaccineId = `${ctx.vaccine.name} đã ngừng sử dụng, không thể chọn cho bản ghi mới.`
  if (input.source === 'ON_FARM' && !input.batchNo?.trim()) e.batchNo = 'Số lô là bắt buộc khi tiêm tại trại.'
  else if (input.batchNo && input.batchNo.length > BATCH_MAX) e.batchNo = 'Số lô tối đa 50 ký tự.'
  if (!input.administeredAt) e.administeredAt = 'Thời điểm tiêm là bắt buộc.'
  else if (input.administeredAt > ctx.now) e.administeredAt = 'Thời điểm không được ở tương lai.'
  else if (input.source === 'ON_FARM' && ctx.herdEntryDate && input.administeredAt.slice(0, 10) < ctx.herdEntryDate) e.administeredAt = `Thời điểm không được trước ngày nhập đàn (${fmtDate(ctx.herdEntryDate)}).`
  const days = input.withdrawalDays
  if (days !== undefined && (!Number.isInteger(days) || days < 0 || days > 365)) e.withdrawalDays = 'Số ngày ngưng phải là số nguyên từ 0 đến 365.'
  if (input.vaccinator && input.vaccinator.length > VACCINATOR_MAX) e.vaccinator = 'Người tiêm tối đa 100 ký tự.'
  return e
}

export function validateReason(reason: string | undefined, label = 'Lý do'): FieldErrors {
  if (!reason?.trim()) return { reason: `${label} là bắt buộc.` }
  if (reason.length > REASON_MAX) return { reason: `${label} tối đa 500 ký tự.` }
  return {}
}

/** UC-FE09-06: lý do bắt buộc, ngày mới không trước hôm nay (MSG-FE09-11). */
export function validateDefer(input: { reason?: string; newExpectedDate?: string; note?: string }, today: string): FieldErrors {
  const e = validateReason(input.reason, 'Lý do chưa tiêm')
  if (input.newExpectedDate && input.newExpectedDate < today) e.newExpectedDate = 'Ngày mới phải từ hôm nay trở đi.'
  if (input.note && input.note.length > NOTE_MAX) e.note = 'Ghi chú tối đa 255 ký tự.'
  return e
}

/** SCR-32: kiểm tra thông tin lịch. */
export function validateSchedule(input: ScheduleCommand, ctx: { activeNames: string[]; vaccine?: VaccineItem }): FieldErrors {
  const e: FieldErrors = {}
  const name = input.name.trim()
  if (!name) e.name = 'Tên lịch là bắt buộc.'
  else if (name.length > 100) e.name = 'Tên lịch tối đa 100 ký tự.'
  else if (ctx.activeNames.some((n) => n.toLowerCase() === name.toLowerCase())) e.name = `Đã có lịch đang chạy tên ${name}.`
  if (!input.vaccineId) e.vaccineId = 'Vắc-xin là bắt buộc.'
  else if (ctx.vaccine && !ctx.vaccine.active) e.vaccineId = `${ctx.vaccine.name} đã ngừng sử dụng, không thể chọn cho bản ghi mới.`
  if (!input.firstDueDate) e.firstDueDate = 'Ngày bắt đầu là bắt buộc.'
  const n = input.doseCount
  if (n === undefined || !Number.isInteger(n) || n < 1 || n > 10) e.doseCount = 'Số mũi phải là số nguyên từ 1 đến 10.'
  const gap = input.intervalDays
  if (n !== undefined && n > 1 && gap === undefined) e.intervalDays = 'Cách giữa mũi là bắt buộc khi có từ 2 mũi.'
  else if (gap !== undefined && (!Number.isInteger(gap) || gap < 1 || gap > 365)) e.intervalDays = 'Cách giữa mũi phải từ 1 đến 365 ngày.'
  const b = input.boosterIntervalMonths
  if (b !== undefined && (!Number.isInteger(b) || b < 1 || b > 60)) e.boosterIntervalMonths = 'Nhắc lại sau phải từ 1 đến 60 tháng.'
  return e
}

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
