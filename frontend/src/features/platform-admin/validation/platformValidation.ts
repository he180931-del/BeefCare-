// Input validation moved out of src/features/platform-admin/domain/platformRules.ts (refactor phase 2): field rules only, the
// business policy stays in the domain file.
import { calendarDate, ymdParts } from '../domain/platformRules'

/** Cộng tháng như máy chủ (LocalDate.plusMonths): 29/02 + 12 tháng = 28/02. */
const plusMonthsClamped = (ymd: string, months: number) => {
  const [y, m, d] = ymdParts(ymd)
  const last = new Date(Date.UTC(y, m + months, 0)).getUTCDate()
  return calendarDate(y, m - 1 + months, Math.min(d, last))
}

/** MSG-COM-06 / MSG-COM-11 / MSG-COM-10, cùng thứ tự kiểm của máy chủ. */
export function validateAuditRange({ from, to }: { from: string; to: string }): string | null {
  if (!from || !to) return 'Vui lòng nhập Khoảng thời gian.'
  if (from > to) return 'Ngày bắt đầu không được sau ngày kết thúc.'
  if (to > plusMonthsClamped(from, 12)) return 'Khoảng thời gian không hợp lệ.'
  return null
}
