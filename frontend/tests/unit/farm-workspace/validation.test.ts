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

  describe('SCR-10 Register Farm (UC-FE02-01)', () => {
    const farm = { name: 'Trại bò A', province: 'Phú Thọ', commune: 'Xã Minh Đài' }

    it('TC-02-01 accepts a farm name of 2 to 150 characters', () => {
      expect(validateFarmRegistration({ ...farm, name: 'A' })).toHaveProperty('name')
      expect(validateFarmRegistration({ ...farm, name: 'AB' })).toEqual({})
      expect(validateFarmRegistration({ ...farm, name: 'x'.repeat(150) })).toEqual({})
      expect(validateFarmRegistration({ ...farm, name: 'x'.repeat(151) })).toHaveProperty('name')
    })

    it('TC-02-02 requires the province and the commune', () => {
      expect(validateFarmRegistration({ ...farm, province: '' })).toHaveProperty('province')
      expect(validateFarmRegistration({ ...farm, commune: '  ' })).toHaveProperty('commune')
    })

    it('TC-02-03 caps the commune, detailed address, contact person and certificate', () => {
      expect(validateFarmRegistration({ ...farm, commune: 'x'.repeat(151), detailedAddress: 'x'.repeat(256), contactPerson: 'x'.repeat(101), registrationCertificateInfo: 'x'.repeat(256) }))
        .toEqual({ commune: expect.any(String), detailedAddress: expect.any(String), contactPerson: expect.any(String), registrationCertificateInfo: expect.any(String) })
      expect(validateFarmRegistration({ ...farm, commune: 'x'.repeat(150), detailedAddress: 'x'.repeat(255), contactPerson: 'x'.repeat(100), registrationCertificateInfo: 'x'.repeat(255) })).toEqual({})
    })

    it('TC-02-04 accepts 0 or +84 followed by 9 digits as the contact phone', () => {
      expect(validateFarmRegistration({ ...farm, contactPhone: '0912345678' })).toEqual({})
      expect(validateFarmRegistration({ ...farm, contactPhone: '+84912345678' })).toEqual({})
      expect(validateFarmRegistration({ ...farm, contactPhone: '0912 345 678' })).toEqual({})
      expect(validateFarmRegistration({ ...farm, contactPhone: '' })).toEqual({})
      expect(validateFarmRegistration({ ...farm, contactPhone: '12345' })).toHaveProperty('contactPhone')
      expect(validateFarmRegistration({ ...farm, contactPhone: '09123456789' })).toHaveProperty('contactPhone')
    })

    it('keeps the expected herd size optional but limited to the four ranges', () => {
      expect(validateFarmRegistration({ ...farm })).toEqual({})
      expect(validateFarmRegistration({ ...farm, expectedHerdSize: '' })).toEqual({})
      expect(validateFarmRegistration({ ...farm, expectedHerdSize: 'OVER_300' })).toEqual({})
      expect(validateFarmRegistration({ ...farm, expectedHerdSize: 'UNKNOWN' })).toHaveProperty('expectedHerdSize')
    })

    it('only accepts a province from the list of 34 provinces and centrally-run cities', () => {
      expect(validateFarmRegistration({ ...farm, province: 'Hà Tây' })).toHaveProperty('province')
      expect(validateFarmRegistration({ ...farm, province: 'TP. Hồ Chí Minh' })).toEqual({})
    })
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

  describe('SCR-11 Farm Information (UC-FE02-03)', () => {
    const info = { name: 'Trại bò A', province: 'Hà Nội', commune: 'Ba Vì', timeZone: 'Asia/Ho_Chi_Minh', morningShiftStart: '05:30', operatingNotes: '' }

    it('accepts a valid form, with every optional field left blank', () => {
      expect(validateFarmInfo(info)).toEqual({})
      expect(validateFarmInfo({ ...info, morningShiftStart: '', contactPhone: '', contactPerson: '' })).toEqual({})
    })

    it('TC-02-18 rejects notes over 1,000 characters and a morning shift start of 25:00', () => {
      expect(validateFarmInfo({ ...info, operatingNotes: 'x'.repeat(1000) })).toEqual({})
      expect(validateFarmInfo({ ...info, operatingNotes: 'x'.repeat(1001) })).toHaveProperty('operatingNotes')
      expect(validateFarmInfo({ ...info, morningShiftStart: '25:00' })).toHaveProperty('morningShiftStart')
    })

    it('Q3 the province must be one of the 34 provinces, as on SCR-10', () => {
      expect(validateFarmInfo({ ...info, province: 'Hà Tây' })).toEqual({ province: 'Chọn tỉnh hoặc thành phố trong danh sách.' })
      expect(validateFarmInfo({ ...info, province: ' Phú Thọ ' })).toEqual({})
    })

    it('Q2 the time zone must be one of the offered UTC+7 zones', () => {
      expect(validateFarmInfo({ ...info, timeZone: 'Asia/Bangkok' })).toEqual({})
      expect(validateFarmInfo({ ...info, timeZone: 'Europe/London' })).toEqual({ timeZone: 'Chọn múi giờ trong danh sách.' })
    })
  })
})
