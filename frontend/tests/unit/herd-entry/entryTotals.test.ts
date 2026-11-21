import { describe, expect, it } from 'vitest'
import { purchaseTotals, receivingPenOverflow } from '../../../src/features/herd-entry/domain/entryTotals'

describe('entry totals selectors', () => {
  it('calculates voucher totals using the selected pricing basis', () => {
    const cows = [
      { weight: 200, unitPrice: 80000, estimated: true, barn: 'A1' },
      { weight: 250, unitPrice: 70000, estimated: false, barn: 'A1' },
    ] as never[]
    expect(purchaseTotals(cows, 'kg', 1500000, 20000000)).toMatchObject({ cattleAmount: 33500000, totalWeight: 450, total: 35000000, debt: 15000000, estimatedCount: 1 })
    expect(purchaseTotals(cows, 'con', 1500000, 20000000).cattleAmount).toBe(150000)
  })

  it('reports overflow only after aggregating all incoming lines per pen', () => {
    const pens = [{ code: 'A1', count: 2, capacity: 3, status: 'ACTIVE', cows: [] }] as never[]
    const cows = [{ barn: 'A1' }, { barn: 'A1' }] as never[]
    expect(receivingPenOverflow(pens, cows).map((pen) => pen.code)).toEqual(['A1'])
  })
})
