import { userFacingError } from '../../../shared/api/userFacingError'

export function herdEntryError(error: unknown, fallback: string): string {
  const value = typeof error === 'object' && error !== null ? error as { code?: unknown; params?: Record<string, unknown> } : {}
  const p = value.params ?? {}
  switch (value.code) {
    case 'MSG-FE06-03': return 'Ngày nhập không được ở tương lai hoặc trước ngày sinh.'
    case 'MSG-FE06-13': return `Số tiền thanh toán không được vượt quá ${p.amount ?? 0} đ.`
    default: return userFacingError(error, fallback)
  }
}
