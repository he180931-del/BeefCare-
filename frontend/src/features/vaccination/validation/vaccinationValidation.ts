// Input validation moved out of src/features/vaccination/domain/vaccinationRules.ts (refactor phase 2): field rules only, the
// business policy stays in the domain file.
import type { ScheduleCommand, VaccineItem, VaccinationSource } from '../types'
import { fmtDate } from '../domain/vaccinationFormat'
import { type FieldErrors, NOTE_MAX, REASON_MAX, VACCINATOR_MAX } from '../domain/vaccinationRules'

interface RecordFields {
  vaccineId?: number
  source: VaccinationSource
  administeredAt?: string
  withdrawalDays?: number
  vaccinator?: string
}

/** UC-FE09-05 bước 6 và GBR-42: kiểm tra phần dùng chung cho cả lô. */
export function validateRecordFields(input: RecordFields, ctx: { now: string; vaccine?: VaccineItem; herdEntryDate?: string }): FieldErrors {
  const e: FieldErrors = {}
  if (!input.vaccineId) e.vaccineId = 'Vắc-xin là bắt buộc.'
  else if (ctx.vaccine && !ctx.vaccine.active) e.vaccineId = `${ctx.vaccine.name} đã ngừng sử dụng, không thể chọn cho bản ghi mới.`
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
