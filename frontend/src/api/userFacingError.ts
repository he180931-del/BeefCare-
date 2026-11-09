import { BackendError } from './backendClient'

type ErrorShape = {
  status?: unknown
  message?: unknown
  detail?: unknown
  title?: unknown
  code?: unknown
  errorKey?: unknown
  params?: Record<string, unknown>
  fieldErrors?: Array<{ field?: string; message?: string }>
  violations?: Array<{ field?: string; propertyPath?: string; message?: string }>
}
const shape = (value: unknown): ErrorShape => typeof value === 'object' && value !== null ? value as ErrorShape : {}
const rawMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  const message = shape(error).message
  return typeof message === 'string' ? message : ''
}

const fieldLabels: Record<string, string> = {
  breed: 'Giống', breedId: 'Giống', breedName: 'Giống', sex: 'Giới tính',
  productionPurpose: 'Mục đích nuôi', purposeId: 'Mục đích nuôi', lifeStage: 'Giai đoạn sinh trưởng',
  receivingPen: 'Chuồng nhận', penId: 'Chuồng nhận', entryWeightKg: 'Cân nhập (kg)',
  weightBasis: 'Cơ sở cân', unitPrice: 'Đơn giá', earTagNumber: 'Số thẻ tai',
  entryDate: 'Ngày nhập', birthDate: 'Ngày sinh', quarantineCertNo: 'Số giấy kiểm dịch',
  paymentMethod: 'Phương thức thanh toán', amountPaid: 'Số tiền thanh toán',
  receiver: 'Người nhập', sellerId: 'Nguồn / chủ bò cũ', lines: 'Danh sách bò',
  penCode: 'Mã chuồng', code: 'Mã chuồng', name: 'Tên chuồng', capacity: 'Sức chứa',
  minAge: 'Tuổi tối thiểu', minAgeMonths: 'Tuổi tối thiểu', minWeight: 'Cân tối thiểu', minWeightKg: 'Cân tối thiểu',
  description: 'Mô tả', criteria: 'Tiêu chí tiếp nhận', expectedVersion: 'Phiên bản dữ liệu',
  'vaccination.items': 'Thông tin tiêm phòng', 'disease.description': 'Mô tả bệnh đã biết',
  reproduction: 'Thông tin sinh sản', 'reproduction.earlierCalvings': 'Số lứa đã đẻ',
  'reproduction.estMonthsPregnant': 'Số tháng mang thai', damId: 'Bò mẹ', sireId: 'Bò bố',
}

const label = (value: unknown): string => {
  const key = String(value ?? '')
  return fieldLabels[key] ?? (key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[._]/g, ' ').trim() || 'trường này')
}

