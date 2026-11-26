import { describe, expect, it } from 'vitest'
import { compareMembers, memberActions } from '../../../src/features/farm-workspace/domain/members'
import type { Membership } from '../../../src/features/farm-workspace/types'

const member = (id: number, fullName: string, email: string, role: Membership['role'] = 'TECHNICIAN', status: Membership['status'] = 'ACTIVE'): Membership => ({
  id, userId: id, fullName, email, role, status, joinedAt: '2026-01-01T00:00:00Z', version: 1, actions: [],
})

describe('TC-03-59/60: pure SCR-13 member ordering and row-action rules', () => {
  it('sorts Vietnamese names case-insensitively and falls back to email for a blank name', () => {
    const rows = [member(3, 'dũng', 'dung@example.test'), member(2, 'Đỗ', 'do@example.test'), member(1, ' ', 'an@example.test')]
    expect(rows.sort(compareMembers).map((row) => row.email)).toEqual(['an@example.test', 'dung@example.test', 'do@example.test'])
  })

  it('keeps actions within Owner/farm-service rules for active, inactive and Owner rows', () => {
    expect(memberActions({ role: 'MANAGER', status: 'ACTIVE' }, true, true)).toEqual(['CHANGE_ROLE', 'DEACTIVATE'])
    expect(memberActions({ role: 'TECHNICIAN', status: 'INACTIVE' }, true, true)).toEqual(['REACTIVATE'])
    expect(memberActions({ role: 'MANAGER', status: 'ACTIVE' }, true, false)).toEqual(['DEACTIVATE'])
    expect(memberActions({ role: 'TECHNICIAN', status: 'INACTIVE' }, true, false)).toEqual([])
    expect(memberActions({ role: 'OWNER', status: 'ACTIVE' }, true, true)).toEqual([])
    expect(memberActions({ role: 'MANAGER', status: 'ACTIVE' }, false, true)).toEqual([])
  })
})
