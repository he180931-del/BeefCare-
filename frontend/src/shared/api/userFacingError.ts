import { BackendError } from './backendClient'

type ErrorShape = { status?: unknown; message?: unknown; fieldErrors?: unknown[]; violations?: unknown[] }
const shape = (value: unknown): ErrorShape => typeof value === 'object' && value !== null ? value as ErrorShape : {}
const rawMessage = (error: unknown): string => error instanceof Error ? error.message : typeof error === 'string' ? error : typeof shape(error).message === 'string' ? String(shape(error).message) : ''

/** Transport-generic error copy. Feature/domain codes are owned by feature adapters. */
export function userFacingError(error: unknown, fallback = 'Không thể hoàn tất thao tác. Vui lòng thử lại.'): string {
  const status = error instanceof BackendError ? error.status : Number(shape(error).status)
  const message = rawMessage(error).trim()
  const normalized = message.toLowerCase()
  if (status === 401 || status === 403 || /unauthori[sz]ed|forbidden|access denied/.test(normalized)) return 'Phiên làm việc không còn hợp lệ hoặc bạn không có quyền thực hiện. Vui lòng đăng nhập lại hoặc liên hệ Chủ trại.'
  if (status === 404 || /not found|không tìm thấy|error\.http\.404/.test(normalized)) return 'Không tìm thấy dữ liệu cần thao tác. Vui lòng tải lại trang và thử lại.'
  if (status === 408 || status === 504 || /timeout|timed out|gateway timeout|error\.http\.408|error\.http\.504/.test(normalized)) return 'Máy chủ phản hồi quá lâu. Vui lòng kiểm tra kết nối rồi thử lại.'
  if ((status >= 500 && status <= 599) || /error\.http\.5\d\d|server error|internal server/.test(normalized)) return 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau ít phút.'
  if (/failed to fetch|networkerror|network error|network request|\bload failed|connection refused|err_connection|cors|error\.network/.test(normalized)) return 'Không thể kết nối máy chủ. Vui lòng kiểm tra máy chủ và kết nối mạng rồi thử lại.'
  if (status === 400 || status === 409 || status === 422 || error instanceof BackendError && (error.fieldErrors.length > 0 || error.violations.length > 0) || /error\.validation|validation failed/.test(normalized)) return 'Không thể lưu dữ liệu. Vui lòng kiểm tra lại thông tin.'
  if (/error\.http\.\d+|^http\s*\d+$/i.test(normalized)) return fallback
  if (message && !/^unknown error$/i.test(message)) return message
  return fallback
}

export const displayError = userFacingError
