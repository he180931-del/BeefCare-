import type { PasswordChangeInput, PasswordErrors, ProfileErrors, ProfileUpdateInput } from '../types'

export const PASSWORD_RULE_MESSAGE = 'Mật khẩu cần từ 8 đến 128 điểm mã Unicode và không được trùng với email.'
const PHONE = /^(0\d{9}|\+84\d{9})$/

function passwordCodePointLength(value: string): number {
  return Array.from(value).length
}

export const compactPhone = (value: string) => value.replace(/[\s.-]/g, '')

/** SCR-08: họ tên 2–100 ký tự; điện thoại không bắt buộc, định dạng Việt Nam (MSG-COM-06, MSG-COM-10). */
export function validateProfile(input: ProfileUpdateInput): ProfileErrors {
  const errors: ProfileErrors = {}
  const name = input.fullName.trim()
  if (!name) errors.fullName = 'Họ và tên là bắt buộc.'
  else if (name.length < 2 || name.length > 100) errors.fullName = 'Họ và tên cần từ 2 đến 100 ký tự.'
  const phone = compactPhone(input.phone)
  if (phone && !PHONE.test(phone)) errors.phone = 'Số điện thoại không hợp lệ.'
  return errors
}

/** GBR-02, UC-FE01-06. `requireCurrent` false khi đã xác thực lại với Google hoặc thêm mật khẩu đầu tiên. */
export function validatePasswordChange(input: PasswordChangeInput, ctx: { email: string; requireCurrent: boolean }): PasswordErrors {
  const errors: PasswordErrors = {}
  if (ctx.requireCurrent && !input.currentPassword) errors.currentPassword = 'Mật khẩu hiện tại là bắt buộc.'
  const next = input.newPassword
  if (!next) errors.newPassword = 'Mật khẩu mới là bắt buộc.'
  else if (passwordCodePointLength(next) < 8 || passwordCodePointLength(next) > 128 || next.toLowerCase() === ctx.email.trim().toLowerCase()) errors.newPassword = PASSWORD_RULE_MESSAGE
  if (!input.confirmPassword) errors.confirmPassword = 'Vui lòng nhập lại mật khẩu mới.'
  else if (input.confirmPassword !== next) errors.confirmPassword = 'Mật khẩu xác nhận chưa khớp.'
  return errors
}
