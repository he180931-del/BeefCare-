import { describe, expect, it } from 'vitest'
import { validateText } from '../../../src/features/farm-announcements/domain/announcementRules'

describe('announcement text validation', () => {
  it('TC-07-01: distinguishes required title/body from their length limits', () => {
    expect(validateText({ title: '' }).title).toBe('Tiêu đề là bắt buộc.')
    expect(validateText({ title: 'x'.repeat(151) }).title).toBe('Tiêu đề tối đa 150 ký tự.')
    expect(validateText({ body: '' }).body).toBe('Nội dung là bắt buộc.')
    expect(validateText({ body: 'x'.repeat(5001) }).body).toBe('Nội dung tối đa 5.000 ký tự.')
    expect(validateText({ title: 'x'.repeat(150), body: 'x'.repeat(5000) })).toEqual({})
  })

  it('TC-07-10: requires a correction reason and rejects 501 characters', () => {
    expect(validateText({ reason: '' }).reason).toBe('Lý do đính chính là bắt buộc.')
    expect(validateText({ reason: 'x'.repeat(501) }).reason).toBe('Lý do đính chính tối đa 500 ký tự.')
    expect(validateText({ reason: 'x'.repeat(500) })).toEqual({})
  })
})
