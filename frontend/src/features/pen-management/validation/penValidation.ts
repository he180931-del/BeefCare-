// Input validation moved out of src/features/pen-management/domain/penRules.ts (refactor phase 2): field rules only, the
// business policy stays in the domain file.
import type { Pen } from '../types'
import { type AvailabilityErrors, CRITERION_LABELS, CRITERION_TYPES, PEN_CODE_PATTERN, type PenFormErrors, type PenFormValues } from '../domain/penRules'

const INTEGER = /^\d+$/
const DECIMAL = /^\d+(\.\d+)?$/

/**
 * Validation of the Create / Edit Pen popup (SCR-17 popup fields 1–7, R-04-01, R-04-02).
 * Uniqueness is checked case-insensitively, as on the backend; the backend remains authoritative (MSG-FE04-02).
 */
export function validatePenForm(values: PenFormValues, context: { isNew: boolean; existingCodes: string[]; headcount: number; currentCode?: string }): PenFormErrors {
  const errors: PenFormErrors = {}
  const code = values.code.trim()
  if (context.isNew || code.toLowerCase() !== context.currentCode?.trim().toLowerCase()) {
    if (!code) errors.code = 'Vui lòng nhập Mã chuồng.'
    else if (!PEN_CODE_PATTERN.test(code)) errors.code = 'Mã chuồng gồm 1–20 ký tự: chữ, số hoặc dấu "-".'
    else if (context.existingCodes.some((c) => c.toLowerCase() === code.toLowerCase())) errors.code = `Mã chuồng ${code} đã tồn tại trong trại.`
  }
  const name = values.name.trim()
  if (!name) errors.name = 'Vui lòng nhập Tên chuồng.'
  else if (name.length > 100) errors.name = 'Tên chuồng tối đa 100 ký tự.'
  const capacity = values.capacity.trim()
  const minCapacity = Math.max(1, context.headcount)
  if (!capacity) errors.capacity = 'Vui lòng nhập Sức chứa.'
  else if (!INTEGER.test(capacity) || Number(capacity) < 1 || Number(capacity) > 9999) errors.capacity = 'Sức chứa phải là số nguyên từ 1 đến 9.999.'
  else if (Number(capacity) < minCapacity) errors.capacity = `Sức chứa phải là số nguyên, tối thiểu ${minCapacity}.`
  if (values.description.length > 500) errors.description = 'Mô tả tối đa 500 ký tự.'

  for (const type of CRITERION_TYPES) {
    if (!(type in values.criteria)) continue
    const value = values.criteria[type]
    if (type === 'PURPOSE_TYPE' || type === 'LIFE_STAGE' || type === 'SEX') {
      const list = Array.isArray(value) ? value : value ? [value] : []
      if (list.length === 0) errors[type] = `Vui lòng chọn giá trị cho ${CRITERION_LABELS[type]}.`
      continue
    }
    const text = typeof value === 'string' ? value.trim() : ''
    if (!text) errors[type] = `Vui lòng nhập ${CRITERION_LABELS[type]}.`
    else if (type === 'MIN_AGE_MONTHS' && (!INTEGER.test(text) || Number(text) > 240)) errors[type] = 'Tuổi tối thiểu là số nguyên từ 0 đến 240 tháng.'
    else if (type === 'MIN_WEIGHT_KG' && (!DECIMAL.test(text) || Number(text) < 1 || Number(text) > 1500)) errors[type] = 'Cân tối thiểu từ 1 đến 1.500 kg.'
  }
  return errors
}

/** Stop / Resume Pen popup (R-04-13): effective date required and not in the future, reason required (≤ 500). */
export function validateAvailability(date: string, reason: string, today: string): AvailabilityErrors {
  const errors: AvailabilityErrors = {}
  if (!date) errors.date = 'Vui lòng nhập Ngày hiệu lực.'
  else if (date > today) errors.date = 'Ngày hiệu lực không được ở tương lai.'
  if (!reason.trim()) errors.reason = 'Vui lòng nhập Lý do.'
  else if (reason.trim().length > 500) errors.reason = 'Lý do tối đa 500 ký tự.'
  return errors
}
