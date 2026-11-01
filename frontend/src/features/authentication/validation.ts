export const EMAIL_MAX_LENGTH = 254
export const PASSWORD_MAX_LENGTH = 128

export function normalizeEmail(value: string): string {
  return value.trim().toLocaleLowerCase('en-US')
}

export function isValidEmail(value: string): boolean {
  const email = value.trim()
  if (!email || email.length > EMAIL_MAX_LENGTH) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export type SignInValues = { email: string; password: string }
export type RegistrationValues = SignInValues & { fullName: string; confirmPassword: string; termsAccepted: boolean }
export type ResetValues = { email: string; password: string; confirmPassword: string }

export function validateSignIn(values: SignInValues): Partial<Record<keyof SignInValues, string>> {
  const errors: Partial<Record<keyof SignInValues, string>> = {}
  if (!values.email.trim()) errors.email = 'Vui lòng nhập email.'
  else if (!isValidEmail(values.email)) errors.email = 'Email không hợp lệ.'
  if (!values.password) errors.password = 'Vui lòng nhập mật khẩu.'
  else if (values.password.length > PASSWORD_MAX_LENGTH) errors.password = 'Mật khẩu không được dài quá 128 ký tự.'
  return errors
}

export function validateRegistration(values: RegistrationValues): Partial<Record<keyof RegistrationValues, string>> {
  const errors: Partial<Record<keyof RegistrationValues, string>> = {}
  const name = values.fullName.trim()
  if (!name) errors.fullName = 'Vui lòng nhập họ và tên.'
  else if (name.length < 2 || name.length > 100) errors.fullName = 'Họ và tên cần từ 2 đến 100 ký tự.'
  if (!values.email.trim()) errors.email = 'Vui lòng nhập email.'
  else if (!isValidEmail(values.email)) errors.email = 'Email không hợp lệ.'
  if (!values.password) errors.password = 'Vui lòng nhập mật khẩu.'
  else if (values.password.length < 8 || values.password.length > PASSWORD_MAX_LENGTH) errors.password = 'Mật khẩu cần từ 8 đến 128 ký tự.'
  else if (normalizeEmail(values.password) === normalizeEmail(values.email)) errors.password = 'Mật khẩu không được trùng với email.'
  if (!values.confirmPassword) errors.confirmPassword = 'Vui lòng xác nhận mật khẩu.'
  else if (values.password !== values.confirmPassword) errors.confirmPassword = 'Mật khẩu xác nhận chưa khớp.'
  if (!values.termsAccepted) errors.termsAccepted = 'Vui lòng đồng ý với Điều khoản sử dụng và Chính sách dữ liệu.'
  return errors
}

export function validateReset(values: ResetValues): Partial<Record<'email' | 'password' | 'confirmPassword', string>> {
  const errors: Partial<Record<'email' | 'password' | 'confirmPassword', string>> = {}
  if (!values.password) errors.password = 'Vui lòng nhập mật khẩu mới.'
  else if (values.password.length < 8 || values.password.length > PASSWORD_MAX_LENGTH) errors.password = 'Mật khẩu cần từ 8 đến 128 ký tự.'
  else if (values.email && normalizeEmail(values.password) === normalizeEmail(values.email)) errors.password = 'Mật khẩu không được trùng với email.'
  if (!values.confirmPassword) errors.confirmPassword = 'Vui lòng xác nhận mật khẩu mới.'
  else if (values.password !== values.confirmPassword) errors.confirmPassword = 'Mật khẩu xác nhận chưa khớp.'
  return errors
}
