import { userFacingError } from '../../../shared/api/userFacingError'

export function financeError(error: unknown, fallback: string): string {
  const value = typeof error === 'object' && error !== null ? error as { code?: unknown; params?: Record<string, unknown> } : {}
  const p = value.params ?? {}
  switch (value.code) {
    case 'MSG-FE21-08': return 'Giao dịch ngân hàng này đã được ghi nhận ở một khoản khác. Hãy chọn chứng từ khác.'
    case 'MSG-FE21-09': return 'Số tiền phải là số nguyên VND lớn hơn 0.'
    case 'MSG-FE21-10': return `Danh mục ${p.category ?? ''} không dùng được cho ${p.type === 'INCOME' ? 'Thu' : 'Chi'}.`
    case 'MSG-FE21-12': return 'Kết quả báo cáo đã hết hạn. Hãy chạy lại báo cáo.'
    default: return userFacingError(error, fallback)
  }
}
