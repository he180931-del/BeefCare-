import { describe, expect, it } from 'vitest'
import { accessActionsOf, allowedAuditChange, auditActionLabel, auditActorQuery, auditChanges, auditRoleLabel, compareAccounts, defaultAuditRange, farmsJoinedText, formatNoticeTime, formatPlatformDate, formatPlatformDateTime, initials, platformRoleText, revokedRoleNote, validateReason, verificationText } from '../../../src/features/platform-admin/domain/platformRules'
import { validateAuditRange } from '../../../src/features/platform-admin/validation/platformValidation'
import type { AccountListItem, AccountRecord } from '../../../src/features/platform-admin/types'

describe('platformRules', () => {
  it('lý do bắt buộc và tối đa 500 ký tự', () => {
    expect(validateReason('   ')).toBe('Lý do là bắt buộc.')
    expect(validateReason('a'.repeat(501))).toMatch(/500/)
    expect(validateReason(' a b c d ')).toMatch(/từ 5 đến 500/)
    expect(validateReason('Hợp lệ')).toBeNull()
  })

  it('khoảng thời gian audit (R-17-05, D34): MSG-COM-06 / 11 / 10, tối đa 12 tháng như máy chủ, mặc định 7 ngày gồm hôm nay', () => {
    expect(validateAuditRange({ from: '', to: '2026-10-18' })).toBe('Vui lòng nhập Khoảng thời gian.')
    expect(validateAuditRange({ from: '2026-10-18', to: '2026-10-11' })).toBe('Ngày bắt đầu không được sau ngày kết thúc.')
    expect(validateAuditRange({ from: '2025-10-17', to: '2026-10-18' })).toBe('Khoảng thời gian không hợp lệ.')
    expect(validateAuditRange({ from: '2025-10-18', to: '2026-10-18' })).toBeNull()
    expect(validateAuditRange({ from: '2026-10-18', to: '2026-10-18' })).toBeNull()
    // LocalDate.plusMonths: 29/02 + 12 tháng = 28/02
    expect(validateAuditRange({ from: '2028-02-29', to: '2029-02-28' })).toBeNull()
    expect(validateAuditRange({ from: '2028-02-29', to: '2029-03-01' })).toBe('Khoảng thời gian không hợp lệ.')
    expect(defaultAuditRange('2026-10-18')).toEqual({ from: '2026-10-12', to: '2026-10-18' })
  })

  it('ô người thực hiện: "Hệ thống" / "System" là hành động hệ thống, còn lại là tên hoặc email', () => {
    expect(auditActorQuery('  ')).toEqual({})
    expect(auditActorQuery(' Hệ thống ')).toEqual({ system: true })
    expect(auditActorQuery('SYSTEM')).toEqual({ system: true })
    expect(auditActorQuery('nam.vh@')).toEqual({ actor: 'nam.vh@' })
  })

  it('trước / sau chỉ giữ trường cho phép (GBR-86); bên thiếu hiện "—"; nhãn hành động và vai trò', () => {
    expect(allowedAuditChange({ before: {}, after: { role: 'CS', status: 'ACTIVE', ticketBody: 'bí mật', reason: 'lý do' }, ticketBody: 'bí mật' }))
      .toEqual({ before: {}, after: { role: 'CS', status: 'ACTIVE' } })
    expect(auditChanges({}, { role: 'CS', status: 'ACTIVE' })).toEqual([
      { field: 'role', label: 'Vai trò', before: '—', after: 'CS' },
      { field: 'status', label: 'Trạng thái', before: '—', after: 'ACTIVE' },
    ])
    expect(auditChanges({}, { amountVnd: '1200000', periodEnd: '2027-10-28T03:00:00Z' }).map((c) => c.after)).toEqual(['1.200.000 ₫', '28/10/2027 10:00'])
    expect(auditActionLabel('TICKET_CLOSED')).toBe('Đóng yêu cầu hỗ trợ')
    expect(auditActionLabel('NEW_CODE')).toBe('NEW_CODE')
    expect(auditRoleLabel('SA')).toBe('Quản trị hệ thống (SA)')
    expect(auditRoleLabel('OWNER')).toBe('Chủ trại')
    expect(auditRoleLabel(null)).toBe('')
  })

  it('accessActions (D33) theo quyền, tài khoản của chính mình, tạm ngưng, chưa xác minh; chữ viết tắt', () => {
    const base = { id: 5, accountStatus: 'ACTIVE', emailVerified: true, platformRole: null, platformAccessStatus: null } as unknown as AccountRecord
    expect(accessActionsOf(base, 4)).toEqual(['GRANT'])
    expect(accessActionsOf({ ...base, platformRole: 'CS', platformAccessStatus: 'ACTIVE' }, 4)).toEqual(['CHANGE', 'REVOKE'])
    expect(accessActionsOf({ ...base, platformRole: 'CS', platformAccessStatus: 'REVOKED' }, 4)).toEqual(['RESTORE'])
    expect(accessActionsOf({ ...base, platformRole: 'CS', platformAccessStatus: 'ACTIVE' }, 5)).toEqual([])
    expect(accessActionsOf({ ...base, accountStatus: 'SUSPENDED', platformRole: 'CS', platformAccessStatus: 'ACTIVE' }, 4)).toEqual(['REVOKE'])
    expect(accessActionsOf({ ...base, accountStatus: 'SUSPENDED' }, 4)).toEqual([])
    expect(accessActionsOf({ ...base, emailVerified: false, platformRole: 'CS', platformAccessStatus: 'REVOKED' }, 4)).toEqual([])
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
    const now = new Date('2026-10-18T09:30:00+07:00')
    expect(formatNoticeTime('2026-10-18T09:28:00', now)).toBe('2 phút trước')
    expect(formatNoticeTime('2026-10-18T07:58:00', now)).toBe('07:58')
    expect(formatNoticeTime('2026-10-17T16:20:00', now)).toBe('Hôm qua')
    expect(formatNoticeTime('2026-10-10T09:00:00', now)).toBe('10/10/2026')
  })

})
