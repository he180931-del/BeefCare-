import { describe, expect, it } from 'vitest'
import { DESCRIPTION_MAX, REASON_MAX, REPLY_MAX, SUBJECT_MAX, validateCreate, validateReason, validateReply } from '../../../src/features/support/validation/ticketValidation'
import type { CreateTicketCommand } from '../../../src/features/support/types'

// Characterization of the SCR-65/66 input rules (SRS 20.1.2, MSG-COM-06) before they move to support/validation.
const command = (patch: Partial<CreateTicketCommand> = {}): CreateTicketCommand => ({
  category: 'SYSTEM_USAGE', scope: 'FARM', farmId: 1, subject: 'Cần hỗ trợ', description: 'Mô tả yêu cầu hỗ trợ', ...patch,
})

describe('support ticket input limits', () => {
  it('keeps the documented maximum lengths', () => {
    expect({ SUBJECT_MAX, DESCRIPTION_MAX, REPLY_MAX, REASON_MAX }).toEqual({ SUBJECT_MAX: 150, DESCRIPTION_MAX: 3000, REPLY_MAX: 3000, REASON_MAX: 1000 })
  })
})

describe('validateCreate fields', () => {
  it('accepts a complete farm ticket for an owned farm', () => {
    expect(validateCreate(command(), [1])).toEqual({})
  })

  it('requires category, subject and description, measured after trimming', () => {
    expect(validateCreate(command({ category: '', subject: '   ', description: '\n' }), [1])).toEqual({
      category: 'Vui lòng chọn danh mục.', subject: 'Vui lòng nhập tiêu đề.', description: 'Vui lòng nhập mô tả.',
    })
  })

  it('limits subject to 150 and description to 3,000 characters', () => {
    expect(validateCreate(command({ subject: ` ${'a'.repeat(150)} `, description: 'b'.repeat(3000) }), [1])).toEqual({})
    expect(validateCreate(command({ subject: 'a'.repeat(151), description: 'b'.repeat(3001) }), [1])).toEqual({
      subject: 'Tiêu đề tối đa 150 ký tự.', description: 'Mô tả tối đa 3.000 ký tự.',
    })
  })

  it('TC-20-04: reports both errors for a 151-character subject and blank description', () => {
    expect(validateCreate(command({ subject: 's'.repeat(151), description: '  ' }), [1])).toMatchObject({
      subject: 'Tiêu đề tối đa 150 ký tự.',
      description: 'Vui lòng nhập mô tả.',
    })
  })

  it('requires the active farm for every new ticket', () => {
    expect(validateCreate(command({ farmId: null }), [1]).farmId).toBe('Hãy mở một trang trại trước khi gửi yêu cầu.')
    expect(validateCreate(command({ farmId: 2 }), [1]).farmId).toBe('Bạn không có quyền với trang trại đang mở.')
    expect(validateCreate(command({ scope: 'ACCOUNT', farmId: null }), [1]).scope).toBe('Ticket phải gắn với trại đang mở.')
  })

  it('rejects every scope other than the active farm', () => {
    expect(validateCreate(command({ scope: '' as CreateTicketCommand['scope'] }), [1]).scope).toBe('Ticket phải gắn với trại đang mở.')
  })
})

describe('validateReply and validateReason', () => {
  it('requires a reply of at most 3,000 characters after trimming', () => {
    expect(validateReply('')).toBe('Vui lòng nhập nội dung phản hồi.')
    expect(validateReply('   ')).toBe('Vui lòng nhập nội dung phản hồi.')
    expect(validateReply(` ${'a'.repeat(3000)} `)).toBeNull()
    expect(validateReply('a'.repeat(3001))).toBe('Phản hồi tối đa 3.000 ký tự.')
  })

  it('requires a reopen reason of at most 1,000 characters after trimming', () => {
    expect(validateReason('')).toBe('Vui lòng nhập lý do mở lại.')
    expect(validateReason(' \t ')).toBe('Vui lòng nhập lý do mở lại.')
    expect(validateReason('a'.repeat(1000))).toBeNull()
    expect(validateReason('a'.repeat(1001))).toBe('Lý do tối đa 1.000 ký tự.')
  })
})
