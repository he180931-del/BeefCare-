import { describe, expect, it, vi } from 'vitest'
import { validateEntryForPost } from '../../../src/features/herd-entry/validation/entryValidation'

const cow = {
  tag: 'TEST-001', name: '', breed: 'Lai Sind', sex: 'Cái', dob: '', dobAccuracy: 'Không rõ',
  stage: 'Bò tơ', purpose: 'Bò sinh sản', weight: 200, estimated: false, barn: 'A1', unitPrice: 80_000,
  hist: { vaccine: 'Không rõ', disease: 'Không rõ', repro: 'Không rõ' },
}

describe('Entry post required fields', () => {
  it('accepts the farm date immediately after midnight in Vietnam', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(new Date('2026-11-10T17:05:00Z'))
      const input = { type: 'Mua ngoài' as const, sourceId: 'seller-1', receiver: 'Anh A', cows: [cow], pricing: 'kg' as const }
      expect(validateEntryForPost({ ...input, date: '2026-11-11' })).toBeNull()
      expect(validateEntryForPost({ ...input, date: '2026-11-12' })).toBe('Ngày nhập không được ở tương lai.')
    } finally {
      vi.useRealTimers()
    }
  })

  it('requires receiver when posting while notes remain optional', () => {
    const base = { date: '2026-10-22', today: '2026-10-22', type: 'Mua ngoài' as const, sourceId: 'seller-1', cows: [cow], pricing: 'kg' as const }
    expect(validateEntryForPost({ ...base, receiver: '' })).toBe('Vui lòng nhập người thực hiện nhập đàn.')
    expect(validateEntryForPost({ ...base, receiver: 'Anh A' })).toBeNull()
  })

  it('accepts a valid purchase weight without a manually selected weight basis', () => {
    const input = {
      date: '2026-11-01', today: '2026-11-01', type: 'Mua ngoài' as const, sourceId: 'seller-1', receiver: 'Anh A',
      cows: [{ ...cow, weight: 200, weightBasis: null }], pricing: 'kg' as const,
    }
    expect(validateEntryForPost(input)).toBeNull()
  })

  it('TC-06-10: blocks posting the specified kg-priced line when its weight is missing', () => {
    const input = {
      date: '2026-11-01', today: '2026-11-01', type: 'Mua ngoài' as const, sourceId: 'seller-1', receiver: 'Anh A',
      cows: [{ ...cow, weight: undefined as unknown as number, weightBasis: undefined }], pricing: 'kg' as const,
    }
    expect(validateEntryForPost(input)).toBe('Con #1: cân nhập phải từ 1 đến 1.500 kg.')
  })

  it('TC-06-11: rejects paid amount above the spec total through the production post validator', () => {
    const input = {
      date: '2026-11-01', today: '2026-11-01', type: 'Mua ngoài' as const, sourceId: 'seller-1', receiver: 'Anh A',
      cows: [{ ...cow, weight: 300, weightBasis: 'MEASURED' as const, unitPrice: 80_000 }], pricing: 'kg' as const,
      total: 24_500_000, paid: 25_000_000, method: 'CASH',
    }
    expect(validateEntryForPost(input)).toBe('Số tiền đã thanh toán không được vượt quá tổng phải trả.')
  })

  it('TC-06-12: requires payment method when a positive amount was paid', () => {
    const input = {
      date: '2026-11-01', today: '2026-11-01', type: 'Mua ngoài' as const, sourceId: 'seller-1', receiver: 'Anh A',
      cows: [{ ...cow, weight: 300, weightBasis: 'MEASURED' as const, unitPrice: 80_000 }], pricing: 'kg' as const,
      total: 24_500_000, paid: 1_000_000, method: '',
    }
    expect(validateEntryForPost(input)).toBe('Vui lòng chọn phương thức thanh toán.')
  })
})
