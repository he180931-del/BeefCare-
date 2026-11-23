import { BackendError } from '../../../shared/api/backendClient'
import { textValue } from '../../../shared/api/parse'
import { fmtDate } from '../domain/vaccinationFormat'
import { CONFLICT_MESSAGE, VaccinationValidationError, hasErrors, type FieldErrors } from '../domain/vaccinationRules'

const FIELD_ALIASES: Record<string, string> = {
  vaccinationDate: 'administeredAt', firstDueDate: 'firstDueDate', targetCattle: 'form', animals: 'form', scheduledDoseId: 'form',
  deferralReason: 'form', decision: 'form', period: 'form', page: 'form',
}
const FIELD_MESSAGES: Record<string, string> = {
  name: 'Tên lịch là bắt buộc, tối đa 100 ký tự.', vaccineId: 'Vắc-xin là bắt buộc.', firstDueDate: 'Ngày tiêm không được trước hôm nay.',
  doseCount: 'Số mũi phải là số nguyên từ 1 đến 10.', intervalDays: 'Cách giữa mũi phải là số nguyên từ 1 đến 365 ngày.', boosterIntervalMonths: 'Nhắc lại sau phải là số nguyên từ 1 đến 60 tháng.',
  administeredAt: 'Thời điểm tiêm không hợp lệ.', withdrawalDays: 'Số ngày ngưng phải là số nguyên từ 0 đến 365.',
  vaccinator: 'Người tiêm là bắt buộc.', dose: 'Liều không hợp lệ.', route: 'Đường tiêm là bắt buộc.', routeOther: 'Nhập đường tiêm khác.', reason: 'Lý do là bắt buộc, tối đa 500 ký tự.',
  newExpectedDate: 'Ngày mới phải từ hôm nay trở đi.', source: 'Nguồn ghi nhận không hợp lệ.', form: 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.',
}

/** Maps backend domain errors to the fields/messages expected by FE-09 forms. */
export function mapVaccinationError(error: unknown): unknown {
  if (!(error instanceof BackendError)) return error
  // D49: bò đã rời đàn / đang chờ xác nhận chết hoặc mất – lỗi điều kiện, hiện popup với mã bò cụ thể.
  const cattleCode = textValue(error.params.cattle_code, textValue(error.params.cattleCode))
  if (textValue(error.code).replace(/^MSG-/, '') === 'COM-17') {
    const loss = textValue(error.params.loss_kind) === 'MISSING' ? 'mất' : 'chết'
    const date = textValue(error.params.date)
    return new VaccinationValidationError({ form: `Bò ${cattleCode || 'này'} đang chờ Chủ trại xác nhận ${loss}${date ? ` (${fmtDate(date)})` : ''} nên không thêm vào lịch hoặc ghi tiêm được. Hãy bỏ con này ra khỏi nhóm rồi lưu lại.` })
  }
  if (textValue(error.code).replace(/^MSG-/, '') === 'COM-13' && cattleCode) {
    return new VaccinationValidationError({ form: `Bò ${cattleCode} đã rời đàn nên không thêm vào lịch hoặc ghi tiêm được.` })
  }
  const reason = textValue(error.params.reason)
  const code = textValue(error.code).replace(/^MSG-/, '')
  if (code === 'COM-05' && reason === 'active_schedule_name_exists') return new VaccinationValidationError({ name: 'Đã có lịch đang chạy cùng tên.' })
  // D46: các khóa khi sửa lịch.
  if (code === 'COM-05' && reason === 'schedule_completed') return new VaccinationValidationError({ form: 'Lịch đã tiêm xong hết nên đã khóa. Tạo lịch mới để tiêm cho bò khác.' })
  if (code === 'COM-05' && reason === 'start_date_locked_after_done') return new VaccinationValidationError({ firstDueDate: 'Lịch đã có mũi được tiêm: không đổi được ngày tiêm.' })
  if (code === 'COM-05' && reason === 'interval_locked_after_done') return new VaccinationValidationError({ intervalDays: 'Lịch đã có mũi được tiêm: không đổi được khoảng cách giữa mũi.' })
  if (code === 'FE18-08' || (code === 'COM-05' && reason === 'vaccine_inactive')) return new VaccinationValidationError({ vaccineId: 'Vắc-xin đã ngừng sử dụng, không thể chọn cho bản ghi mới.' })
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
