import { BackendError } from '../../../api/backendClient'
import { userFacingError } from '../../../api/userFacingError'

export const AUTH_PATH = {
  home: '/', signIn: '/sign-in', register: '/dang-ky', verification: '/xac-minh-email',
  forgot: '/quen-mat-khau', resetSent: '/kiem-tra-email', reset: '/resetpassword',
  invalid: '/lien-ket-khong-con-hieu-luc', suspended: '/tai-khoan-tam-ngung', loginFailed: '/dang-nhap-that-bai',
} as const

export const AUTH_PATHS = new Set<string>(Object.values(AUTH_PATH).filter((path) => path !== AUTH_PATH.home))

export const emailFromState = (state: unknown): string => {
  if (typeof state !== 'object' || state === null || !('email' in state)) return ''
  return typeof (state as { email?: unknown }).email === 'string' ? (state as { email: string }).email.trim().toLowerCase() : ''
}

export const readError = (error: unknown) => ({
  code: error instanceof BackendError ? error.code : typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: unknown }).code ?? '') : '',
  status: error instanceof BackendError ? error.status : typeof error === 'object' && error !== null && 'status' in error ? Number((error as { status?: unknown }).status) : 0,
  params: error instanceof BackendError ? error.params : typeof error === 'object' && error !== null && 'params' in error ? (error as { params?: Record<string, unknown> }).params ?? {} : {},
})

/** MSG-FE01-01: sai email hoặc mật khẩu (không tiết lộ giá trị nào sai). */
export function isCredentialError(error: unknown): boolean {
  const { code, status } = readError(error)
  if (code === 'MSG-FE01-11') return false
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  return code === 'MSG-FE01-01' || status === 401 || (code ?? '').toLowerCase() === 'error.validation' || message.includes('error.validation')
}

export const CREDENTIAL_MESSAGE = 'Email hoặc mật khẩu chưa chính xác.'

export function friendlyLoginError(error: unknown): string {
  const { code, status, params } = readError(error)
  if (code === 'MSG-FE01-11') return 'Email chưa được xác minh. Vui lòng mở email xác minh hoặc gửi lại liên kết.'
  if (isCredentialError(error)) return CREDENTIAL_MESSAGE
  if (code === 'MSG-FE01-02' || status === 423) {
    const time = typeof params.time === 'string' ? new Date(params.time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : null
    return `Đăng nhập bằng mật khẩu đang bị khóa sau 5 lần sai. Thử lại sau 15 phút${time ? ` (sau ${time})` : ''} hoặc tiếp tục với Google.`
  }
  if (code === 'MSG-FE01-03') return 'Tài khoản đang tạm ngưng.'
  return userFacingError(error, 'Đăng nhập không thành công. Vui lòng thử lại.')
}

export function friendlyAccountError(error: unknown): string {
  const { code, status } = readError(error)
  if (code === 'MSG-FE01-10') return 'Email này đã có tài khoản BeefCare. Hãy đăng nhập hoặc dùng chức năng quên mật khẩu.'
  if (code === 'MSG-FE01-14') return 'Bạn cần đồng ý với Điều khoản sử dụng và Chính sách dữ liệu.'
  if (code === 'MSG-FE01-08') return 'Mật khẩu cần từ 8 đến 128 ký tự và không được trùng với email.'
  if (code === 'MSG-FE01-09') return 'Mật khẩu xác nhận chưa khớp.'
  if (status === 409) return 'Thông tin tài khoản đã được sử dụng. Vui lòng kiểm tra email.'
  if (status === 400 || status === 422) return 'Thông tin chưa hợp lệ. Vui lòng kiểm tra lại các trường đã nhập.'
  return userFacingError(error, 'Không thể hoàn tất yêu cầu. Vui lòng thử lại.')
}

export function friendlyEmailRequestError(error: unknown): string {
  const { status } = readError(error)
  if (status === 429) return 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.'
  if (status === 400 || status === 422) return 'Yêu cầu chưa hợp lệ. Vui lòng kiểm tra email rồi thử lại.'
  return userFacingError(error, 'Chưa gửi được email. Vui lòng thử lại sau.')
}
