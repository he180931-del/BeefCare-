import type {
  ChangeMemberInput,
  CompleteOwnerProfileInput,
  FarmInfoInput,
  FarmRegistrationInput,
  InviteMemberInput,
} from './types'

export type FormErrors<T extends object> = Partial<Record<keyof T, string>>

const PHONE_PATTERN = /^(?:0\d{9}|\+84\d{9})$/
/** Số điện thoại có thể gõ kèm dấu cách, chấm hoặc gạch ("0912 345 678"); chỉ kiểm tra và gửi dạng đã bỏ ký tự phân tách. */
export const compactPhone = (value: string) => value.replace(/[\s.-]/g, '')
const PHONE = { test: (value: string) => PHONE_PATTERN.test(compactPhone(value)) }
const NAME = (value: unknown, min: number, max: number) => typeof value === 'string' && value.trim().length >= min && value.trim().length <= max
const optionalText = (value: unknown, max: number) => value == null || (typeof value === 'string' && value.length <= max)

export function validateOwnerProfile(input: Partial<CompleteOwnerProfileInput>): FormErrors<CompleteOwnerProfileInput> {
  const errors: FormErrors<CompleteOwnerProfileInput> = {}
  if (!NAME(input.fullName, 2, 100)) errors.fullName = 'Họ tên cần có từ 2 đến 100 ký tự.'
  if (input.phone && !PHONE.test(input.phone.trim())) errors.phone = 'Nhập số điện thoại Việt Nam hợp lệ.'
  if (input.termsAccepted !== true) errors.termsAccepted = 'Bạn cần đồng ý với Điều khoản sử dụng và Chính sách dữ liệu.'
  return errors
}

export function validateFarmRegistration(input: Partial<Omit<FarmRegistrationInput, 'expectedHerdSize'>> & { expectedHerdSize?: string }): FormErrors<FarmRegistrationInput> {
  const errors: FormErrors<FarmRegistrationInput> = {}
  if (!NAME(input.name, 2, 150)) errors.name = 'Tên trại cần có từ 2 đến 150 ký tự.'
  if (!NAME(input.province, 1, 150)) errors.province = 'Chọn tỉnh hoặc thành phố.'
  if (!NAME(input.commune, 1, 150)) errors.commune = 'Nhập xã, phường hoặc thị trấn.'
  if (!optionalText(input.detailedAddress, 255)) errors.detailedAddress = 'Địa chỉ chi tiết tối đa 255 ký tự.'
  if (!optionalText(input.contactPerson, 100)) errors.contactPerson = 'Người liên hệ tối đa 100 ký tự.'
  if (input.contactPhone && !PHONE.test(input.contactPhone.trim())) errors.contactPhone = 'Nhập số điện thoại Việt Nam hợp lệ.'
  if (!optionalText(input.registrationCertificateInfo, 255)) errors.registrationCertificateInfo = 'Thông tin giấy đăng ký tối đa 255 ký tự.'
  if (!['UNDER_50', '50_149', '150_300', 'OVER_300'].includes(String(input.expectedHerdSize))) errors.expectedHerdSize = 'Chọn quy mô đàn dự kiến.'
  if (input.mainBreedCodes != null && !Array.isArray(input.mainBreedCodes)) errors.mainBreedCodes = 'Danh sách giống không hợp lệ.'
  return errors
}

export function validateFarmInfo(input: Partial<FarmInfoInput>): FormErrors<FarmInfoInput> {
  const errors: FormErrors<FarmInfoInput> = {}
  if (!NAME(input.name, 2, 150)) errors.name = 'Tên trại cần có từ 2 đến 150 ký tự.'
  if (!NAME(input.province, 1, 150)) errors.province = 'Chọn tỉnh hoặc thành phố.'
  if (!NAME(input.commune, 1, 150)) errors.commune = 'Nhập xã, phường hoặc thị trấn.'
  if (!optionalText(input.detailedAddress, 255)) errors.detailedAddress = 'Địa chỉ chi tiết tối đa 255 ký tự.'
  if (!optionalText(input.contactPerson, 100)) errors.contactPerson = 'Người liên hệ tối đa 100 ký tự.'
  if (input.contactPhone && !PHONE.test(input.contactPhone.trim())) errors.contactPhone = 'Nhập số điện thoại Việt Nam hợp lệ.'
  if (!optionalText(input.registrationCertificateInfo, 255)) errors.registrationCertificateInfo = 'Thông tin giấy đăng ký tối đa 255 ký tự.'
  if (!optionalText(input.timeZone, 40) || !input.timeZone?.trim()) errors.timeZone = 'Chọn múi giờ.'
  if (input.morningShiftStart && !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(input.morningShiftStart)) errors.morningShiftStart = 'Nhập giờ theo định dạng HH:mm.'
  if (!optionalText(input.operatingNotes, 1000)) errors.operatingNotes = 'Ghi chú vận hành tối đa 1.000 ký tự.'
  return errors
}

export function validateInvite(input: Partial<Omit<InviteMemberInput, 'role' | 'validityDays'>> & { role?: string; validityDays?: number }): FormErrors<InviteMemberInput> {
  const errors: FormErrors<InviteMemberInput> = {}
  const email = input.email?.trim() ?? ''
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Nhập địa chỉ email hợp lệ.'
  if (input.role !== 'MANAGER' && input.role !== 'TECHNICIAN') errors.role = 'Chọn Quản lý hoặc Kỹ thuật viên.'
  if (![3, 7, 14].includes(Number(input.validityDays))) errors.validityDays = 'Thời hạn lời mời là 3, 7 hoặc 14 ngày.'
  return errors
}

export function validateMemberChange(input: Partial<ChangeMemberInput>, today = new Date().toISOString().slice(0, 10)): FormErrors<ChangeMemberInput> {
  const errors: FormErrors<ChangeMemberInput> = {}
  if (!['CHANGE_ROLE', 'DEACTIVATE', 'REACTIVATE'].includes(String(input.action))) errors.action = 'Chọn thao tác cần thực hiện.'
  if (input.action === 'CHANGE_ROLE' && input.role !== 'MANAGER' && input.role !== 'TECHNICIAN') errors.role = 'Chọn vai trò mới.'
  if (!input.effectiveDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveDate) || input.effectiveDate > today) errors.effectiveDate = 'Ngày hiệu lực không được ở tương lai.'
  if (!NAME(input.reason, 1, 500)) errors.reason = 'Nhập lý do (tối đa 500 ký tự).'
  return errors
}
