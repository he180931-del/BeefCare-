import { ACCEPTED_FARM_TIME_ZONES, businessDate } from '../../../shared/lib/date/farmTime'
import type {
  ChangeMemberInput,
  CompleteOwnerProfileInput,
  FarmInfoInput,
  FarmRegistrationInput,
  InviteMemberInput,
} from '../types'
import { PROVINCES } from '../constants/provinces'

export type FormErrors<T extends object> = Partial<Record<keyof T, string>>

const PHONE_PATTERN = /^(?:0\d{9}|\+84\d{9})$/
/** Số điện thoại có thể gõ kèm dấu cách, chấm hoặc gạch ("0912 345 678"); chỉ kiểm tra và gửi dạng đã bỏ ký tự phân tách. */
export const compactPhone = (value: string) => value.replace(/[\s.-]/g, '')
const PHONE = { test: (value: string) => PHONE_PATTERN.test(compactPhone(value)) }
const NAME = (value: unknown, min: number, max: number) => typeof value === 'string' && value.trim().length >= min && value.trim().length <= max
const optionalText = (value: unknown, max: number) => value == null || (typeof value === 'string' && value.length <= max)
const blank = (value: unknown) => typeof value !== 'string' || value.trim() === ''

/**
 * Name, province and commune of SCR-10 / SCR-11: "{field} là bắt buộc." (MSG-COM-06) when empty, the bounds or list
 * message only when something was entered.
 */
function farmLocationErrors(input: { name?: unknown; province?: string | null; commune?: unknown }) {
  const errors: { name?: string; province?: string; commune?: string } = {}
  if (blank(input.name)) errors.name = 'Tên trại là bắt buộc.'
  else if (!NAME(input.name, 2, 150)) errors.name = 'Tên trại cần có từ 2 đến 150 ký tự.'
  const province = input.province?.trim() ?? ''
  if (!province) errors.province = 'Tỉnh/Thành là bắt buộc.'
  else if (!(PROVINCES as readonly string[]).includes(province)) errors.province = 'Chọn tỉnh hoặc thành phố trong danh sách.'
  if (blank(input.commune)) errors.commune = 'Xã/Phường là bắt buộc.'
  else if (!NAME(input.commune, 1, 150)) errors.commune = 'Xã/Phường tối đa 150 ký tự.'
  return errors
}

export function validateOwnerProfile(input: Partial<CompleteOwnerProfileInput>): FormErrors<CompleteOwnerProfileInput> {
  const errors: FormErrors<CompleteOwnerProfileInput> = {}
  if (!NAME(input.fullName, 2, 100)) errors.fullName = 'Họ tên cần có từ 2 đến 100 ký tự.'
  if (input.phone && !PHONE.test(input.phone.trim())) errors.phone = 'Nhập số điện thoại Việt Nam hợp lệ.'
  if (input.termsAccepted !== true) errors.termsAccepted = 'Bạn cần đồng ý với Điều khoản sử dụng và Chính sách dữ liệu.'
  return errors
}

/** SCR-10 (UC-FE02-01). Tỉnh phải thuộc danh sách 34 tỉnh/thành (quyết định FE-02 Q3); quy mô dự kiến không bắt buộc. */
export function validateFarmRegistration(input: Partial<Omit<FarmRegistrationInput, 'expectedHerdSize'>> & { expectedHerdSize?: string }): FormErrors<FarmRegistrationInput> {
  const errors: FormErrors<FarmRegistrationInput> = { ...farmLocationErrors(input) }
  if (!optionalText(input.detailedAddress, 255)) errors.detailedAddress = 'Địa chỉ chi tiết tối đa 255 ký tự.'
  if (!optionalText(input.contactPerson, 100)) errors.contactPerson = 'Người liên hệ tối đa 100 ký tự.'
  if (input.contactPhone && !PHONE.test(input.contactPhone.trim())) errors.contactPhone = 'Nhập số điện thoại Việt Nam hợp lệ.'
  if (!optionalText(input.registrationCertificateInfo, 255)) errors.registrationCertificateInfo = 'Thông tin giấy chứng nhận tối đa 255 ký tự.'
  if (input.expectedHerdSize && !['UNDER_50', '50_149', '150_300', 'OVER_300'].includes(input.expectedHerdSize)) errors.expectedHerdSize = 'Chọn quy mô đàn dự kiến.'
  if (input.mainBreedCodes != null && !Array.isArray(input.mainBreedCodes)) errors.mainBreedCodes = 'Danh sách giống không hợp lệ.'
  return errors
}

