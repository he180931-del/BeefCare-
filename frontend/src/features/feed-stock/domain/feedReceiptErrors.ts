import { BackendError } from '../../../api/backendClient'
import { userFacingError } from '../../../api/userFacingError'

type DomainError = { code?: unknown; params?: Record<string, unknown> }

export function feedReceiptError(error: unknown, fallback = 'Không thể hoàn tất phiếu nhập. Vui lòng thử lại.') {
  const body = error instanceof BackendError ? error : typeof error === 'object' && error !== null ? error as DomainError : {}
  const code = String(body.code ?? '')
  const params = body.params ?? {}
  if (code === 'MSG-COM-05') return 'Phiếu đã thay đổi ở nơi khác. Tải lại phiếu rồi thử lại.'
  if (code === 'MSG-COM-15') return 'Ngày thanh toán không được trước ngày nhập.'
  if (code === 'MSG-COM-07') return 'Ngày không được ở tương lai.'
  if (code === 'MSG-FE23-03') return 'Hạn dùng phải sau ngày nhập.'
  if (code === 'MSG-FE23-05') {
    return `Không thể hủy phiếu ${params.receipt_code ?? ''}: tồn ${params.feed ?? 'thức ăn'} (${params.stock ?? 0} kg) nhỏ hơn số lượng đã nhập. Hãy lập phiếu điều chỉnh kho.`
  }
  if (code === 'MSG-FE06-13') return `Số tiền không được vượt quá ${params.amount ?? 0} đ.`
  if (code === 'MSG-COM-10' && params.field === 'file') {
    const reason = String(params.reason ?? '')
    if (reason === 'too_large') return 'Tệp chứng từ vượt quá giới hạn 10 MB.'
    if (reason === 'unsupported_type' || reason === 'content_type_mismatch') return 'Chứng từ phải là tệp PDF hoặc JPG hợp lệ.'
  }
  return userFacingError(error, fallback)
}
