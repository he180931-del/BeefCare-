import { describe, expect, it, vi } from 'vitest'
import { validateEntryForPost, validateEntryPayment } from '../../../src/features/herd-entry/validation/entryFormValidation'

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

  it('allows posting without a manually supplied receiver and with no note', () => {
    const input = { date: '2026-10-22', today: '2026-10-22', type: 'Mua ngoài' as const, sourceId: 'seller-1', cows: [cow], pricing: 'kg' as const, note: '' }
    expect(validateEntryForPost(input)).toBeNull()
  })

  it('rejects a positive advance without a method and a due date before entry day', () => {
    expect(validateEntryPayment({ paid: 1, total: 10, method: '', due: '2026-10-21', date: '2026-10-22' })).toEqual({
      method: 'Vui lòng chọn phương thức thanh toán.',
      due: 'Hạn trả phần nợ không được trước ngày nhập.',
    })
  })
})
