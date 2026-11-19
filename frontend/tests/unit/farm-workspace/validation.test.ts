import { describe, expect, it } from 'vitest'
import { validateFarmInfo, validateFarmRegistration, validateInvite, validateMemberChange, validateOwnerProfile } from '../../../src/features/farm-workspace/validation'

describe('farm workspace validation', () => {
  it('requires a valid Owner profile and terms acceptance during onboarding', () => {
    expect(validateOwnerProfile({ fullName: 'A', phone: '123', termsAccepted: false })).toMatchObject({ fullName: expect.any(String), phone: expect.any(String), termsAccepted: expect.any(String) })
    expect(validateOwnerProfile({ fullName: 'Nguyễn Văn An', phone: '+84912345678', termsAccepted: true })).toEqual({})
  })

  it('validates farm registration bounds, required location and expected herd size', () => {
    expect(validateFarmRegistration({ name: 'A', province: '', commune: '', expectedHerdSize: 'UNKNOWN', mainBreedCodes: [] })).toMatchObject({ name: expect.any(String), province: expect.any(String), commune: expect.any(String), expectedHerdSize: expect.any(String) })
    expect(validateFarmRegistration({ name: 'Trại bò A', province: 'Phú Thọ', commune: 'Xã Minh Đài', expectedHerdSize: '150_300', mainBreedCodes: ['VANG'] })).toEqual({})
  })

  it('validates invitation email, role and allowed expiry windows', () => {
    expect(validateInvite({ email: 'bad-email', role: 'OWNER', validityDays: 5 })).toMatchObject({ email: expect.any(String), role: expect.any(String), validityDays: expect.any(String) })
    expect(validateInvite({ email: 'manager@beefcare.vn', role: 'MANAGER', validityDays: 7 })).toEqual({})
  })

  it('requires valid member action and prevents future effective dates', () => {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
    expect(validateMemberChange({ action: 'CHANGE_ROLE', role: 'TECHNICIAN', effectiveDate: tomorrow, reason: 'Thay đổi phân công' })).toHaveProperty('effectiveDate')
    expect(validateMemberChange({ action: 'DEACTIVATE', effectiveDate: new Date().toISOString().slice(0, 10), reason: 'Kết thúc hợp đồng' })).toEqual({})
  })

  it('caps farm information notes and validates the contact phone when present', () => {
    expect(validateFarmInfo({ name: 'Trại bò A', province: 'Hà Nội', commune: 'Ba Vì', contactPhone: '0123', operatingNotes: '' })).toHaveProperty('contactPhone')
    expect(validateFarmInfo({ name: 'Trại bò A', province: 'Hà Nội', commune: 'Ba Vì', contactPhone: '0912345678', operatingNotes: 'x'.repeat(1001) })).toHaveProperty('operatingNotes')
  })
})
