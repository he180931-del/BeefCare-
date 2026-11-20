import { requiredScopeForCategory } from '../domain/ticketRules'
import type { CreateTicketCommand } from '../types'

// ---- Kiểm tra dữ liệu nhập (SRS 20.1.2, MSG-COM-06) ----
export const SUBJECT_MAX = 150
export const DESCRIPTION_MAX = 3000
export const REPLY_MAX = 3000
export const REASON_MAX = 1000

export function validateCreate(cmd: CreateTicketCommand, ownedFarmIds: number[]): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!cmd.category) errors.category = 'Vui lòng chọn danh mục.'
  if (cmd.scope !== 'FARM' && cmd.scope !== 'ACCOUNT') {
    errors.scope = 'Vui lòng chọn phạm vi.'
  } else {
    const requiredScope = requiredScopeForCategory(cmd.category)
    if (requiredScope === 'FARM' && cmd.scope !== 'FARM') errors.scope = 'Danh mục này bắt buộc gắn với trang trại.'
    if (requiredScope === 'ACCOUNT' && cmd.scope !== 'ACCOUNT') errors.scope = 'Danh mục này chỉ hỗ trợ ở phạm vi tài khoản.'
  }
  if (cmd.scope === 'FARM') {
    if (cmd.farmId == null) errors.farmId = 'Vui lòng chọn trang trại liên quan.'
    else if (!ownedFarmIds.includes(cmd.farmId)) errors.farmId = 'Bạn không có quyền với trang trại này.'
  }
  const subject = cmd.subject.trim()
  if (!subject) errors.subject = 'Vui lòng nhập tiêu đề.'
  else if (subject.length > SUBJECT_MAX) errors.subject = 'Tiêu đề tối đa 150 ký tự.'
  const description = cmd.description.trim()
  if (!description) errors.description = 'Vui lòng nhập mô tả.'
  else if (description.length > DESCRIPTION_MAX) errors.description = 'Mô tả tối đa 3.000 ký tự.'
  return errors
}

export function validateReply(content: string): string | null {
  const text = content.trim()
  if (!text) return 'Vui lòng nhập nội dung phản hồi.'
  if (text.length > REPLY_MAX) return 'Phản hồi tối đa 3.000 ký tự.'
  return null
}

export function validateReason(reason: string): string | null {
  const text = reason.trim()
  if (!text) return 'Vui lòng nhập lý do mở lại.'
  if (text.length > REASON_MAX) return 'Lý do tối đa 1.000 ký tự.'
  return null
}
