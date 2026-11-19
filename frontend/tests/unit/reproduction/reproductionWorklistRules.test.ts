import { describe, expect, it } from 'vitest'
import { REPRODUCTION_DEMO } from '../../../src/features/reproduction/data/reproductionMock'
import {
  dueLabel, filterWorklist, formatDateTime, primaryActionFor, tabCounts, technicianRowInfo, windowBar,
} from '../../../src/features/reproduction/domain/reproductionRules'

const NOW = '2026-10-20T09:30'

describe('worklist tabs', () => {
  it('counts pregnant females in both Mang thai and Sắp đẻ when due within 30 days', () => {
    const counts = tabCounts(REPRODUCTION_DEMO, NOW)
    expect(counts.IN_ESTRUS).toBe(3)
    expect(counts.PREGNANT).toBe(2)
    expect(counts.DUE_SOON).toBe(1)
  })

  it('filters the Sắp đẻ tab to pregnancies due within 30 days', () => {
    const rows = filterWorklist(REPRODUCTION_DEMO, { status: 'DUE_SOON' }, NOW)
    expect(rows.map((row) => row.cattleCode)).toEqual(['BC-000087'])
  })
})

describe('worklist labels', () => {
  const row = (code: string) => REPRODUCTION_DEMO.find((item) => item.cattleCode === code)!

  it('shows the breeding window as the deadline of an estrus female', () => {
    expect(dueLabel(row('BC-000142'))).toBe('20/10 14:30–18:30')
    expect(dueLabel(row('BC-000188'))).toBe('—')
  })

  it('formats local date-times without time zone shifts', () => {
    expect(formatDateTime('2026-10-20T06:30')).toBe('20/10/2026 06:30')
  })

  it('places the window on a 24 hour bar and the current time marker', () => {
    const bar = windowBar({ from: '2026-10-20T14:30', to: '2026-10-20T18:30' }, NOW)
    expect(bar.left).toBeCloseTo(60.4, 1)
    expect(bar.width).toBeCloseTo(16.7, 1)
    expect(bar.now).toBeCloseTo(39.6, 1)
  })

  it('builds the technician card line and badge from the same data', () => {
    expect(technicianRowInfo(row('BC-000142'))).toEqual({
      subtitle: 'Zebu đỏ · C1 · động dục 20/10 06:30', badge: { label: 'Phối 14:30–18:30', tone: 'warn' },
    })
    expect(technicianRowInfo(row('BC-000188'))).toEqual({
      subtitle: 'Zebu đỏ · C1 · 228 kg', badge: { label: 'Chưa đủ điều kiện', tone: 'err' },
    })
  })

  it('suggests the header action from the reproductive status', () => {
    expect(primaryActionFor('IN_ESTRUS')).toBe('RECORD_BREEDING')
    expect(primaryActionFor('BRED')).toBe('RECORD_PREGNANCY_CHECK')
    expect(primaryActionFor('PREGNANT')).toBe('RECORD_CALVING')
    expect(primaryActionFor('AWAITING_BREEDING')).toBe('RECORD_ESTRUS')
    expect(primaryActionFor(null)).toBeNull()
  })
})
