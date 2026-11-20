import { describe, expect, it } from 'vitest'
import { validateEffective } from '../../../src/features/platform-service/validation/pricingValidation'
import type { PriceVersion } from '../../../src/features/platform-service/types'

// Characterization (golden master) of the SCR-63 effective-time rule, recorded on the code before it moved out of
// domain/ (refactor phase 2). The snapshots are the behaviour to keep.
const version = (patch: Partial<PriceVersion>): PriceVersion => ({
  version: 4, price1y: 1_200_000, price2y: 2_160_000, price3y: 3_060_000, effectiveAt: '2026-12-01T00:00:00', terms: '',
  publishedBy: 'PM', publishedAt: '2026-11-01T00:00:00', withdrawn: false, withdrawReason: null, ...patch,
})
const now = '2026-11-19T10:00:00'

describe('validateEffective', () => {
  it('needs a future time that no live version already uses', () => {
    expect([
      validateEffective('NOW', '', now, []),
      validateEffective('SCHEDULE', '', now, []),
      validateEffective('SCHEDULE', '2026-11-19T09:59', now, []),
      validateEffective('SCHEDULE', '2026-12-01T00:00', now, [version({})]),
      validateEffective('SCHEDULE', '2026-12-01T00:00', now, [version({ withdrawn: true })]),
      validateEffective('SCHEDULE', '2026-12-02T08:30:00', now, [version({})]),
    ]).toMatchInlineSnapshot(`
      [
        null,
        "Thời điểm hiệu lực là bắt buộc.",
        "Thời điểm hiệu lực không được ở quá khứ.",
        "Phiên bản v4 đã được lên lịch vào 01/12/2026 00:00.",
        null,
        null,
      ]
    `)
  })
})
