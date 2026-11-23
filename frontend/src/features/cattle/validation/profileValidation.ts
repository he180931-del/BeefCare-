// Input validation moved out of src/features/cattle/domain/profileRules.ts (refactor phase 2): field rules only, the
// business policy stays in the domain file.
import { type DatedChangeErrors, type IdentityErrors, type IdentityValues, PHOTO_MAX_BYTES, type TagErrors } from '../domain/profileRules'

/** Identification & description tab (popup fields 2–5, TC-05-10). */
export function validateIdentity(values: IdentityValues): IdentityErrors {
  const errors: IdentityErrors = {}
  if (values.tag.trim().length > 30) errors.tag = 'Số tai tối đa 30 ký tự.'
  if (values.name.trim().length > 50) errors.name = 'Tên tối đa 50 ký tự.'
  if (values.colour.trim().length > 255) errors.colour = 'Màu lông, đặc điểm tối đa 255 ký tự.'
  if (values.notes.trim().length > 1000) errors.notes = 'Ghi chú tối đa 1.000 ký tự.'
  return errors
}

/** Popup field 1: JPG / PNG, at most 5 MB (MSG-COM-10). */
export function validatePhoto(file: { type: string; size: number; name: string }): string {
  const type = file.type.toLowerCase()
  const ok = type === 'image/jpeg' || type === 'image/png' || /\.(jpe?g|png)$/i.test(file.name)
  if (!ok) return 'Ảnh phải là JPG hoặc PNG.'
  if (file.size === 0) return 'Tệp ảnh trống. Vui lòng chọn ảnh khác.'
  if (file.size > PHOTO_MAX_BYTES) return 'Ảnh tối đa 5 MB.'
  return ''
}

/**
 * Purpose / life-stage tabs (R-05-05): a new value, an effective date not in the future (MSG-COM-07) and not before
 * the herd-entry date (MSG-COM-15), and a reason (≤ 500, spec Q1). Dates are yyyy-mm-dd.
 */
export function validateDatedChange(input: { value: string; current: string; date: string; reason: string; today: string; entryDate?: string | null }): DatedChangeErrors {
  const errors: DatedChangeErrors = {}
  if (!input.value) errors.value = 'Vui lòng chọn giá trị mới.'
  else if (input.value === input.current) errors.value = 'Chọn giá trị khác giá trị hiện tại.'
  if (!input.date) errors.date = 'Vui lòng nhập Ngày hiệu lực.'
  else if (input.date > input.today) errors.date = 'Ngày hiệu lực không được ở tương lai.'
  else if (input.entryDate && input.date < input.entryDate) errors.date = `Ngày hiệu lực không được trước ngày nhập đàn ${input.entryDate.split('-').reverse().join('/')}.`
  if (!input.reason.trim()) errors.reason = 'Vui lòng nhập Lý do.'
  else if (input.reason.trim().length > 500) errors.reason = 'Lý do tối đa 500 ký tự.'
  return errors
}

const TAG_CODE = /^[A-Za-z0-9_-]{1,50}$/

/** Issue / Replace QR Tag popup (R-05-12): reason only when replacing; a pre-printed code must be well formed. */
export function validateTag(input: { replacing: boolean; reason: string; tagCode: string; note: string }): TagErrors {
  const errors: TagErrors = {}
  if (input.replacing && !input.reason) errors.reason = 'Vui lòng chọn Lý do thay.'
  if (input.tagCode.trim() && !TAG_CODE.test(input.tagCode.trim())) errors.tagCode = 'Mã thẻ gồm tối đa 50 ký tự: chữ, số, "-" hoặc "_".'
  if (input.note.trim().length > 255) errors.note = 'Ghi chú tối đa 255 ký tự.'
  return errors
}
