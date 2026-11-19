import { describe, expect, it } from 'vitest'
import {
  allowedAuditDetails, auditToCsv, availableOperations, formatNoticeTime, initials, validateAuditRange, validateReason,
} from '../../../src/features/platform-admin/domain/platformRules'
import type { AccountSummary, AuditEntry } from '../../../src/features/platform-admin/types'

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
    const base = { platformRole: null, platformAccessStatus: null } as AccountSummary
    expect(availableOperations(base)).toEqual(['GRANT'])
    expect(availableOperations({ ...base, platformRole: 'CS', platformAccessStatus: 'ACTIVE' })).toEqual(['CHANGE', 'REVOKE'])
    expect(availableOperations({ ...base, platformRole: 'CS', platformAccessStatus: 'REVOKED' })).toEqual(['RESTORE'])
    expect(initials('Nguyễn Văn Hùng')).toBe('NH')
    expect(initials('Đỗ Minh Quân')).toBe('ĐQ')
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
