import { BackendError } from '../../../shared/api/backendClient'
import { userFacingError } from '../../../shared/api/userFacingError'

export function exitVoidError(error: unknown): string {
  if (!(error instanceof BackendError) || !['MSG-FE13-09', 'MSG-FE04-06', 'MSG-COM-06'].includes(error.code ?? '')) return userFacingError(error)
  const message = error.message.trim()
  if (message && !/^HTTP\s*\d+$/i.test(message)) return message
  const params = error.params
  if (error.code === 'MSG-FE13-09') return `Chuồng ${params.pen ?? 'đã chọn'} không khả dụng hoặc không đủ chỗ. Hãy chọn chuồng cho từng con trước khi hủy.`
  if (error.code === 'MSG-FE04-06') return `${params.cattle_code ?? 'Bò'} không đạt tiêu chí nhận bò của ${params.pen_code ?? 'chuồng đã chọn'}: ${params.criteria ?? 'tiêu chí nhận'}. Nhập lý do để tiếp tục.`
  return `Vui lòng nhập ${params.field ?? 'đầy đủ thông tin bắt buộc'}.`
}
