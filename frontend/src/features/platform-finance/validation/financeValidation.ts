// Input validation moved out of src/features/platform-finance/domain/financeRules.ts (refactor phase 2): field rules only, the
// business policy stays in the domain file.
import type { RecordErrors, RecordFields, ReportCriteria } from '../types'
import { DEMO_TODAY, FINANCE_CATEGORIES, TYPE_LABEL } from '../domain/financeRules'

export function validateRecordFields(f: RecordFields, today = DEMO_TODAY, categoryOptions = FINANCE_CATEGORIES): RecordErrors {
  const errors: RecordErrors = {}
  if (!f.category) errors.category = 'Danh mục là bắt buộc.'
  else if (!categoryOptions[f.type].includes(f.category)) errors.category = `Danh mục ${f.category} không dùng được cho ${TYPE_LABEL[f.type]}.`
  if (!Number.isInteger(f.amountVnd) || f.amountVnd < 1) errors.amountVnd = 'Số tiền phải là số nguyên đồng lớn hơn 0.'
  if (!f.occurredOn) errors.occurredOn = 'Ngày phát sinh là bắt buộc.'
  else if (f.occurredOn > today) errors.occurredOn = 'Ngày phát sinh không được ở tương lai.'
  if (f.scope === 'FARM' && !f.farmId) errors.farmId = 'Trang trại là bắt buộc khi gắn với trại.'
  if (f.documentNumber.length > 100) errors.documentNumber = 'Số chứng từ tối đa 100 ký tự.'
  if (f.description.length > 500) errors.description = 'Diễn giải tối đa 500 ký tự.'
  if (f.sourceType === 'BANK' && !f.sourceEvidenceId) errors.sourceEvidenceId = 'Hãy chọn chứng từ ngân hàng.'
  return errors
}

const minusMonths = (iso: string, months: number) => {
  const year = Number(iso.slice(0, 4))
  const month = Number(iso.slice(5, 7)) - 1
  const day = Number(iso.slice(8, 10))
  const target = new Date(Date.UTC(year, month - months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  return `${target.getUTCFullYear().toString().padStart(4, '0')}-${(target.getUTCMonth() + 1).toString().padStart(2, '0')}-${Math.min(day, lastDay).toString().padStart(2, '0')}`
}
export function validateCriteria(c: ReportCriteria): string | null {
  if (!c.dateFrom || !c.dateTo) return 'Kỳ báo cáo là bắt buộc.'
  if (c.dateFrom > c.dateTo) return 'Ngày bắt đầu phải trước ngày kết thúc.'
  if (c.dateFrom < minusMonths(c.dateTo, 24)) return 'Kỳ báo cáo tối đa 24 tháng.'
  return null
}
