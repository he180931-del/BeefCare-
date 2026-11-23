// Input validation moved out of src/features/health/domain/healthRules.ts (refactor phase 2): field rules only, the
// business policy stays in the domain file.
import { dateOf } from '../domain/healthFormat'
import { MSG } from '../domain/healthRules'
import type { CorrectEntryCommand } from '../types'

/** D57: ngoài 30–45 °C là gõ nhầm (chặn); ngoài 35–43 °C chỉ cần người dùng xác nhận lại số đo. */
export const TEMP_MIN = 30
export const TEMP_MAX = 45
export const TEMP_CHECK_MIN = 35
export const TEMP_CHECK_MAX = 43

/** Lỗi kiểm tra theo từng trường: dialog hiện thông báo dưới ô tương ứng. */
export class HealthValidationError extends Error {
  readonly errors: Record<string, string>
  constructor(errors: Record<string, string>) {
    super(Object.values(errors)[0] ?? 'Dữ liệu không hợp lệ.')
    this.name = 'HealthValidationError'
    this.errors = errors
  }
}

/** '39,6' -> 39.6; rỗng -> null; không phải số -> NaN. */
export function parseTemperature(text: string): number | null {
  const t = text.trim().replace(',', '.')
  if (t === '') return null
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : Number.NaN
}

export function temperatureError(value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const ok = Number.isFinite(value) && value >= TEMP_MIN && value <= TEMP_MAX && Math.round(value * 10) / 10 === value
  return ok ? null : MSG.temperature
}

/** Số đo hợp lệ nhưng nằm ngoài 35–43 °C: hỏi xác nhận trước khi lưu (D57). */
export function temperatureNeedsCheck(value: number | null | undefined): boolean {
  return value !== null && value !== undefined && temperatureError(value) === null && (value < TEMP_CHECK_MIN || value > TEMP_CHECK_MAX)
}

export function textError(label: string, value: string | undefined, { required = false, max }: { required?: boolean; max: number }): string | null {
  const v = (value ?? '').trim()
  if (required && !v) return MSG.required(label)
  if (v.length > max) return `${label} tối đa ${max.toLocaleString('vi-VN')} ký tự.`
  return null
}

export function intError(label: string, value: number | null | undefined, min: number, max: number): string | null {
  if (value === null || value === undefined) return MSG.required(label)
  return Number.isInteger(value) && value >= min && value <= max ? null : `${label} phải là số nguyên từ ${min} đến ${max}.`
}

/** Thời điểm sự kiện: bắt buộc, không ở tương lai, không trước ngày nhập đàn, không trước mốc `min` của ca. */
export function timeError(
  label: string,
  value: string | undefined,
  { now, entryDate, min, minWhat }: { now: string; entryDate?: string; min?: string; minWhat?: string },
): string | null {
  if (!value) return MSG.required(label)
  if (value > now) return MSG.future
  if (entryDate && dateOf(value) < entryDate) return MSG.beforeEntry(entryDate)
  if (min && value < min) return MSG.beforeCase(min, minWhat ?? 'lần ghi gần nhất của ca này')
  return null
}

type FieldErrors = Record<string, string>
const put = (errors: FieldErrors, key: string, message: string | null) => { if (message) errors[key] = message }
const TREATMENT_ROUTES = ['INTRAMUSCULAR', 'SUBCUTANEOUS', 'INTRAVENOUS', 'ORAL', 'TOPICAL', 'OTHER']

/**
 * Quy tắc trường của các popup FE-10 (spec mục 6), dùng chung cho chế độ local và chế độ backend để lỗi
 * hiện dưới ô ngay khi bấm Lưu, trước khi gửi. Quy tắc cần dữ liệu trại (thuốc ngừng dùng…) do nơi gọi bổ sung.
 */
export function observationErrors(label: string, v: { time?: string; temperatureC?: number | null }, ctx: { now: string; entryDate?: string; min?: string; minWhat?: string }): FieldErrors {
  const errors: FieldErrors = {}
  put(errors, 'observedAt', timeError(label, v.time, ctx))
  put(errors, 'temperatureC', temperatureError(v.temperatureC))
  return errors
}

export function openCaseErrors(cmd: { observedAt: string; temperatureC: number | null; signs: string; diagnosis: string; severity: string }, ctx: { now: string; entryDate?: string; min?: string }): FieldErrors {
  const errors = observationErrors('Thời điểm quan sát', { time: cmd.observedAt, temperatureC: cmd.temperatureC }, { ...ctx, minWhat: 'lúc mở ca' })
  put(errors, 'signs', textError('Dấu hiệu / mô tả', cmd.signs, { required: true, max: 1000 }))
  put(errors, 'diagnosis', textError('Chẩn đoán nghi ngờ', cmd.diagnosis, { max: 100 }))
  if (!cmd.severity) errors.severity = MSG.required('Mức độ')
  return errors
}

