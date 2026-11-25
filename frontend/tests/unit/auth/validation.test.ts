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
