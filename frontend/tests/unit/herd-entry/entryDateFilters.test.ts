import { describe, expect, it } from 'vitest'
import { previousQuarterStart } from '../../../src/features/herd-entry/domain/entryDateFilters'

describe('entry list date defaults', () => {
  it.each([
    ['2026-11-21', '2026-07-01'],
    ['2026-01-05', '2025-10-01'],
    ['2026-04-01', '2026-01-01'],
  ])('starts at the previous quarter for %s', (today, expected) => {
    expect(previousQuarterStart(today)).toBe(expected)
  })
})
