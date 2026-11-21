import { describe, expect, it } from 'vitest'
import { filterExitRows, summarizeExitRows, EXIT_RANGES, EXIT_TABS } from '../../../src/features/herd-exit/hooks/useExitList'
import type { HerdExit } from '../../../src/features/herd-exit/types'

const rows: HerdExit[] = [
  { id: 'PX-1', date: '2026-07-02', type: 'Bán', status: 'Đã xuất', count: 2, total: 100, due: 20 },
  { id: 'PX-2', date: '2026-10-03', type: 'Chết / mất', status: 'Chờ xác nhận', count: 1 },
  { id: 'PX-3', date: '2026-10-04', type: 'Khác', status: 'Đã hủy', count: 1 },
]

describe('useExitList selectors', () => {
  it('filters by tab, type and inclusive range start', () => {
    expect(filterExitRows(rows, EXIT_TABS[3], 'all', '')).toEqual([rows[0]])
    expect(filterExitRows(rows, EXIT_TABS[0], 'oct', 'Khác')).toEqual([rows[2]])
    expect(EXIT_RANGES.find((range) => range.value === 'oct')?.from).toBe('2026-10-01')
  })

  it('summarizes confirmed exits without counting pending or voided rows', () => {
    expect(summarizeExitRows(rows)).toEqual(expect.objectContaining({ doneCount: 2, doneVoucherCount: 1, revenue: 100, owed: 20, owedCount: 1, pendingCount: 1, firstOwedId: 'PX-1', byType: { 'Bán': 2, 'Loại thải': 0, 'Chết / mất': 0, 'Khác': 0 } }))
  })
})
