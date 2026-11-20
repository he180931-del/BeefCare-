// Input validation moved out of src/features/farm-catalogue/domain/catalogueRules.ts (refactor phase 2): field rules only, the
// business policy stays in the domain file.
import type { BreedCommand, MedicineCommand, PurposeCommand, VaccineCommand } from '../types'
import { type FieldErrorMap, MEDICINE_ROUTES, PURPOSE_TYPES, VACCINE_ROUTES, checkCode, checkNumber, checkText, required } from '../domain/catalogueRules'

const compact = (errors: Record<string, string | undefined>): FieldErrorMap =>
  Object.fromEntries(Object.entries(errors).filter((e): e is [string, string] => Boolean(e[1])))

// ---- Kiểm tra từng danh mục ----
export const validateBreed = (c: BreedCommand): FieldErrorMap => compact({
  code: checkCode(c.code, 'Mã giống'),
  name: checkText(c.name, 'Tên giống', 100, true),
  group: checkText(c.group, 'Nhóm', 50),
  description: checkText(c.description, 'Mô tả', 500),
})

export const validatePurpose = (c: PurposeCommand): FieldErrorMap => compact({
  code: checkCode(c.code, 'Mã'),
  name: checkText(c.name, 'Tên mục đích', 100, true),
  purposeType: PURPOSE_TYPES.includes(c.purposeType) ? undefined : required('Loại mục đích'),
  description: checkText(c.description, 'Mô tả', 500),
})

export const validateVaccine = (c: VaccineCommand): FieldErrorMap => compact({
  code: checkCode(c.code, 'Mã'),
  name: checkText(c.name, 'Tên vắc-xin', 150, true),
  diseasePrevented: checkText(c.diseasePrevented, 'Phòng bệnh', 150, true),
  manufacturer: checkText(c.manufacturer, 'Nhà sản xuất', 100),
  dose: checkText(c.dose, 'Liều tham chiếu', 50),
  route: !c.route || VACCINE_ROUTES.includes(c.route) ? undefined : 'Đường tiêm không hợp lệ.',
  boosterInterval: checkNumber(c.boosterInterval, 'Nhắc lại sau', 0, 730, { optional: true }),
  withdrawalDays: checkNumber(c.withdrawalDays, 'Ngưng sử dụng thịt', 0, 365),
})

export const validateMedicine = (c: MedicineCommand): FieldErrorMap => compact({
  code: checkCode(c.code, 'Mã'),
  name: checkText(c.name, 'Tên thuốc', 150, true),
  dose: checkText(c.dose, 'Liều tham chiếu', 100),
  route: !c.route || MEDICINE_ROUTES.includes(c.route) ? undefined : 'Đường dùng không hợp lệ.',
  withdrawalDays: checkNumber(c.withdrawalDays, 'Ngưng sử dụng thịt', 0, 365),
  description: checkText(c.description, 'Ghi chú', 500),
})
