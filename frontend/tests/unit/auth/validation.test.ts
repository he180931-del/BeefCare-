import { describe, expect, it } from 'vitest'
import { normalizeEmail, validateRegistration, validateReset, validateSignIn } from '../../../src/features/authentication/validation/authValidation'

describe('authentication validation', () => {
  const validPolicyPasswords = [
    ['lowercase-only', 'abcdefgh'],
    ['digit-only', '12345678'],
    ['symbol-only', '!!!!!!!!'],
    ['eight-unicode-code-points', '😀'.repeat(8)],
    ['128-unicode-code-points', '😀'.repeat(128)],
  ] as const

  const invalidLengthPasswords = [
    ['seven-unicode-code-points', '😀'.repeat(7)],
    ['129-unicode-code-points', '😀'.repeat(129)],
  ] as const

  it('normalizes email case and whitespace before sending', () => {
    expect(normalizeEmail(' Owner@BeefCare.vn ')).toBe('owner@beefcare.vn')
  })

  it('validates sign-in required fields and email format', () => {
    expect(validateSignIn({ email: '', password: '' })).toMatchObject({ email: expect.any(String), password: expect.any(String) })
    expect(validateSignIn({ email: 'not-an-email', password: 'secret' })).toMatchObject({ email: expect.any(String) })
    expect(validateSignIn({ email: 'owner@beefcare.vn', password: 'secret' })).toEqual({})
  })

  it('enforces registration name, password, confirmation and terms rules', () => {
    const invalid = validateRegistration({ fullName: 'A', email: 'bad', password: 'short', confirmPassword: 'mismatch', termsAccepted: false })
    expect(invalid).toHaveProperty('fullName')
    expect(invalid).toHaveProperty('email')
    expect(invalid).toHaveProperty('password')
    expect(invalid).toHaveProperty('confirmPassword')
    expect(invalid).toHaveProperty('termsAccepted')

    expect(validateRegistration({ fullName: 'Nguyen Van An', email: 'AN@BEEFCARE.VN', password: 'BeefCare123!', confirmPassword: 'BeefCare123!', termsAccepted: true })).toEqual({})
  })

  const registration = (patch: Partial<Parameters<typeof validateRegistration>[0]> = {}) => ({
    fullName: 'Nguyễn Văn An', email: 'an@example.vn', password: 'UniquePass123!', confirmPassword: 'UniquePass123!', termsAccepted: true, ...patch,
  })

  it('TC-01-01: accepts full names of 2–100 characters and rejects 1/101', () => {
    expect(validateRegistration(registration({ fullName: 'A' })).fullName).toBe('Họ và tên cần từ 2 đến 100 ký tự.')
    expect(validateRegistration(registration({ fullName: 'An' }))).not.toHaveProperty('fullName')
    expect(validateRegistration(registration({ fullName: 'x'.repeat(100) }))).not.toHaveProperty('fullName')
    expect(validateRegistration(registration({ fullName: 'x'.repeat(101) })).fullName).toBe('Họ và tên cần từ 2 đến 100 ký tự.')
  })

  it('TC-01-02: reports the required-name message for whitespace-only registration name', () => {
    expect(validateRegistration(registration({ fullName: '   ' })).fullName).toBe('Vui lòng nhập họ và tên.')
  })

  it('TC-01-03: rejects malformed and 255-character registration emails', () => {
    for (const email of ['abc', 'a@b', `${'a'.repeat(243)}@example.com`]) {
      expect(email.length === 255 || !/^\S+@\S+\.\S+$/.test(email)).toBe(true)
      expect(validateRegistration(registration({ email })).email).toBe('Email không hợp lệ.')
    }
  })

  it('TC-01-04: enforces registration password boundaries 7/8/128/129', () => {
    for (const length of [7, 8, 128, 129]) {
      const password = `P${'x'.repeat(length - 1)}`
      const errors = validateRegistration(registration({ password, confirmPassword: password }))
      expect(errors.password).toBe(length === 7 || length === 129 ? 'Mật khẩu cần từ 8 đến 128 ký tự.' : undefined)
    }
  })

  it('TC-01-05: registration rejects a password matching email ignoring case', () => {
    expect(validateRegistration(registration({ email: 'Owner@Farm.VN', password: 'owner@farm.vn', confirmPassword: 'owner@farm.vn' })).password)
      .toBe('Mật khẩu không được trùng với email.')
  })

  it('TC-01-06: registration reports the confirmation mismatch message', () => {
    expect(validateRegistration(registration({ confirmPassword: 'DifferentPass1!' })).confirmPassword).toBe('Mật khẩu xác nhận chưa khớp.')
  })

  it('TC-01-07: registration requires accepting terms', () => {
    expect(validateRegistration(registration({ termsAccepted: false })).termsAccepted)
      .toBe('Vui lòng đồng ý với Điều khoản sử dụng và Chính sách dữ liệu.')
  })

  it('rejects using the account email as its password and mismatched reset confirmation', () => {
    expect(validateReset({ email: 'owner@beefcare.vn', password: 'OWNER@BEEFCARE.VN', confirmPassword: 'OWNER@BEEFCARE.VN' })).toHaveProperty('password')
    expect(validateReset({ email: '', password: 'BeefCare123!', confirmPassword: 'different' })).toHaveProperty('confirmPassword')
  })

  it.each(validPolicyPasswords)('accepts %s passwords for registration and reset', (_label, password) => {
    expect(validateRegistration({ fullName: 'Nguyen Van An', email: 'owner@beefcare.vn', password, confirmPassword: password, termsAccepted: true })).not.toHaveProperty('password')
    expect(validateReset({ email: 'owner@beefcare.vn', password, confirmPassword: password })).not.toHaveProperty('password')
  })

  it.each(invalidLengthPasswords)('rejects %s passwords for registration and reset', (_label, password) => {
    expect(validateRegistration({ fullName: 'Nguyen Van An', email: 'owner@beefcare.vn', password, confirmPassword: password, termsAccepted: true })).toHaveProperty('password')
    expect(validateReset({ email: 'owner@beefcare.vn', password, confirmPassword: password })).toHaveProperty('password')
  })

  it('applies email equality case-insensitively and keeps sign-in to required/max-128 rules', () => {
    expect(validateRegistration({ fullName: 'Nguyen Van An', email: 'Owner@BeefCare.vn', password: 'owner@beefcare.vn', confirmPassword: 'owner@beefcare.vn', termsAccepted: true })).toHaveProperty('password')
    expect(validateReset({ email: 'Owner@BeefCare.vn', password: 'owner@beefcare.vn', confirmPassword: 'owner@beefcare.vn' })).toHaveProperty('password')
    expect(validateSignIn({ email: '', password: '' })).toMatchObject({ email: expect.any(String), password: expect.any(String) })
    expect(validateSignIn({ email: 'owner@beefcare.vn', password: 'a'.repeat(128) })).toEqual({})
    expect(validateSignIn({ email: 'owner@beefcare.vn', password: 'a'.repeat(129) })).toHaveProperty('password')
  })
})
