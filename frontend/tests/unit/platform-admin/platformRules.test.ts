import { describe, expect, it } from 'vitest'
import {
  allowedAuditDetails, auditToCsv, availableOperations, compareAccounts, farmsJoinedText, formatNoticeTime, formatPlatformDate,
  formatPlatformDateTime, initials, platformRoleText, revokedRoleNote, validateAuditRange, validateReason, verificationText,
} from '../../../src/features/platform-admin/domain/platformRules'
import type { AccountListItem, AuditEntry } from '../../../src/features/platform-admin/types'

describe('platformRules', () => {
  it('lý do bắt buộc và tối đa 500 ký tự', () => {
    expect(validateReason('   ')).toBe('Lý do là bắt buộc.')
    expect(validateReason('a'.repeat(501))).toMatch(/500/)
    expect(validateReason('Hợp lệ')).toBeNull()
  })

  it('khoảng thời gian audit bắt buộc, không đảo ngược và tối đa 12 tháng', () => {
    expect(validateAuditRange({ from: '', to: '2026-10-18' })).toBe('Thời gian là bắt buộc.')
    expect(validateAuditRange({ from: '2026-10-18', to: '2026-10-11' })).toMatch(/sau hoặc bằng/)
    expect(validateAuditRange({ from: '2025-10-17', to: '2026-10-18' })).toMatch(/12 tháng/)
    expect(validateAuditRange({ from: '2025-10-18', to: '2026-10-18' })).toBeNull()
  })

  it('chi tiết audit chỉ giữ khóa cho phép', () => {
    const out = allowedAuditDetails({ before: 'role: —', after: 'role: CS', correlationId: 'req-1', ticketBody: 'bí mật', scope: 5 })
    expect(out).toEqual({ before: 'role: —', after: 'role: CS', correlationId: 'req-1', scope: '' })
  })

  it('hành động cấp quyền theo trạng thái và chữ viết tắt', () => {
    const base = { platformRole: null, platformAccessStatus: null } as AccountListItem
    expect(availableOperations(base)).toEqual(['GRANT'])
    expect(availableOperations({ ...base, platformRole: 'CS', platformAccessStatus: 'ACTIVE' })).toEqual(['CHANGE', 'REVOKE'])
    expect(availableOperations({ ...base, platformRole: 'CS', platformAccessStatus: 'REVOKED' })).toEqual(['RESTORE'])
    expect(initials('Nguyễn Văn Hùng')).toBe('NH')
    expect(initials('Đỗ Minh Quân')).toBe('ĐQ')
  })

  it('SCR-16 (D31): vai trò ACTIVE, trại tham gia, xác minh, thứ tự tên và giờ Asia/Ho_Chi_Minh', () => {
    const row = (patch: Partial<AccountListItem>): AccountListItem => ({
      id: 1, email: 'a@x.vn', fullName: 'An', accountStatus: 'ACTIVE', platformRole: null, platformAccessStatus: null,
      emailVerified: true, farmCount: 0, farmRoles: [], ...patch,
    })
    expect(platformRoleText(row({ platformRole: 'PM', platformAccessStatus: 'ACTIVE' }))).toBe('PM')
    expect(platformRoleText(row({ platformRole: 'CS', platformAccessStatus: 'REVOKED' }))).toBe('Không có')
    expect(revokedRoleNote(row({ platformRole: 'CS', platformAccessStatus: 'REVOKED' }))).toBe('CS đã thu hồi')
    expect(revokedRoleNote(row({}))).toBeNull()
    expect(farmsJoinedText(row({}))).toBe('0')
    expect(farmsJoinedText(row({ farmCount: 3, farmRoles: ['OWNER', 'MANAGER'] }))).toBe('3 (Chủ trại, Quản lý)')
    expect(verificationText({ emailVerified: false, signInMethods: ['PASSWORD'] })).toBe('Chưa xác minh')
    expect(verificationText({ emailVerified: true, signInMethods: ['PASSWORD', 'GOOGLE'] })).toBe('Đã xác minh (Google)')
    expect(verificationText({ emailVerified: true, signInMethods: ['PASSWORD'] })).toBe('Đã xác minh (email)')
    // a < ă < â, d < đ; hoa thường không đổi thứ tự; chưa có tên thì theo email; trùng thì theo email rồi id.
    const names = ['Đức', 'dũng', 'Ân', 'ăn', 'Ánh', 'an', ' ']
    const sorted = names.map((fullName, i) => row({ id: i + 1, fullName, email: fullName.trim() ? `u${i}@x.vn` : 'aaa@x.vn' })).sort(compareAccounts)
    expect(sorted.map((a) => a.fullName)).toEqual([' ', 'an', 'Ánh', 'ăn', 'Ân', 'dũng', 'Đức'])
    expect([row({ id: 2, email: 'b@x.vn' }), row({ id: 1, email: 'b@x.vn' }), row({ id: 3, email: 'a@x.vn' })].sort(compareAccounts).map((a) => a.id)).toEqual([3, 1, 2])
    expect(formatPlatformDateTime('2026-10-17T17:30:00Z')).toBe('18/10/2026 00:30')
    expect(formatPlatformDate('2026-10-17T17:30:00Z')).toBe('18/10/2026')
  })

  it('thời gian thông báo tương đối', () => {
    const now = new Date('2026-10-18T09:30:00')
    expect(formatNoticeTime('2026-10-18T09:28:00', now)).toBe('2 phút trước')
    expect(formatNoticeTime('2026-10-18T07:58:00', now)).toBe('07:58')
    expect(formatNoticeTime('2026-10-17T16:20:00', now)).toBe('Hôm qua')
    expect(formatNoticeTime('2026-10-10T09:00:00', now)).toBe('10/10/2026')
  })

  it('CSV thoát dấu phẩy và ngoặc kép', () => {
    const entry = { loggedAt: '2026-10-18T08:02:00', actorName: 'Vũ "Nam", SA', actorRole: 'SA', action: 'ACCOUNT_SUSPENDED', targetType: 'ACCOUNT', targetLabel: 'Hồ Văn Tài' } as AuditEntry
    const [head, row] = auditToCsv([entry]).split('\r\n')
    expect(head.split(',')[0]).toBe('Thời điểm')
    expect(row).toContain('"Vũ ""Nam"", SA"')
  })
})
