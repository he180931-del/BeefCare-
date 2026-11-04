import { describe, expect, it } from 'vitest'
import { initialCows, type CowSeed } from '../../../src/data/cowsData'
import { adgBetween, entryDate, latestWeight, largeChangeWithinWindow, type GrowthRecord } from '../../../src/features/growth/pages/GrowthPreviewScreens'

const row = (id: string, measuredAt: string, weight: number, basis: 'MEASURED' | 'ESTIMATED' = 'MEASURED'): GrowthRecord => ({
  id,
  originalId: id,
  version: 1,
  measuredAt,
  weightKg: weight,
  weight,
  method: basis === 'MEASURED' ? 'ELECTRONIC_SCALE' : 'TAPE',
  basis,
  status: 'VALID',
})

describe('growth rules', () => {
  it('prefers the latest valid measured weight over a newer estimate', () => {
    const latest = latestWeight([row('estimated', '2026-10-20T08:00', 360, 'ESTIMATED'), row('measured', '2026-10-01T08:00', 350)])
    expect(latest?.id).toBe('measured')
  })

  it('does not expose ADG for a seeded single row or for intervals shorter than fourteen days', () => {
    expect(adgBetween([row('single', '2026-10-01T08:00', 350)])).toBeNull()
    expect(adgBetween([row('a', '2026-10-01T08:00', 350), row('b', '2026-10-10T08:00', 359)])).toBeNull()
  })

  it('does not treat barnSince as the herd entry date', () => {
    const cow = { ...initialCows[0], birth: '—', entryDate: undefined, createdAt: undefined, importRecord: null, barnSince: '20/05/2026' } as CowSeed
    expect(entryDate(cow)).toBeNull()
  })

  it('accepts an explicit cattle birth or registration date when no import date exists', () => {
    const cow = { ...initialCows[0], birth: '12/03/2022', entryDate: undefined, importRecord: null } as CowSeed
    expect(entryDate(cow)).toBe(new Date('2022-03-12T00:00:00').getTime())
  })

  it('warns for a greater-than-twenty-percent change only when the prior weight is recent', () => {
    expect(largeChangeWithinWindow(100, 125, '2026-10-20T08:00', '2026-10-01T08:00')).toBe(true)
    expect(largeChangeWithinWindow(100, 125, '2026-10-20T08:00', '2026-08-01T08:00')).toBe(false)
    expect(largeChangeWithinWindow(100, 110, '2026-10-20T08:00', '2026-10-01T08:00')).toBe(false)
  })
})
