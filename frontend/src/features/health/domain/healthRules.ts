import { addDays, dateOf, daysBetween, fmtDate, fmtDateTime } from './healthFormat'
import type { HealthState } from '../types'

export const TEMP_MIN = 35
export const TEMP_MAX = 43

/** Lỗi kiểm tra theo từng trường: dialog hiện thông báo dưới ô tương ứng. */
export class HealthValidationError extends Error {
  readonly errors: Record<string, string>
  constructor(errors: Record<string, string>) {
    super(Object.values(errors)[0] ?? 'Dữ liệu không hợp lệ.')
    this.name = 'HealthValidationError'
    this.errors = errors
  }
}

export const MSG = {
  required: (field: string) => `${field} là bắt buộc.`,
  future: 'Thời điểm không được ở tương lai.',
  beforeEntry: (date: string) => `Thời điểm không được trước ngày nhập đàn (${fmtDate(date)}).`,
  beforeCase: (at: string, what: string) => `Thời điểm không được trước ${fmtDateTime(at)}, ${what}.`,
  temperature: 'Thân nhiệt phải trong khoảng 35,0 – 43,0 °C.',
  changed: 'Bản ghi đã được thay đổi hoặc không còn ở trạng thái cho phép thao tác. Vui lòng tải lại và kiểm tra trước khi thử lại.',
  exited: (code: string, date: string, type: string) => `${code} đã rời đàn ngày ${fmtDate(date)} (${type}). Hồ sơ chỉ được xem.`,
  pendingExit: 'Bò đang chờ xác nhận chết / mất nên chưa nhận thêm sự kiện chăm sóc mới.',
  inactiveMedicine: (name: string) => `${name} đã ngưng sử dụng, không thể chọn cho bản ghi mới.`,
  voidOpening: 'Lần ghi mở ca không thể hủy. Hãy sửa lại, hoặc đóng ca kèm lý do.',
  chronicNotice: 'Ca đang theo dõi mạn tính. Lưu điều trị sẽ chuyển ca về OPEN.',
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

export function followUpErrors(cmd: { observedAt: string; temperatureC: number | null; progress: string; description: string }, ctx: { now: string; entryDate?: string; min?: string }): FieldErrors {
  const errors = observationErrors('Thời điểm', { time: cmd.observedAt, temperatureC: cmd.temperatureC }, { ...ctx, minWhat: 'lúc mở ca' })
  if (!cmd.progress) errors.progress = MSG.required('Diễn biến')
  put(errors, 'description', textError('Mô tả', cmd.description, { required: true, max: 1000 }))
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

export function statusErrors(
  cmd: { action: string; progressText: string; progress?: string; diagnosis: string; outcome?: string; closedAt?: string },
  ctx: { now: string; entryDate?: string; latestAt?: string },
): FieldErrors {
  const errors: FieldErrors = {}
  put(errors, 'progressText', textError('Diễn biến mới', cmd.progressText, { required: cmd.action === 'KEEP', max: 1000 }))
  // D35: lần theo dõi tạo từ popup này cần diễn biến người dùng chọn.
  if ((cmd.action === 'KEEP' || cmd.progressText.trim()) && !cmd.progress) errors.progress = MSG.required('Diễn biến')
  put(errors, 'diagnosis', textError('Chẩn đoán nghi ngờ', cmd.diagnosis, { max: 100 }))
  if (cmd.action === 'CLOSE') {
    if (!cmd.outcome) errors.outcome = MSG.required('Kết quả')
    put(errors, 'closedAt', timeError('Thời điểm đóng', cmd.closedAt, { now: ctx.now, entryDate: ctx.entryDate, min: ctx.latestAt, minWhat: 'lần ghi gần nhất của ca này' }))
  }
  return errors
}

export function reasonErrors(reason: string | undefined): FieldErrors {
  const errors: FieldErrors = {}
  put(errors, 'reason', textError('Lý do', reason, { required: true, max: 500 }))
  return errors
}

/** Ngày của lần dùng cuối = ngày dùng đầu + (số ngày liệu trình − 1). */
export const lastDoseDate = (administeredAt: string, courseDays: number) => addDays(dateOf(administeredAt), Math.max(courseDays, 1) - 1)

/** GBR-46: hết ngưng = ngày dùng cuối + số ngày ngưng. */
export const withdrawalEnd = (administeredAt: string, courseDays: number, withdrawalDays: number) => addDays(lastDoseDate(administeredAt, courseDays), withdrawalDays)

interface TreatmentLike { status: string; type: string; occurredAt: string; courseDays?: number; withdrawalDays?: number }

/** Ngày hết ngưng muộn nhất trong các điều trị hợp lệ; null khi không có. */
export function latestWithdrawalEnd(entries: TreatmentLike[]): string | null {
  let latest: string | null = null
  for (const e of entries) {
    if (e.type !== 'TREATMENT' || e.status !== 'VALID') continue
    const end = withdrawalEnd(e.occurredAt, e.courseDays ?? 1, e.withdrawalDays ?? 0)
    if (!latest || end > latest) latest = end
  }
  return latest
}

/** GBR-45. */
export function computeHealthState(
  cases: Array<{ id: number; status: string }>,
  entries: Array<{ caseId: number; type: string; status: string }>,
): HealthState {
  const active = cases.filter((c) => c.status === 'OPEN' || c.status === 'CHRONIC')
  const treating = cases.some((c) => c.status === 'OPEN' && entries.some((e) => e.caseId === c.id && e.type === 'TREATMENT' && e.status === 'VALID'))
  if (treating) return 'UNDER_TREATMENT'
  return active.length > 0 ? 'MONITORING' : 'HEALTHY'
}

/** Ngày 1 là ngày mở ca. */
export const caseDay = (openedAt: string, now: string) => daysBetween(openedAt, now) + 1

export const isWithdrawalActive = (end: string | null | undefined, now: string): end is string => !!end && end >= dateOf(now)
