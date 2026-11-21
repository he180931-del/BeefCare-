import { describe, expect, it } from 'vitest'
import { localView } from '../../../src/features/herd-entry/data/entryLocalAdapter'

describe('local herd entry list parity', () => {
  it('applies the selected seller filter using the same source identity as backend mode', async () => {
    const view = await localView({ type: 'PURCHASE', sellerName: 'Chợ bò Tòng Bạt – Ba Vì' })
    expect(view.rows.map((row) => row.id)).toEqual(['PN-2026-0011'])
  })
})
