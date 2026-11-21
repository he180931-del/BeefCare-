import { userFacingError } from '../../../shared/api/userFacingError'

export function reproductionError(error: unknown, fallback: string): string {
  const value = typeof error === 'object' && error !== null ? error as { code?: unknown; params?: Record<string, unknown> } : {}
  if (value.code === 'MSG-FE12-08') return 'Mã thẻ này đã được dùng cho một thẻ khác. Hãy nhập mã khác hoặc để hệ thống tạo mã.'
  return userFacingError(error, fallback)
}
