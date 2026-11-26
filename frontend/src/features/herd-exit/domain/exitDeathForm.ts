// SCR-43 death / loss form rules (FE-13 §6).
const FIXED_DISPOSALS = ['Tiêu hủy / chôn lấp tại trại', 'Giao thú y địa phương']
export const OTHER_DISPOSAL = 'Khác'
export const DISPOSALS = [...FIXED_DISPOSALS, OTHER_DISPOSAL]
const OTHER_PREFIX = 'Khác: '
export const MAX_CAUSE = 1000
export const MAX_OTHER_DISPOSAL = 200

/** Stored `carcassDisposal` (free text ≤ 255) → radio choice + "Khác" text (SCR-43 #7). */
export function readDisposal(value: string | undefined): { choice: string; other: string } {
  const text = (value ?? '').trim()
  if (!text) return { choice: '', other: '' }
  if (FIXED_DISPOSALS.includes(text)) return { choice: text, other: '' }
  if (text === OTHER_DISPOSAL) return { choice: OTHER_DISPOSAL, other: '' }
  return { choice: OTHER_DISPOSAL, other: text.startsWith(OTHER_PREFIX) ? text.slice(OTHER_PREFIX.length) : text }
}

/** Radio choice + "Khác" text → `carcassDisposal`. */
export const writeDisposal = (choice: string, other: string) => choice === OTHER_DISPOSAL ? `${OTHER_PREFIX}${other.trim()}` : choice

export type DeathErrors = { date?: string; reason?: string; disposal?: string; other?: string }
/** SCR-43 #2, #6, #7: date not in the future, cause required ≤ 1.000, disposal required when the cattle died ("Khác" needs text). */
export function deathErrors({ date, reason, died, choice, other, today }: { date: string; reason: string; died: boolean; choice: string; other: string; today: string }): DeathErrors {
  const errors: DeathErrors = {}
  if (!date) errors.date = 'Ngày chết / mất là bắt buộc.'
  else if (date > today) errors.date = 'Thời điểm không được ở tương lai.'
  if (!reason.trim()) errors.reason = 'Nguyên nhân / ghi chú là bắt buộc.'
  else if (reason.length > MAX_CAUSE) errors.reason = `Nguyên nhân / ghi chú tối đa ${MAX_CAUSE.toLocaleString('vi-VN')} ký tự.`
  if (died && !choice) errors.disposal = 'Xử lý xác là bắt buộc.'
  if (died && choice === OTHER_DISPOSAL && !other.trim()) errors.other = 'Nội dung xử lý xác là bắt buộc.'
  return errors
}
