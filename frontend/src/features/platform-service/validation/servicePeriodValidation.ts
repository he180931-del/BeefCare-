// Input validation moved out of src/features/platform-service/domain/servicePeriods.ts (refactor phase 2): field rules only, the
// business policy stays in the domain file.
export function validateReason(reason: string, label = 'Lý do', max = 500) {
  const t = reason.trim()
  if (!t) return `${label} là bắt buộc.`
  if (t.length > max) return `${label} tối đa ${max} ký tự.`
  return null
}
