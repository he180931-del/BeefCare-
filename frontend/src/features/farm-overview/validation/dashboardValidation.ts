// Input validation moved out of src/features/farm-overview/domain/dashboardRules.ts (refactor phase 2): field rules only, the
// business policy stays in the domain file.
import type { DashboardFilters } from '../types'

/** Trả về thông báo lỗi tiếng Việt hoặc null (MSG-COM-06, MSG-COM-11). */
export function validateFilters(f: DashboardFilters): string | null {
  if (f.period !== 'custom') return null
  if (!f.from || !f.to) return 'Kỳ là bắt buộc.'
  if (f.from > f.to) return 'Ngày bắt đầu không được sau ngày kết thúc.'
  return null
}
