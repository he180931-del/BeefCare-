/**
 * Liều thuốc dạng "số + đơn vị" (D65), dùng chung cho danh mục thuốc (FE-18) và ghi / sửa điều trị (FE-10).
 * Vẫn lưu một chuỗi chuẩn như "30 ml" theo SRS (chữ, tối đa 50) nên không đổi API hay DB. Liều theo thể trọng
 * (ví dụ "1 ml / 10 kg") ghi ở Ghi chú của thuốc, không nằm trong ô liều.
 */
export const DOSE_UNITS = ['ml', 'lít', 'mg', 'g', 'viên', 'gói', 'liều'] as const
export type DoseUnit = (typeof DOSE_UNITS)[number]

export const DOSE_MAX_LENGTH = 50
export const DOSE_FORMAT_MESSAGE = `Liều phải là số lớn hơn 0 kèm đơn vị (${DOSE_UNITS.join(', ')}).`

const PATTERN = /^\s*(\d+(?:[.,]\d+)?)\s*(\S.*?)\s*$/

export interface DoseParts {
  amount: string
  unit: DoseUnit
  /** Chuỗi cũ không theo chuẩn: giao diện hiện nguyên văn cho người dùng sửa, không âm thầm bỏ đi. */
  legacy: boolean
}

/** Tách "30 ml" / "2,5ml" thành số và đơn vị; chuỗi khác (ví dụ "1 ml/10 kg", "3 ống") trả {@code legacy = true}. */
export function splitDose(text: string | null | undefined): DoseParts {
  const raw = (text ?? '').trim()
  if (!raw) return { amount: '', unit: 'ml', legacy: false }
  const m = PATTERN.exec(raw)
  const unit = m ? DOSE_UNITS.find((u) => u === m[2].toLocaleLowerCase('vi')) : undefined
  return m && unit ? { amount: m[1].replace('.', ','), unit, legacy: false } : { amount: '', unit: 'ml', legacy: true }
}

/** Số người dùng gõ (chấp nhận dấu phẩy) → số; trống → null; gõ sai hoặc ≤ 0 → NaN. */
export function parseDoseAmount(amount: string): number | null {
  const t = amount.trim().replace(',', '.')
  if (!t) return null
  return /^\d+(\.\d+)?$/.test(t) && Number(t) > 0 ? Number(t) : Number.NaN
}

/** Ghép chuỗi lưu: "2,5 ml"; số trống → chuỗi rỗng; số gõ sai giữ nguyên để bước kiểm báo lỗi dưới ô. */
export function joinDose(amount: string, unit: DoseUnit): string {
  const t = amount.trim()
  return t ? `${t.replace('.', ',')} ${unit}` : ''
}

/** Chuỗi liều đã theo chuẩn số + đơn vị chưa. */
export function isStandardDose(text: string): boolean {
  const parts = splitDose(text)
  return !parts.legacy && Number.isFinite(parseDoseAmount(parts.amount) ?? Number.NaN)
}
