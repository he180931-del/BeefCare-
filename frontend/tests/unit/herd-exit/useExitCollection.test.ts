import { describe, expect, it } from 'vitest'
import { isValidCollectionAmount } from '../../../src/features/herd-exit/hooks/useExitCollection'

describe('isValidCollectionAmount', () => {
  it('allows positive collection up to the outstanding balance', () => {
    expect(isValidCollectionAmount(1, 100)).toBe(true)
    expect(isValidCollectionAmount(100, 100)).toBe(true)
  })

  it('rejects zero, negative, and over-balance amounts', () => {
    expect(isValidCollectionAmount(0, 100)).toBe(false)
    expect(isValidCollectionAmount(-1, 100)).toBe(false)
    expect(isValidCollectionAmount(101, 100)).toBe(false)
  })
})