const specificBackendMessage = (error: unknown): string | null => {
  const body = error instanceof BackendError ? error : shape(error)
  const code = String(body.code ?? '')
  const params = body.params ?? {}
  if (code === 'MSG-COM-06') return `Vui lòng nhập ${label(params.field)}.`
  if (code === 'MSG-COM-10') return `${label(params.field)} không hợp lệ.`
  if (code === 'MSG-COM-08') return `${label(params.field)} đã chọn không còn khả dụng. Vui lòng chọn lại.`
  if (code === 'MSG-FE18-08') return `${label(params.field)} không nằm trong danh mục đang hoạt động.`
  if (code === 'MSG-FE04-05') return `Chuồng ${params.pen_code ?? ''} không đủ chỗ nhận ${params.count ?? ''} con (còn ${params.free ?? 0} chỗ).`
  if (code === 'MSG-FE04-02') return `Mã chuồng ${params.pen_code ?? ''} đã tồn tại trong trại này.`
  if (code === 'MSG-FE04-03') return `Sức chứa phải là số nguyên tối thiểu ${params.min_capacity ?? 1}.`
  if (code === 'MSG-COM-05') return 'Dữ liệu đã thay đổi. Vui lòng tải lại trang rồi thử lại.'
  if (code === 'MSG-FE04-06') return `Chuồng ${params.pen_code ?? ''} chưa phù hợp với tiêu chí: ${params.criteria ?? 'vui lòng kiểm tra lại thông tin'}.`
  if (code === 'MSG-FE05-12') return 'Mục đích nuôi và giới tính không phù hợp. Vỗ béo/SIRE cần bò đực; BREEDING cần bò cái.'
  if (code === 'MSG-FE06-03') return 'Ngày nhập không được ở tương lai hoặc trước ngày sinh.'
  if (code === 'MSG-FE06-13') return `Số tiền thanh toán không được vượt quá ${params.amount ?? 0} đ.`
  if (code === 'MSG-FE21-08') return 'Giao dịch ngân hàng này đã được ghi nhận ở một khoản khác. Hãy chọn chứng từ khác.'
  if (code === 'MSG-FE21-09') return 'Số tiền phải là số nguyên VND lớn hơn 0.'
  if (code === 'MSG-FE21-10') return `Danh mục ${params.category ?? ''} không dùng được cho ${params.type === 'INCOME' ? 'Thu' : 'Chi'}.`
  if (code === 'MSG-FE21-12') return 'Kết quả báo cáo đã hết hạn. Hãy chạy lại báo cáo.'
  const fields = [
    ...(body.fieldErrors ?? []),
    ...(body.violations ?? []).map((item) => ({ field: item.field ?? item.propertyPath, message: item.message })),
  ]
  if (fields.length) return fields.map((item) => `${label(item.field)}: ${item.message ?? 'không hợp lệ'}`).join('; ')
  const message = rawMessage(error).trim()
  if (message && !/^(error\.validation|error\.http\.\d+|http\s*\d+)$/i.test(message)) return message
  return null
}

/** Converts transport/domain failures to short, actionable Vietnamese UI copy. */
export function userFacingError(error: unknown, fallback = 'Không thể hoàn tất thao tác. Vui lòng thử lại.'): string {
  const status = error instanceof BackendError ? error.status : Number(shape(error).status)
  const message = rawMessage(error).trim()
  const normalized = message.toLowerCase()
  if (status === 401 || status === 403 || /unauthori[sz]ed|forbidden|access denied/.test(normalized)) return 'Phiên làm việc không còn hợp lệ hoặc bạn không có quyền thực hiện. Vui lòng đăng nhập lại hoặc liên hệ Chủ trại.'
  if (status === 404 || /not found|không tìm thấy|error\.http\.404/.test(normalized)) return 'Không tìm thấy dữ liệu cần thao tác. Vui lòng tải lại trang và thử lại.'
  if (status === 408 || status === 504 || /timeout|timed out|gateway timeout|error\.http\.408|error\.http\.504/.test(normalized)) return 'Máy chủ phản hồi quá lâu. Vui lòng kiểm tra kết nối rồi thử lại.'
  if ((status >= 500 && status <= 599) || /error\.http\.5\d\d|server error|internal server/.test(normalized)) return 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau ít phút.'
  if (/failed to fetch|networkerror|network error|network request|\bload failed|connection refused|err_connection|cors|error\.network/.test(normalized)) return 'Không thể kết nối máy chủ. Vui lòng kiểm tra máy chủ và kết nối mạng rồi thử lại.'
  if (status === 400 || status === 409 || status === 422 || error instanceof BackendError && (error.fieldErrors.length > 0 || error.violations.length > 0) || /error\.validation|validation failed/.test(normalized)) {
    return specificBackendMessage(error) ?? 'Không thể lưu dữ liệu. Vui lòng kiểm tra lại thông tin.'
  }
  if (/error\.http\.\d+|^http\s*\d+$/i.test(normalized)) return fallback
  if (message && !/^unknown error$/i.test(message)) return message
  return fallback
}

export const displayError = userFacingError
