/** FE-05 rules of the Update Cattle Profile and Issue / Replace QR Tag popups (spec FE-05 §4, §6). */

export const PURPOSE_TYPE_LABELS: Record<string, string> = {
  BREEDING: 'Sinh sản',
  FATTENING: 'Vỗ béo',
  SIRE: 'Đực giống',
  UNDECIDED: 'Chưa xác định',
}

/** R-05-04: only SIRE is male-only and BREEDING female-only; FATTENING / UNDECIDED fit both sexes. */
export function purposeFitsSex(purposeType: string | undefined, sex: string | undefined): boolean {
  const male = sex === 'MALE' || sex === 'Đực'
  const female = sex === 'FEMALE' || sex === 'Cái'
  if (purposeType === 'SIRE') return male
  if (purposeType === 'BREEDING') return female
  return true
}

/** MSG-FE05-12 for a purpose that does not fit the sex. */
export function purposeSexMessage(purposeName: string, purposeType: string): string {
  const sexLabel = purposeType === 'SIRE' ? 'đực' : 'cái'
  return `${purposeName} là mục đích loại ${PURPOSE_TYPE_LABELS[purposeType] ?? purposeType}, chỉ dùng cho bò ${sexLabel}. Hãy chọn mục đích Vỗ béo, Chưa xác định, hoặc mục đích phù hợp giới tính.`
}

export type IdentityValues = { tag: string; name: string; colour: string; notes: string }
export type IdentityErrors = Partial<Record<keyof IdentityValues, string>>

/** Identification & description tab (popup fields 2–5, TC-05-10). */
export function validateIdentity(values: IdentityValues): IdentityErrors {
  const errors: IdentityErrors = {}
  if (values.tag.trim().length > 30) errors.tag = 'Số tai tối đa 30 ký tự.'
  if (values.name.trim().length > 50) errors.name = 'Tên tối đa 50 ký tự.'
  if (values.colour.trim().length > 255) errors.colour = 'Màu lông, đặc điểm tối đa 255 ký tự.'
  if (values.notes.trim().length > 1000) errors.notes = 'Ghi chú tối đa 1.000 ký tự.'
  return errors
}

export const PHOTO_MAX_BYTES = 5 * 1024 * 1024
/** Popup field 1: JPG / PNG, at most 5 MB (MSG-COM-10). */
export function validatePhoto(file: { type: string; size: number; name: string }): string {
  const type = file.type.toLowerCase()
  const ok = type === 'image/jpeg' || type === 'image/png' || /\.(jpe?g|png)$/i.test(file.name)
  if (!ok) return 'Ảnh phải là JPG hoặc PNG.'
  if (file.size > PHOTO_MAX_BYTES) return 'Ảnh tối đa 5 MB.'
  return ''
}

export type DatedChangeErrors = Partial<Record<'value' | 'date' | 'reason', string>>

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

export const REPLACEMENT_REASONS = [
  ['LOST', 'Mất'],
  ['DAMAGED', 'Hỏng'],
  ['OTHER', 'Khác'],
] as const
export type ReplacementReason = typeof REPLACEMENT_REASONS[number][0]

/** Tag history reason (SCR-21 #6): Mất / Hỏng / Khác, or "Cấp lần đầu" for a tag that did not replace one. */
export const tagReasonLabel = (reason: string | null | undefined): string =>
  REPLACEMENT_REASONS.find(([code]) => code === reason)?.[1] ?? (reason || '')

export type TagErrors = Partial<Record<'reason' | 'tagCode' | 'note', string>>
const TAG_CODE = /^[A-Za-z0-9_-]{1,50}$/

/** Issue / Replace QR Tag popup (R-05-12): reason only when replacing; a pre-printed code must be well formed. */
export function validateTag(input: { replacing: boolean; reason: string; tagCode: string; note: string }): TagErrors {
  const errors: TagErrors = {}
  if (input.replacing && !input.reason) errors.reason = 'Vui lòng chọn Lý do thay.'
  if (input.tagCode.trim() && !TAG_CODE.test(input.tagCode.trim())) errors.tagCode = 'Mã thẻ gồm tối đa 50 ký tự: chữ, số, "-" hoặc "_".'
  if (input.note.trim().length > 255) errors.note = 'Ghi chú tối đa 255 ký tự.'
  return errors
}

export const todayIso = (now: Date = new Date()): string => {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}
