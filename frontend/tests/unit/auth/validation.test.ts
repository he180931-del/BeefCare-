import { describe, expect, it } from 'vitest'
import { normalizeEmail, validateRegistration, validateReset, validateSignIn } from '../../../src/features/authentication/validation'

describe('authentication validation', () => {
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
})
