import { businessDate } from '../../../shared/lib/date/farmTime'

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

export const PHOTO_MAX_BYTES = 5 * 1024 * 1024
export type DatedChangeErrors = Partial<Record<'value' | 'date' | 'reason', string>>

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
export const todayIso = businessDate
