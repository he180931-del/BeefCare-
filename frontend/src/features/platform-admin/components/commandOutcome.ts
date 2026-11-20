import { BackendError } from '../../../shared/api/backendClient'
import { MSG, PlatformAdminError, accountSuspendedMessage, noChangeMessage } from '../domain/platformRules'
import { errorMessage } from './common'

/**
 * Kết quả lỗi của một lệnh SCR-16 (A12 tạm ngưng / khôi phục, A13 quyền nền tảng; D32, D33):
 * - `refused`: lỗi nghiệp vụ, đóng hộp thoại, hiện lý do trên khung chi tiết và tải lại, không tự thử lại bằng version mới;
 * - `field`: lỗi dữ liệu của một trường trong hộp thoại;
 * - `retry`: lỗi lưu / mạng, giữ hộp thoại và cùng Idempotency-Key (GBR-88).
 */
export type CommandOutcome = { kind: 'refused' | 'field' | 'retry'; message: string; field?: string }

const REFUSED_CODES = new Set([
  'MSG-FE03-17', 'MSG-FE03-18', 'MSG-FE03-20', 'MSG-FE03-22', 'MSG-COM-05', 'MSG-COM-08', 'MSG-COM-01', 'MSG-FE01-03',
])
const REFUSED_LOCAL = new Set(['LAST_SA', 'NO_CHANGE', 'STALE', 'NOT_FOUND', 'FORBIDDEN', 'UNVERIFIED', 'SUSPENDED_ACCOUNT'])
const FIELD_MESSAGES: Record<string, Record<string, string>> = {
  'MSG-COM-06': { reason: MSG.reasonRequired, role: 'Chọn vai trò.', operation: 'Chọn hành động.' },
  'MSG-COM-10': { reason: MSG.reasonRule, role: 'Chọn vai trò CS, PM hoặc SA.', operation: 'Hành động không hợp lệ.' },
}

export function commandOutcome(error: unknown, email: string): CommandOutcome {
  if (error instanceof PlatformAdminError) {
    if (error.code === 'VALIDATION') return { kind: 'field', message: error.message }
    return { kind: REFUSED_LOCAL.has(error.code) ? 'refused' : 'retry', message: error.message }
  }
  if (error instanceof BackendError) {
    const code = error.code?.toUpperCase() ?? ''
    const field = typeof error.params.field === 'string' ? error.params.field : ''
    const fieldMessage = FIELD_MESSAGES[code]?.[field]
    if (fieldMessage) return { kind: 'field', message: fieldMessage, field }
    if (REFUSED_CODES.has(code) || error.status === 404) {
      const target = typeof error.params.target === 'string' ? error.params.target : email
      const known: Record<string, string> = {
        'MSG-FE03-17': MSG.lastSa,
        'MSG-FE03-18': MSG.noAccount,
        'MSG-FE03-20': noChangeMessage(target, String(error.params.value ?? 'status')),
        'MSG-FE03-22': accountSuspendedMessage(typeof error.params.email === 'string' ? error.params.email : email),
        'MSG-COM-05': MSG.stale,
        'MSG-COM-08': MSG.gone,
        'MSG-COM-01': MSG.forbidden,
      }
      return { kind: 'refused', message: known[code] ?? (error.status === 404 ? MSG.gone : errorMessage(error)) }
    }
  }
  return { kind: 'retry', message: errorMessage(error) }
}
