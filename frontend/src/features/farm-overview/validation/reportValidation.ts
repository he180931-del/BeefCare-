// Input validation moved out of src/features/farm-overview/domain/reportRules.ts (refactor phase 2): field rules only, the
// business policy stays in the domain file.
import type { ReportRequest } from '../types'

const monthsLimit = (from: string) => {
  const [year, month, day] = from.split('-').map(Number)
  const targetMonth = month - 1 + 24
  const targetYear = year + Math.floor(targetMonth / 12)
  const targetMonthOfYear = targetMonth % 12
  const lastDay = new Date(Date.UTC(targetYear, targetMonthOfYear + 1, 0)).getUTCDate()
  return Date.UTC(targetYear, targetMonthOfYear, Math.min(day, lastDay))
}

/** MSG-COM-06, MSG-COM-11 và kỳ tối đa 24 tháng (SCR-49). */
export function validateReportRequest(req: ReportRequest): string | null {
  if (!req.dateFrom || !req.dateTo) return 'Kỳ báo cáo là bắt buộc.'
  if (req.dateFrom > req.dateTo) return 'Ngày bắt đầu không được sau ngày kết thúc.'
  if (Date.parse(`${req.dateTo}T00:00:00Z`) > monthsLimit(req.dateFrom)) return 'Kỳ báo cáo tối đa 24 tháng.'
  return null
}
