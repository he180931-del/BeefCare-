import { userFacingError } from '../../../shared/api/userFacingError'

export function cattleError(error: unknown, fallback: string): string {
  const value = typeof error === 'object' && error !== null ? error as { code?: unknown; params?: Record<string, unknown> } : {}
  const p = value.params ?? {}
  switch (value.code) {
    case 'MSG-FE05-02': return `Số tai ${p.ear_tag ?? ''} đã được dùng cho một bò đang nuôi của trại.`
    case 'MSG-FE05-03': return 'Chỉ Chủ trại mới đổi được mục đích sản xuất.'
    case 'MSG-FE05-12': { const type = String(p.purpose_type ?? ''); const kind = type === 'SIRE' ? 'Đực giống' : type === 'BREEDING' ? 'Sinh sản' : type; const sex = type === 'SIRE' ? 'đực' : 'cái'; return `${p.purpose ?? 'Mục đích này'} là mục đích loại ${kind || 'không phù hợp'}, chỉ dùng cho bò ${sex}. Hãy chọn mục đích Vỗ béo, Chưa xác định, hoặc mục đích phù hợp giới tính.` }
    case 'MSG-FE12-08': return `Mã thẻ ${p.tag_code ?? p.code ?? ''} đã được dùng trong trại.`.replace('thẻ  đã', 'thẻ này đã')
    default: return userFacingError(error, fallback)
  }
}
