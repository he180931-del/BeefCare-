// Input validation moved out of src/features/farm-catalogue/domain/parameterRules.ts (refactor phase 2): field rules only, the
// business policy stays in the domain file.
import type { NumericParameterKey, ParameterValues, ParameterVersionCommand } from '../types'
import { checkNumber, checkText, required, type FieldErrorMap } from '../domain/catalogueRules'
import { PARAMETER_FIELDS } from '../domain/parameterRules'

/** Kiểm tra từng giá trị theo khoảng cho phép (MSG-FE18-06) và các quan hệ giữa các giá trị. */
export function validateParameters(v: ParameterValues): FieldErrorMap {
  const errors: FieldErrorMap = {}
  for (const f of PARAMETER_FIELDS) {
    const error = checkNumber(v[f.key], f.label, f.min, f.max, { integer: f.integer !== false, optional: f.optional })
    if (error) errors[f.key] = error
  }
  const ok = (k: NumericParameterKey) => !errors[k] && typeof v[k] === 'number'
  if (ok('weaningAgeMonths') && ok('youngStockAgeMonths') && v.youngStockAgeMonths! <= v.weaningAgeMonths!) {
    errors.youngStockAgeMonths = 'Tuổi bò tơ phải lớn hơn tuổi cai sữa.'
  }
  if (ok('youngStockAgeMonths') && ok('adultAgeMonths') && v.adultAgeMonths! <= v.youngStockAgeMonths!) {
    errors.adultAgeMonths = 'Tuổi trưởng thành phải lớn hơn tuổi bò tơ.'
  }
  if (ok('windowStartHours') && ok('windowEndHours') && v.windowEndHours! <= v.windowStartHours!) {
    errors.windowEndHours = 'Giờ kết thúc phải lớn hơn giờ bắt đầu.'
  }
  if (v.bcsScale !== '1-5' && v.bcsScale !== '1-9') errors.bcsScale = required('Thang BCS')
  return errors
}

export function validateParameterVersion(command: ParameterVersionCommand, today: string): FieldErrorMap {
  const errors = validateParameters(command.parameters)
  const note = checkText(command.sourceNote, 'Ghi chú nguồn', 255, true)
  if (note) errors.sourceNote = note
  if (!command.effectiveFrom) errors.effectiveFrom = required('Ngày áp dụng')
  else if (command.effectiveFrom < today) errors.effectiveFrom = 'Ngày áp dụng phải từ hôm nay trở đi.'
  return errors
}