export function treatmentErrors(
  v: { medicineId: number | null; treatmentTime: string; dose: string; route: string; courseDays: number | null; withdrawalDays: number | null; performer: string; veterinaryAdvice?: string },
  ctx: { now: string; entryDate?: string; openedAt?: string },
): FieldErrors {
  const errors: FieldErrors = {}
  if (!v.medicineId) errors.medicineId = MSG.required('Thuốc')
  put(errors, 'dose', textError('Liều', v.dose, { required: true, max: 50 }))
  if (!v.route) errors.route = MSG.required('Đường dùng')
  else if (!TREATMENT_ROUTES.includes(v.route)) errors.route = 'Đường dùng không hợp lệ.'
  put(errors, 'treatmentTime', timeError('Thời điểm bắt đầu', v.treatmentTime, { now: ctx.now, entryDate: ctx.entryDate, min: ctx.openedAt, minWhat: 'lúc mở ca' }))
  // Spec FE-10 mục 6: liệu trình (mặc định 1) và ngày ngưng (điền sẵn từ thuốc) không bắt buộc; có nhập thì phải đúng khoảng.
  if (v.courseDays !== null && v.courseDays !== undefined) put(errors, 'courseDays', intError('Liệu trình (ngày)', v.courseDays, 1, 30))
  if (v.withdrawalDays !== null && v.withdrawalDays !== undefined) put(errors, 'withdrawalDays', intError('Số ngày ngưng', v.withdrawalDays, 0, 365))
  put(errors, 'performer', textError('Người thực hiện', v.performer, { max: 100 }))
  put(errors, 'veterinaryAdvice', textError('Lời khuyên thú y', v.veterinaryAdvice, { max: 500 }))
  return errors
}

type CaseUpdateInput = { action: string; observedAt: string; temperatureC: number | null; progress: string; description: string; diagnosis: string; outcome?: string }

/** Lần cập nhật có ghi theo dõi không (D54): Giữ trạng thái, hoặc có nhập mô tả, diễn biến hay thân nhiệt. */
export function hasFollowUp(cmd: Pick<CaseUpdateInput, 'action' | 'description' | 'progress' | 'temperatureC'>): boolean {
  return cmd.action === 'KEEP' || cmd.description.trim() !== '' || cmd.progress !== '' || cmd.temperatureC !== null
}

/**
 * Popup "Cập nhật ca bệnh" (D54). Thời điểm dùng chung cho lần theo dõi, ngày mạn tính và lúc đóng ca nên luôn được
 * kiểm (không tương lai, không trước bản ghi mới nhất của ca). Có phần theo dõi thì cần cả diễn biến và mô tả (D35).
 */
export function statusErrors(cmd: CaseUpdateInput, ctx: { now: string; entryDate?: string; latestAt?: string }): FieldErrors {
  const errors = observationErrors('Thời điểm', { time: cmd.observedAt, temperatureC: cmd.temperatureC }, { now: ctx.now, entryDate: ctx.entryDate, min: ctx.latestAt, minWhat: 'lần ghi gần nhất của ca này' })
  if (hasFollowUp(cmd)) {
    if (!cmd.progress) errors.progress = MSG.required('Diễn biến')
    put(errors, 'description', textError('Mô tả', cmd.description, { required: true, max: 1000 }))
  }
  put(errors, 'diagnosis', textError('Chẩn đoán nghi ngờ', cmd.diagnosis, { max: 100 }))
  if (cmd.action === 'CLOSE' && !cmd.outcome) errors.outcome = MSG.required('Kết quả')
  return errors
}

export function reasonErrors(reason: string | undefined): FieldErrors {
  const errors: FieldErrors = {}
  put(errors, 'reason', textError('Lý do', reason, { required: true, max: 500 }))
  return errors
}

/** Shared field validator for partial correction commands. */
export function textFieldErrors(key: string, label: string, value: string, max: number): Record<string, string> {
  const message = textError(label, value, { required: true, max })
  return message ? { [key]: message } : {}
}

/** Sửa điều trị: chỉ kiểm các trường có trong lệnh (cùng thông báo như popup ghi điều trị). */
export function correctionTreatmentErrors(cmd: CorrectEntryCommand, ctx: { now: string; entryDate?: string; openedAt?: string }): Record<string, string> {
  return treatmentErrors({
    medicineId: cmd.medicineId === undefined ? 1 : cmd.medicineId, treatmentTime: cmd.treatmentTime ?? ctx.now, dose: cmd.dose ?? '-', route: cmd.route === undefined ? 'OTHER' : cmd.route,
    courseDays: cmd.courseDays === undefined ? 1 : cmd.courseDays, withdrawalDays: cmd.withdrawalDays === undefined ? 0 : cmd.withdrawalDays, performer: cmd.performer ?? '',
  }, cmd.treatmentTime === undefined ? { now: ctx.now } : ctx)
}
