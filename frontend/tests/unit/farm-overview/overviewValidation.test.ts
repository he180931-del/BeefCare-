import { describe, expect, it } from 'vitest'
import { validateFilters } from '../../../src/features/farm-overview/validation/dashboardValidation'
import { validateReportRequest } from '../../../src/features/farm-overview/validation/reportValidation'

// Characterization (golden master) of the SCR-48/50 period rules, recorded on the code before they moved out of
// domain/ (refactor phase 2). The snapshots are the behaviour to keep.
type Filters = Parameters<typeof validateFilters>[0]
type Report = Parameters<typeof validateReportRequest>[0]

describe('dashboard and report periods', () => {
  it('validateFilters only checks a custom period', () => {
    expect([
      validateFilters({ period: '30' } as Filters),
      validateFilters({ period: 'custom', from: '', to: '2026-11-19' } as Filters),
      validateFilters({ period: 'custom', from: '2026-11-20', to: '2026-11-19' } as Filters),
      validateFilters({ period: 'custom', from: '2026-11-01', to: '2026-11-19' } as Filters),
    ]).toMatchInlineSnapshot(`
      [
        null,
        "Kỳ là bắt buộc.",
        "Ngày bắt đầu không được sau ngày kết thúc.",
        null,
      ]
    `)
  })

  it('validateReportRequest needs an ordered period of at most 24 months', () => {
    expect([
      validateReportRequest({ dateFrom: '', dateTo: '2026-11-19' } as Report),
      validateReportRequest({ dateFrom: '2026-11-20', dateTo: '2026-11-19' } as Report),
      validateReportRequest({ dateFrom: '2024-11-19', dateTo: '2026-11-19' } as Report),
      validateReportRequest({ dateFrom: '2024-11-18', dateTo: '2026-11-19' } as Report),
      validateReportRequest({ dateFrom: '2026-01-01', dateTo: '2026-11-19' } as Report),
    ]).toMatchInlineSnapshot(`
      [
        "Kỳ báo cáo là bắt buộc.",
        "Ngày bắt đầu không được sau ngày kết thúc.",
        null,
        "Kỳ báo cáo tối đa 24 tháng.",
        null,
      ]
    `)
  })
})
