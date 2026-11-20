import { describe, expect, it } from 'vitest'
import { fmtDate, fmtDateTime, fmtEndDate, fmtSeconds, fmtShort } from '../../../src/features/platform-service/domain/dates'

// 20:30:15 UTC on 09/11 is 03:30:15 on 10/11 in Viet Nam (UTC+7).
const instant = '2026-11-09T20:30:15Z'
// Demo data already holds Vietnamese local time without a zone.
const local = '2026-11-09T20:30:15'

describe('platform-service date formatting', () => {
  it('shows backend instants in Viet Nam time and keeps zone-less demo values as they are', () => {
    expect(fmtDate(instant)).toBe('10/11/2026')
    expect(fmtDateTime(instant)).toBe('10/11/2026 03:30')
    expect(fmtSeconds(instant)).toBe('10/11/2026 03:30:15')
    expect(fmtDate(local)).toBe('09/11/2026')
    expect(fmtDateTime(local)).toBe('09/11/2026 20:30')
    expect(fmtSeconds(local)).toBe('09/11/2026 20:30:15')
  })

  it('formats the short time and date from the same Viet Nam clock, never mixing UTC time with a local date', () => {
    expect(fmtShort(instant)).toBe('03:30 10/11')
    expect(fmtShort('2026-11-09T03:30:00+07:00')).toBe('03:30 09/11')
    expect(fmtShort(local)).toBe('20:30 09/11')
  })

  it('shows the last served day of a half-open backend end and leaves inclusive demo dates unchanged', () => {
    expect(fmtEndDate('2027-01-01T17:00:00Z')).toBe('01/01/2027') // 02/01 00:00 VN is exclusive
    expect(fmtEndDate('2027-01-01')).toBe('01/01/2027')
    expect(fmtEndDate(null)).toBe('—')
  })
})
