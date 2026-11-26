import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { EXIT_TABS, sortExitRows, tabCount } from '../../../src/features/herd-exit/hooks/useExitList'
import { exitPeriodPresets, localExitListResult, previousQuarterStart } from '../../../src/features/herd-exit/domain/exitListPeriod'
import { cattleWeightLabel, exitWeightLabel, historyLine } from '../../../src/features/herd-exit/domain/exitDisplay'
import type { HerdExit } from '../../../src/features/herd-exit/types'

const rows: HerdExit[] = [
  { id: 'PX-2026-0001', date: '2026-07-02', type: 'Bán', status: 'Đã xuất', count: 2, total: 100, due: 20 },
  { id: 'PX-2026-0002', date: '2026-10-03', type: 'Chết / mất', status: 'Chờ xác nhận', count: 1 },
  { id: 'PX-2026-0003', date: '2026-10-04', type: 'Khác', status: 'Đã xuất', count: 1, total: 50, due: 0 },
  { id: 'PX-2026-0010', date: '2026-10-04', type: 'Loại thải', status: 'Đã hủy', count: 1, total: 70 },
]

describe('SCR-41 period', () => {
  it('defaults to the previous quarter start and offers quick periods ending today', () => {
    expect(previousQuarterStart('2026-11-25')).toBe('2026-07-01')
    expect(previousQuarterStart('2026-02-10')).toBe('2025-10-01')
    expect(exitPeriodPresets('2026-11-25').map((item) => [item.value, item.from, item.to])).toEqual([
      ['quarter', '2026-10-01', '2026-11-25'], ['previous-quarter', '2026-07-01', '2026-11-25'], ['year', '2026-01-01', '2026-11-25'],
    ])
  })

  it('local list filters by the whole period and type; revenue counts only Sale / Cull', () => {
    const all = localExitListResult(rows, {}, '2026-11-25')
    expect([all.from, all.to]).toEqual(['2026-07-01', '2026-11-25'])
    expect(all.tiles).toEqual(expect.objectContaining({ cattleExited: 3, salesRevenue: 100, toCollect: 20, vouchersToCollect: 1, awaitingOwner: 1 }))
    expect(all.tiles.cattleExitedByType).toEqual({ 'Bán': 2, 'Loại thải': 0, 'Chết / mất': 0, 'Khác': 1 })
    expect(all.statusCounts).toEqual({ ALL: 4, DRAFT: 0, PENDING: 1, CONFIRMED: 2, VOIDED: 1, DISMISSED: 0 })
    const october = localExitListResult(rows, { from: '2026-10-01', to: '2026-10-03', type: '' }, '2026-11-25')
    expect(october.vouchers.map((row) => row.id)).toEqual(['PX-2026-0002'])
    expect(localExitListResult(rows, { type: 'Khác' }, '2026-11-25').vouchers.map((row) => row.id)).toEqual(['PX-2026-0003'])
  })

  it('tab counts come from statusCounts, not from loaded rows', () => {
    const result = { ...localExitListResult([], {}, '2026-11-25'), statusCounts: { ALL: 9, DRAFT: 1, PENDING: 2, CONFIRMED: 3, VOIDED: 2, DISMISSED: 1 } }
    expect(EXIT_TABS.map((tab) => tabCount(result, tab))).toEqual([9, 1, 2, 3, 3])
  })

  it('has no hardcoded period in the list code', () => {
    for (const file of ['hooks/useExitList.ts', 'pages/ExportList.tsx', 'domain/exitListPeriod.ts']) {
      expect(readFileSync(`src/features/herd-exit/${file}`, 'utf8')).not.toMatch(/22\/10\/2026|01\/07\/2026|2026-07-01/)
    }
  })
})

describe('SCR-41 sorting and display', () => {
  it('sorts by date (default descending) with code as tie-breaker, or by code', () => {
    expect(sortExitRows(rows, { key: 'date', descending: true }).map((row) => row.id)).toEqual(['PX-2026-0010', 'PX-2026-0003', 'PX-2026-0002', 'PX-2026-0001'])
    expect(sortExitRows(rows, { key: 'id', descending: false }).map((row) => row.id)).toEqual(['PX-2026-0001', 'PX-2026-0002', 'PX-2026-0003', 'PX-2026-0010'])
  })

  it('formats weight with unit, "~" when estimated and "—" when unknown', () => {
    expect(exitWeightLabel({ weightKg: 1380, weightEstimated: true })).toBe('~1.380 kg')
    expect(exitWeightLabel({ weightKg: 690, weightEstimated: false })).toBe('690 kg')
    expect(exitWeightLabel({ weightKg: null })).toBe('—')
    expect(exitWeightLabel({ weight: '1.002 kg' })).toBe('1.002 kg')
    expect(cattleWeightLabel({ weight: 352, weightBasis: 'MEASURED' })).toBe('352 kg · Đo')
    expect(cattleWeightLabel({ weight: 180, estimated: true })).toBe('~180 kg · UT')
    expect(cattleWeightLabel({ weight: null })).toBe('—')
  })

  it('history line keeps farm time and actor', () => {
    expect(historyLine({ time: '2026-10-15T00:10:00Z', actor: 'An', text: 'Xác nhận xuất 4 con' })).toBe('15/10 07:10 · An · Xác nhận xuất 4 con')
    expect(historyLine({ text: 'Phiếu cũ' })).toBe('Phiếu cũ')
  })
})
