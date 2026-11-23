import { BackendError } from '../../../shared/api/backendClient'
import { textValue } from '../../../shared/api/parse'
import { MSG } from '../domain/healthRules'
import { HealthValidationError } from '../validation/healthValidation'
import { toFarmTime } from './healthMapper'

export const FIELD_ALIASES: Record<string, string> = {
  administeredAt: 'treatmentTime', latestProgress: 'description', closedAt: 'observedAt', suspectedDiagnosis: 'diagnosis', performerName: 'performer', performerId: 'performer',
  observerId: 'observer', confirmedById: 'confirmedBy', cattleId: 'form', action: 'form',
}
export const FIELD_LABELS: Record<string, string> = {
  signs: 'Dấu hiệu / mô tả', description: 'Mô tả', progress: 'Diễn biến', diagnosis: 'Chẩn đoán nghi ngờ', severity: 'Mức độ',
  temperatureC: 'Thân nhiệt', observedAt: 'Thời điểm', observer: 'Người quan sát', medicineId: 'Thuốc', dose: 'Liều', route: 'Đường dùng', treatmentTime: 'Thời điểm bắt đầu',
  courseDays: 'Liệu trình (ngày)', withdrawalDays: 'Số ngày ngưng', performer: 'Người thực hiện', veterinaryAdvice: 'Lời khuyên thú y', outcome: 'Kết quả',
  confirmedBy: 'Người xác nhận', reason: 'Lý do', vaccinationId: 'Mũi tiêm liên kết',
}

/** Backend errors are translated to field-level Vietnamese errors for FE-10 dialogs. */
export function mapHealthError(error: unknown, timeField = 'observedAt'): unknown {
  if (!(error instanceof BackendError)) return error
  const code = textValue(error.code).replace(/^MSG-/, '')
  const p = error.params
  if (code === 'FE10-13') return new Error(MSG.voidOpening)
  if (code === 'COM-17') return new Error(MSG.pendingExit)
  if (code === 'COM-13') return new Error(MSG.exited(textValue(p.cattle_code), textValue(p.date), textValue(p.exit_type, 'Xuất')))
  if (code === 'COM-05' || error.status === 409 || error.status === 412) return new Error(MSG.changed)
  if (code === 'COM-07') return new HealthValidationError({ [timeField]: MSG.future })
  if (code === 'COM-15') return new HealthValidationError({ [timeField]: typeof p.date === 'string' && p.date ? MSG.beforeEntry(textValue(p.date)) : 'Thời điểm không được trước ngày nhập đàn.' })
  if (code === 'FE10-07') return new HealthValidationError({ [timeField]: MSG.beforeCase(toFarmTime(p.date), 'lần ghi gần nhất của ca này') })
  if (code === 'FE10-06') return new HealthValidationError({ temperatureC: MSG.temperature })
  if (code === 'FE18-08') return new HealthValidationError({ medicineId: 'Thuốc đã ngưng sử dụng, không thể chọn cho bản ghi mới.' })
  const fields: Record<string, string> = {}
  const add = (field: string, message: string | undefined) => {
    const key = FIELD_ALIASES[field] ?? field
    const label = FIELD_LABELS[key]
    fields[key] = code === 'COM-06' && label ? MSG.required(label) : code === 'COM-10' && label ? `${label} không hợp lệ.` : message || error.message
  }
  if (typeof p.field === 'string' && p.field.trim()) add(p.field, undefined)
  for (const fe of error.fieldErrors) add(fe.field, fe.message)
  for (const v of error.violations) if (v.field || v.propertyPath) add(v.field ?? v.propertyPath ?? 'form', v.message)
  return Object.keys(fields).length ? new HealthValidationError(fields) : error
}
