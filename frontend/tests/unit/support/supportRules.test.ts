import { describe, expect, it } from 'vitest'
import { formatStamp } from '../../../src/features/platform-support/domain/supportRules'

describe('formatStamp', () => {
  it('converts backend UTC timestamps to Vietnam time', () => {
    expect(formatStamp('2026-11-14T17:43:00Z')).toBe('15/11 00:43')
    expect(formatStamp('2026-11-14T17:43:00Z', true)).toBe('15/11/2026 00:43')
  })

  it('keeps timezone-less local demo timestamps unchanged', () => {
    expect(formatStamp('2026-10-18T09:55:00')).toBe('18/10 09:55')
  })
})
