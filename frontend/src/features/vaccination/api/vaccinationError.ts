import { BackendError } from '../../../shared/api/backendClient'
import { textValue } from '../../../shared/api/parse'
import { fmtDate } from '../domain/vaccinationFormat'
import { CONFLICT_MESSAGE, VaccinationValidationError, hasErrors, type FieldErrors } from '../domain/vaccinationRules'

const FIELD_ALIASES: Record<string, string> = {
  vaccinationDate: 'administeredAt', firstDueDate: 'firstDueDate', targetCattle: 'form', animals: 'form', scheduledDoseId: 'form',
  deferralReason: 'form', decision: 'form', period: 'form', page: 'form',
}
const FIELD_MESSAGES: Record<string, string> = {
  name: 'Tên lịch là bắt buộc, tối đa 100 ký tự.', vaccineId: 'Vắc-xin là bắt buộc.', firstDueDate: 'Ngày bắt đầu không được trước hôm nay.',
  doseCount: 'Số mũi phải là số nguyên từ 1 đến 10.', intervalDays: 'Cách giữa mũi phải từ 1 đến 365 ngày.', boosterIntervalMonths: 'Nhắc lại sau phải từ 1 đến 60 tháng.',
  batchNo: 'Số lô là bắt buộc khi tiêm tại trại, tối đa 50 ký tự.', administeredAt: 'Thời điểm tiêm không hợp lệ.', withdrawalDays: 'Số ngày ngưng phải là số nguyên từ 0 đến 365.',
  vaccinator: 'Người tiêm là bắt buộc.', dose: 'Liều là bắt buộc.', route: 'Đường tiêm là bắt buộc.', reason: 'Lý do là bắt buộc, tối đa 500 ký tự.',
  newExpectedDate: 'Ngày mới phải từ hôm nay trở đi.', source: 'Nguồn ghi nhận không hợp lệ.', form: 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.',
}

/** Maps backend domain errors to the fields/messages expected by FE-09 forms. */
export function mapVaccinationError(error: unknown): unknown {
  if (!(error instanceof BackendError)) return error
  const reason = textValue(error.params.reason)
  const code = textValue(error.code).replace(/^MSG-/, '')
  if (code === 'COM-05' && reason === 'active_schedule_name_exists') return new VaccinationValidationError({ name: 'Đã có lịch đang chạy cùng tên.' })
  if (code === 'COM-05' && reason === 'vaccine_inactive') return new VaccinationValidationError({ vaccineId: 'Vắc-xin đã ngừng sử dụng, không thể chọn cho bản ghi mới.' })
  if (code === 'COM-05' || error.status === 409 || error.status === 412) return new Error(CONFLICT_MESSAGE)
  if (code === 'COM-07') return new VaccinationValidationError({ administeredAt: 'Thời điểm tiêm không được ở tương lai.' })
  if (code === 'COM-15') {
    const entryDate = textValue(error.params.entryDate, textValue(error.params.date))
    return new VaccinationValidationError({ administeredAt: entryDate ? `Thời điểm không được trước ngày nhập đàn (${fmtDate(entryDate)}).` : 'Thời điểm không được trước ngày nhập đàn.' })
  }
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
