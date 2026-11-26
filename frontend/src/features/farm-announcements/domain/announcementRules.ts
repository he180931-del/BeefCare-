import type { AnnouncementRole, AudienceSelection, Member } from '../types'
import { validateText } from '../validation/announcementValidation'

export type AnnouncementErrorCode = 'FORBIDDEN' | 'CONFLICT' | 'NOT_ALLOWED' | 'NO_RECIPIENT' | 'VALIDATION' | 'NOT_FOUND'

export class AnnouncementError extends Error {
  constructor(readonly code: AnnouncementErrorCode, message: string, readonly field?: 'title' | 'body' | 'reason' | 'audience') {
    super(message)
  }
}

export const MESSAGES = {
  forbidden: 'Bạn không có quyền thực hiện thao tác này.', // MSG-COM-01
  conflict: 'Bản ghi đã thay đổi. Hãy tải lại và kiểm tra trước khi thử lại.', // MSG-COM-05
  notAllowed: 'Một số người nhận không được phép với vai trò của bạn. Chủ trại: Quản lý và Kỹ thuật viên; Quản lý: chỉ Kỹ thuật viên.', // MSG-FE07-02
  noRecipient: 'Không có người nhận hợp lệ. Hãy chọn ít nhất một thành viên đang hoạt động.', // MSG-FE07-05
  notFound: 'Không tìm thấy thông báo.',
  draftSaved: 'Đã lưu bản nháp thông báo.', // MSG-FE07-01
  published: (count: number) => `Đã đăng thông báo tới ${count} người nhận.`, // MSG-FE07-03
  corrected: (version: number) => `Đã đăng phiên bản ${version} của thông báo.`, // MSG-FE07-04
} as const

/** GBR-60: Chủ trại gửi Quản lý và Kỹ thuật viên; Quản lý chỉ gửi Kỹ thuật viên. */
export const allowedRecipientRoles = (role: AnnouncementRole): AnnouncementRole[] =>
  role === 'OWNER' ? ['MANAGER', 'TECHNICIAN'] : role === 'MANAGER' ? ['TECHNICIAN'] : []

export const canWrite = (role: AnnouncementRole) => role === 'OWNER' || role === 'MANAGER'

export const EMPTY_AUDIENCE: AudienceSelection = { allManagers: false, allTechnicians: false, memberIds: [] }

/** Giải các lựa chọn thành người nhận đang hoạt động, bỏ trùng và người gửi. `invalid`: có lựa chọn không hợp lệ với vai trò. */
export function resolveRecipients(members: Member[], audience: AudienceSelection, author: Member) {
  const allowed = allowedRecipientRoles(author.role)
  let invalid = false
  const picked = new Map<number, Member>()
  const add = (m: Member) => { if (m.active && m.id !== author.id) picked.set(m.id, m) }
  if (audience.allManagers) allowed.includes('MANAGER') ? members.filter((m) => m.role === 'MANAGER').forEach(add) : (invalid = true)
  if (audience.allTechnicians) allowed.includes('TECHNICIAN') ? members.filter((m) => m.role === 'TECHNICIAN').forEach(add) : (invalid = true)
  for (const id of audience.memberIds) {
    const m = members.find((x) => x.id === id)
    if (!m || !m.active || !allowed.includes(m.role)) invalid = true
    else add(m)
  }
  return { recipients: [...picked.values()], invalid }
}

export const audienceLabel = (a: AudienceSelection) => {
  const parts = [a.allManagers && 'Tất cả Quản lý', a.allTechnicians && 'Tất cả Kỹ thuật viên', a.memberIds.length > 0 && 'Chọn từng người']
  return parts.filter(Boolean).join(', ') || 'Chưa chọn'
}

export function assertText(values: Partial<Record<'title' | 'body' | 'reason', string>>) {
  const errors = validateText(values)
  const field = (Object.keys(errors) as Array<keyof typeof errors>)[0]
  if (field) throw new AnnouncementError('VALIDATION', errors[field]!, field)
}

/** Compatibility exports for existing feature tests/adapters during the move. */
export { BODY_MAX, REASON_MAX, TITLE_MAX, validateText } from '../validation/announcementValidation'
