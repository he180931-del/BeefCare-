import { describe, expect, it } from 'vitest'
import { getPageCount, paginateReportRows } from '../../../src/features/platform-finance/components/ReportParts'

describe('SCR-73 snapshot pagination', () => {
  it('returns only the configured number of rows and clamps an invalid page', () => {
    const rows = Array.from({ length: 11 }, (_, index) => index + 1)

    expect(paginateReportRows(rows, 2, 5)).toEqual({ rows: [6, 7, 8, 9, 10], page: 2, pageCount: 3, total: 11 })
    expect(paginateReportRows(rows, 99, 5).page).toBe(3)
    expect(paginateReportRows(rows, 0, 5).page).toBe(1)
  })

  it('calculates a single empty page for an empty snapshot', () => {
    expect(getPageCount([], 5)).toBe(1)
    expect(paginateReportRows([], 4, 5)).toEqual({ rows: [], page: 1, pageCount: 1, total: 0 })
  })

  it('keeps a report page transition independent from the immutable snapshot data', () => {
    const snapshot = ['A', 'B', 'C', 'D', 'E', 'F']
    const firstPage = paginateReportRows(snapshot, 1, 5)
    const secondPage = paginateReportRows(snapshot, 2, 5)

    expect(firstPage.rows).toEqual(['A', 'B', 'C', 'D', 'E'])
    expect(secondPage.rows).toEqual(['F'])
    expect(snapshot).toEqual(['A', 'B', 'C', 'D', 'E', 'F'])
  })
})
