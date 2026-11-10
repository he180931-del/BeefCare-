import { describe, expect, it } from 'vitest'
import { reasonText } from '../../../src/features/platform-service/api/platformPaymentReadApi'

describe('UC8 reasons shown in payment reconciliation', () => {
  it('explains conflicting codes and processing exhaustion in Vietnamese', () => {
    expect(reasonText('Conflicting payment references')).toBe('Có nhiều mã thanh toán mâu thuẫn; cần đối soát thủ công')
    expect(reasonText('Automatic processing failed; manual reconciliation required')).toBe('Xử lý tự động lỗi sau thời gian thử lại; cần đối soát thủ công')
  })

  it('keeps a PM explanation verbatim', () => {
    expect(reasonText('PM đã kiểm tra chứng từ gốc')).toBe('PM đã kiểm tra chứng từ gốc')
  })
})