/**
 * SCR-11 (UC-FE02-03). Như SCR-10 cho tỉnh (Q3), cộng phần vận hành: múi giờ UTC+7 (D39), giờ ca sáng
 * HH:mm, ghi chú tối đa 1.000 ký tự. Tên tỉnh cũ ngoài danh sách vẫn hiện để Chủ trại thấy và chọn lại.
 */
export function validateFarmInfo(input: Partial<FarmInfoInput>): FormErrors<FarmInfoInput> {
  const errors: FormErrors<FarmInfoInput> = { ...farmLocationErrors(input) }
  if (!optionalText(input.detailedAddress, 255)) errors.detailedAddress = 'Địa chỉ chi tiết tối đa 255 ký tự.'
  if (!optionalText(input.contactPerson, 100)) errors.contactPerson = 'Người liên hệ tối đa 100 ký tự.'
  if (input.contactPhone && !PHONE.test(input.contactPhone.trim())) errors.contactPhone = 'Nhập số điện thoại Việt Nam hợp lệ.'
  if (!optionalText(input.registrationCertificateInfo, 255)) errors.registrationCertificateInfo = 'Thông tin giấy chứng nhận tối đa 255 ký tự.'
  const timeZone = input.timeZone?.trim() ?? ''
  if (timeZone && !ACCEPTED_FARM_TIME_ZONES.has(timeZone)) errors.timeZone = 'Múi giờ phải là UTC+7.'
  if (input.morningShiftStart && !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(input.morningShiftStart)) errors.morningShiftStart = 'Nhập giờ theo định dạng HH:mm.'
  if (!optionalText(input.operatingNotes, 1000)) errors.operatingNotes = 'Ghi chú vận hành tối đa 1.000 ký tự.'
  return errors
}

export function validateInvite(input: Partial<Omit<InviteMemberInput, 'role' | 'validityDays'>> & { role?: string; validityDays?: number }): FormErrors<InviteMemberInput> {
  const errors: FormErrors<InviteMemberInput> = {}
  const email = input.email?.trim() ?? ''
  // TC-03-01/02: thiếu giá trị là MSG-COM-06, sai định dạng / quá 254 ký tự là MSG-COM-10.
  if (!email) errors.email = 'Email người nhận là bắt buộc.'
  else if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Nhập địa chỉ email hợp lệ.'
  if (!input.role) errors.role = 'Vai trò là bắt buộc.'
  else if (input.role !== 'MANAGER' && input.role !== 'TECHNICIAN') errors.role = 'Chọn Quản lý hoặc Kỹ thuật viên.'
  if (![3, 7, 14].includes(Number(input.validityDays))) errors.validityDays = 'Thời hạn lời mời là 3, 7 hoặc 14 ngày.'
  return errors
}

/** GBR-66: ngày nghiệp vụ Việt Nam, kể cả khi UTC còn ở ngày hôm trước. */
export const farmToday = businessDate

/** Same rule as the server (Table III-1, D30): trimmed, at least 5 non-space characters, at most 500. */
export const MEMBER_REASON_RULE = 'Lý do cần ít nhất 5 ký tự (không tính khoảng trắng) và tối đa 500 ký tự.'
const visibleCharacters = (value: string) => [...value].filter((character) => !/\s/u.test(character)).length

/** UC-FE03-06 popup (D30): COM-06 for an empty field, COM-07 for a future date, COM-10 for a reason outside 5–500. */
export function validateMemberChange(input: Partial<ChangeMemberInput>, today = farmToday()): FormErrors<ChangeMemberInput> {
  const errors: FormErrors<ChangeMemberInput> = {}
  if (!['CHANGE_ROLE', 'DEACTIVATE', 'REACTIVATE'].includes(String(input.action))) errors.action = 'Chọn hành động.'
  if (input.action === 'CHANGE_ROLE' && input.role !== 'MANAGER' && input.role !== 'TECHNICIAN') errors.role = 'Chọn vai trò mới.'
  if (!input.effectiveDate) errors.effectiveDate = 'Ngày hiệu lực là bắt buộc.'
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveDate) || input.effectiveDate > today) errors.effectiveDate = 'Ngày hiệu lực không được ở tương lai.'
  const reason = typeof input.reason === 'string' ? input.reason.trim() : ''
  if (!reason) errors.reason = 'Lý do là bắt buộc.'
  else if (reason.length > 500 || visibleCharacters(reason) < 5) errors.reason = MEMBER_REASON_RULE
  return errors
}
