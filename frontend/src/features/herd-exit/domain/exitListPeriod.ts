import type { ExitListQuery, ExitListResult, ExitStatus, ExitStatusCountKey, ExitType, HerdExit } from '../types'

const EXIT_TYPES: ExitType[] = ['Bán', 'Loại thải', 'Chết / mất', 'Khác']
const STATUS_KEY: Record<ExitStatus, ExitStatusCountKey> = {
  'Nháp': 'DRAFT', 'Chờ xác nhận': 'PENDING', 'Đã xuất': 'CONFIRMED', 'Đã hủy': 'VOIDED', 'Đã bác': 'DISMISSED',
}

const iso = (year: number, month: number, day = 1) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
const quarterStart = (year: number, quarter: number) => quarter < 0 ? iso(year - 1, 10) : iso(year, quarter * 3 + 1)

/** SCR-41 #3 quick periods (UX), all ending today (business date yyyy-mm-dd). */
export function exitPeriodPresets(today: string): Array<{ value: string; label: string; from: string; to: string }> {
  const year = Number(today.slice(0, 4))
  const quarter = Math.floor((Number(today.slice(5, 7)) - 1) / 3)
  return [
    { value: 'quarter', label: 'Quý này', from: quarterStart(year, quarter), to: today },
    { value: 'previous-quarter', label: 'Quý trước đến nay', from: quarterStart(year, quarter - 1), to: today },
    { value: 'year', label: 'Năm nay', from: iso(year, 1), to: today },
  ]
}

/** Server default of SCR-41 (#3): start of the previous quarter. */
export const previousQuarterStart = (today: string) => exitPeriodPresets(today)[1].from

/**
 * Local/demo stand-in for `GET /exit-vouchers`: same period, type and tile rules as the server
 * (only CONFIRMED vouchers count; revenue only for Sale / Cull).
 */
export function localExitListResult(rows: ReadonlyArray<HerdExit>, query: ExitListQuery, today: string): ExitListResult {
  const from = query.from || previousQuarterStart(today)
  const to = query.to || today
  const inPeriod = rows.filter((row) => (row.date ?? '') >= from && (row.date ?? '') <= to && (!query.type || row.type === query.type))
  const done = inPeriod.filter((row) => row.status === 'Đã xuất')
  const owed = done.filter((row) => (row.type === 'Bán' || row.type === 'Loại thải') && (row.due ?? 0) > 0)
  const statusCounts = { ALL: inPeriod.length, DRAFT: 0, PENDING: 0, CONFIRMED: 0, VOIDED: 0, DISMISSED: 0 }
  for (const row of inPeriod) statusCounts[STATUS_KEY[row.status]] += 1
  const cattleExitedByType = Object.fromEntries(EXIT_TYPES.map((type) => [type, done.filter((row) => row.type === type).reduce((sum, row) => sum + (row.count ?? 0), 0)])) as Record<ExitType, number>
  return {
    from, to, statusCounts, vouchers: [...inPeriod],
    tiles: {
      cattleExitedByType,
      cattleExited: Object.values(cattleExitedByType).reduce((sum, count) => sum + count, 0),
      salesRevenue: done.filter((row) => row.type === 'Bán' || row.type === 'Loại thải').reduce((sum, row) => sum + (row.total ?? 0), 0),
      toCollect: owed.reduce((sum, row) => sum + (row.due ?? 0), 0),
      vouchersToCollect: owed.length,
      awaitingOwner: rows.filter((row) => row.status === 'Chờ xác nhận').length,
    },
  }
}
