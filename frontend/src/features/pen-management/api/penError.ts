import { userFacingError } from '../../../shared/api/userFacingError'

export function penError(error: unknown, fallback: string): string {
  const value = typeof error === 'object' && error !== null ? error as { code?: unknown; params?: Record<string, unknown> } : {}
  const p = value.params ?? {}
  switch (value.code) {
    case 'MSG-FE04-02': return `Mã chuồng ${p.pen_code ?? ''} đã tồn tại trong trại này.`
    case 'MSG-FE04-03': return `Sức chứa phải là số nguyên tối thiểu ${p.min_capacity ?? 1}.`
    case 'MSG-FE04-05': return `Chuồng ${p.pen_code ?? ''} không đủ chỗ nhận ${p.count ?? ''} con (còn ${p.free ?? 0} chỗ).`
    case 'MSG-FE04-06': return `Chuồng ${p.pen_code ?? ''} chưa phù hợp với tiêu chí: ${p.criteria ?? 'vui lòng kiểm tra lại thông tin'}.`
    case 'MSG-COM-05':
      if (p.cattle_code && p.pen_code && 'actual' in p) {
        return `Thông tin bò ${p.cattle_code} đã thay đổi. Chuồng hiện tại: ${p.pen_code}. Hãy tải lại dữ liệu trước khi xác nhận.`
      }
      return 'Dữ liệu đã thay đổi. Vui lòng tải lại trang rồi thử lại.'
    default: return userFacingError(error, fallback)
  }
}
