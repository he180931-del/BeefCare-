import { describe, expect, it } from 'vitest'
import { formatStamp } from '../../../src/features/platform-support/domain/supportRules'
import { validateCreate } from '../../../src/features/support/domain/ticketRules'
import type { CreateTicketCommand, TicketCategory, TicketScope } from '../../../src/features/support/types'

const ticket = (category: TicketCategory, scope: TicketScope, farmId: number | null): CreateTicketCommand => ({
  category,
  scope,
  farmId,
  subject: 'Cần hỗ trợ',
  description: 'Mô tả yêu cầu hỗ trợ',
})

describe('formatStamp', () => {
  it('converts backend UTC timestamps to Vietnam time', () => {
    expect(formatStamp('2026-11-14T17:43:00Z')).toBe('15/11 00:43')
    expect(formatStamp('2026-11-14T17:43:00Z', true)).toBe('15/11/2026 00:43')
  })

  it('keeps timezone-less local demo timestamps unchanged', () => {
    expect(formatStamp('2026-10-18T09:55:00')).toBe('18/10 09:55')
  })
})

describe('validateCreate category/scope contract (D40)', () => {
  it.each(['PAYMENT', 'FARM_SERVICE'] as const)('%s không được gửi ở phạm vi tài khoản', (category) => {
    expect(validateCreate(ticket(category, 'ACCOUNT', null), [1]).scope).toBe('Danh mục này bắt buộc gắn với trang trại.')
  })

  it('truy cập tài khoản không được gửi ở phạm vi trang trại', () => {
    expect(validateCreate(ticket('ACCOUNT_ACCESS', 'FARM', 1), [1]).scope).toBe('Danh mục này chỉ hỗ trợ ở phạm vi tài khoản.')
  })

  it.each(['SYSTEM_USAGE', 'OTHER'] as const)('%s cho phép cả hai phạm vi', (category) => {
    expect(validateCreate(ticket(category, 'ACCOUNT', null), [1])).toEqual({})
    expect(validateCreate(ticket(category, 'FARM', 1), [1])).toEqual({})
  })
})
