import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { mapVoucher } from '../../../src/features/herd-entry/api/herdEntryMapper'
import { useEntryEditor } from '../../../src/features/herd-entry/hooks/useEntryEditor'
import { validateEntryForPost } from '../../../src/features/herd-entry/validation/entryFormValidation'
import type { EntryCow } from '../../../src/features/herd-entry/types'

const cow: EntryCow = {
  tag: 'TEST-HEAD', name: '', dob: '', dobAccuracy: 'Không rõ', breed: 'Lai Sind', sex: 'Cái', stage: 'Bò tơ', purpose: 'Bò sinh sản',
  weight: 250, weightBasis: 'MEASURED', estimated: false, barn: 'A1', unitPrice: 8_500_000,
  hist: { vaccine: 'Không rõ', disease: 'Không rõ', repro: 'Không rõ' },
}

describe('purchase pricing round trip', () => {
  it.each([['PER_HEAD', 'con'], ['PER_KG', 'kg'], [undefined, 'kg']] as const)('maps voucher pricing %s to its draft and every cow', (pricingBasis, pricing) => {
    const mapped = mapVoucher({
      id: 41, code: 'PN-TEST', entryType: 'PURCHASE', status: 'DRAFT', pricingBasis,
      lines: [
        { entryWeightKg: 250, weightBasis: 'MEASURED', unitPrice: 8_500_000, lineAmount: 8_500_000, data: {} },
        { entryWeightKg: 300, weightBasis: 'ESTIMATED', unitPrice: 9_000_000, lineAmount: 9_000_000, data: {} },
      ],
    })
    expect(mapped.pricing).toBe(pricing)
    expect(mapped.draft?.pricing).toBe(pricing)
    expect(mapped.draft?.cows).toMatchObject([
      { pricing, weight: 250, weightBasis: 'MEASURED', estimated: false, unitPrice: 8_500_000 },
      { pricing, weight: 300, weightBasis: 'ESTIMATED', estimated: true, unitPrice: 9_000_000 },
    ])
  })

  it('reads weight/basis from legacy draft data and leaves absent weights without a basis', () => {
    const mapped = mapVoucher({ entryType: 'PURCHASE', status: 'DRAFT', pricingBasis: 'PER_HEAD', lines: [
      { data: { entryWeightKg: 300, weightBasis: 'ESTIMATED' } },
      { entryWeightKg: null, weightBasis: null, data: {} },
      { entryWeightKg: 0, weightBasis: 'MEASURED', data: {} },
    ] })
    expect(mapped.draft?.cows).toMatchObject([
      { weight: 300, weightBasis: 'ESTIMATED', pricing: 'con' },
      { weight: 0, weightBasis: null, pricing: 'con' },
      { weight: 0, weightBasis: null, pricing: 'con' },
    ])
  })

  it.each([
    ['con', 'kg', 'con'], ['kg', 'con', 'kg'], [undefined, 'con', 'con'], [undefined, 'kg', 'kg'],
  ] as const)('initializes the editor from draft %s before legacy cow pricing %s', (draftPricing, cowPricing, expected) => {
    const { result } = renderHook(() => useEntryEditor({
      draft: { pricing: draftPricing, cows: [{ ...cow, pricing: cowPricing }] },
      defaults: { recordId: 'PN-TEST', date: '2026-10-29', quarantine: '', receiver: 'An', note: '', cows: [], freight: 0, paid: 0, method: '', due: '' },
      pendingCalves: [], sellers: [], pens: [], isBuy: true,
    }))
    expect(result.current.pricing).toBe(expected)
    expect(result.current.purchase.cattleAmount).toBe(expected === 'con' ? 8_500_000 : 250 * 8_500_000)
    expect(result.current.cows[0]).toMatchObject({ weight: 250, weightBasis: 'MEASURED', unitPrice: 8_500_000 })
  })
})

describe('voucher pricing owns purchase weight validation', () => {
  const input = { date: '2026-10-29', today: '2026-10-29', type: 'Mua ngoài' as const, sourceId: '7', receiver: 'An' }
  it('allows a head-priced cow without weight even when its legacy line pricing says kg', () => {
    expect(validateEntryForPost({ ...input, pricing: 'con', cows: [{ ...cow, pricing: 'kg', weight: 0, weightBasis: null }] })).toBeNull()
  })
  it('rejects a missing kg weight even when a legacy line says per head', () => {
    expect(validateEntryForPost({ ...input, pricing: 'kg', cows: [{ ...cow, pricing: 'con', weight: 0, weightBasis: null }] })).toMatch(/Con #1:.*cân nhập/)
  })
  it.each([0.5, 1501, -5])('rejects the entered per-head weight %s outside 1–1500', (weight) => {
    expect(validateEntryForPost({ ...input, pricing: 'con', cows: [{ ...cow, pricing: 'con', weight }] })).toMatch(/1 đến 1.500 kg/)
  })
  it('requires an explicit basis for an entered per-head weight', () => {
    expect(validateEntryForPost({ ...input, pricing: 'con', cows: [{ ...cow, pricing: 'con', weightBasis: null }] })).toBe('Con #1: vui lòng chọn cơ sở cân.')
  })
})
