import { describe, expect, it } from 'vitest'
import { validateBreed, validateMedicine, validatePurpose, validateVaccine } from '../../../src/features/farm-catalogue/validation/catalogueValidation'
import { validateParameters, validateParameterVersion } from '../../../src/features/farm-catalogue/validation/parameterValidation'

// Characterization (golden master) of the SCR-55/56 catalogue and parameter input rules, recorded on the code before
// they moved out of domain/ (refactor phase 2). The snapshots are the behaviour to keep.
type Breed = Parameters<typeof validateBreed>[0]
type Medicine = Parameters<typeof validateMedicine>[0]
type Purpose = Parameters<typeof validatePurpose>[0]
type Vaccine = Parameters<typeof validateVaccine>[0]
type Values = Parameters<typeof validateParameters>[0]
type Version = Parameters<typeof validateParameterVersion>[0]

const values = (patch: Partial<Values> = {}): Values => ({
  weaningAgeMonths: 6, youngStockAgeMonths: 12, adultAgeMonths: 24, minBreedingAgeMonths: 15, minBreedingWeightKg: 280,
  gestationLengthDays: 283, pregnancyCheckDays: 45, recheckDays: 21, calvingPrepLeadDays: 14, postCalvingIntervalDays: 60,
  windowStartHours: 12, windowEndHours: 18, estrusCycleDays: 21, weighingIntervalDays: 30, vaccinationLeadDays: 7,
  targetFinishingWeightKg: 450, bcsScale: '1-5', ...patch,
} as Values)

describe('catalogue item rules', () => {
  it('breed', () => {
    expect(validateBreed({ code: 'LS', name: 'Lai Sind', group: 'Bò thịt', description: '' } as Breed)).toMatchInlineSnapshot(`{}`)
    expect(validateBreed({ code: 'mã sai!', name: '', group: 'x'.repeat(51), description: 'y'.repeat(501) } as Breed)).toMatchInlineSnapshot(`
      {
        "code": "Mã giống gồm 2–20 ký tự: chữ in hoa, số và "-".",
        "description": "Mô tả tối đa 500 ký tự.",
        "group": "Nhóm tối đa 50 ký tự.",
        "name": "Tên giống là bắt buộc.",
      }
    `)
  })

  it('TC-18-02/03: requires uppercase breed codes from 2 to 20 characters', () => {
    const base = { name: 'Lai Sind', group: 'Bò thịt', description: '' }
    expect(validateBreed({ ...base, code: 'lai-sind' } as Breed).code).toBe('Mã giống gồm 2–20 ký tự: chữ in hoa, số và "-".')
    expect(validateBreed({ ...base, code: 'A' } as Breed).code).toBe('Mã giống gồm 2–20 ký tự: chữ in hoa, số và "-".')
    expect(validateBreed({ ...base, code: 'A'.repeat(21) } as Breed).code).toBe('Mã giống gồm 2–20 ký tự: chữ in hoa, số và "-".')
  })

  it('medicine', () => {
    expect(validateMedicine({ code: 'TH01', name: 'Oxytetracycline', dose: '10 ml', route: 'INTRAMUSCULAR', withdrawalDays: 28, description: '' } as Medicine)).toMatchInlineSnapshot(`{}`)
    expect(validateMedicine({ code: '', name: 'x'.repeat(151), dose: '', route: 'NASAL_SPRAY', withdrawalDays: 366, description: '' } as unknown as Medicine)).toMatchInlineSnapshot(`
      {
        "code": "Mã là bắt buộc.",
        "name": "Tên thuốc tối đa 150 ký tự.",
        "route": "Đường dùng không hợp lệ.",
        "withdrawalDays": "Ngưng sử dụng thịt phải nằm trong khoảng 0 đến 365.",
      }
    `)
  })

  it('purpose', () => {
    expect(validatePurpose({ code: 'VB', name: 'Vỗ béo', purposeType: 'FATTENING', description: '' } as Purpose)).toMatchInlineSnapshot(`{}`)
    expect(validatePurpose({ code: 'VB', name: '  ', purposeType: 'PET', description: '' } as unknown as Purpose)).toMatchInlineSnapshot(`
      {
        "name": "Tên mục đích là bắt buộc.",
        "purposeType": "Loại mục đích là bắt buộc.",
      }
    `)
  })

  it('vaccine', () => {
    expect(validateVaccine({ code: 'LMLM', name: 'Lở mồm long móng', diseasePrevented: 'LMLM', manufacturer: 'Navetco', dose: '2 ml', route: 'SUBCUTANEOUS', boosterInterval: 180, withdrawalDays: 0 } as Vaccine)).toMatchInlineSnapshot(`{}`)
    expect(validateVaccine({ code: 'LMLM', name: '', diseasePrevented: '', manufacturer: '', dose: '', route: 'ORAL_DROP', boosterInterval: 731, withdrawalDays: -1 } as unknown as Vaccine)).toMatchInlineSnapshot(`
      {
        "boosterInterval": "Nhắc lại sau phải nằm trong khoảng 0 đến 730.",
        "diseasePrevented": "Phòng bệnh là bắt buộc.",
        "name": "Tên vắc-xin là bắt buộc.",
        "route": "Đường tiêm không hợp lệ.",
        "withdrawalDays": "Ngưng sử dụng thịt phải nằm trong khoảng 0 đến 365.",
      }
    `)
  })

  it('TC-18-13: rejects a vaccine with booster over 730 days and withdrawal over 365', () => {
    expect(validateVaccine({ code: 'LMLM', name: 'LMLM', diseasePrevented: 'LMLM', manufacturer: 'Navetco', dose: '2 ml', route: 'SUBCUTANEOUS', boosterInterval: 731, withdrawalDays: 366 } as Vaccine))
      .toEqual({ boosterInterval: 'Nhắc lại sau phải nằm trong khoảng 0 đến 730.', withdrawalDays: 'Ngưng sử dụng thịt phải nằm trong khoảng 0 đến 365.' })
  })

  it('TC-18-14: requires a medicine withdrawal period', () => {
    expect(validateMedicine({ code: 'TH01', name: 'Oxytetracycline', dose: '10 ml', route: 'INTRAMUSCULAR', withdrawalDays: undefined, description: '' } as unknown as Medicine))
      .toEqual({ withdrawalDays: 'Ngưng sử dụng thịt là bắt buộc.' })
  })
})

describe('farm parameter rules', () => {
  it('accepts a consistent set and orders the age and time windows', () => {
    expect(validateParameters(values())).toMatchInlineSnapshot(`{}`)
    expect(validateParameters(values({ youngStockAgeMonths: 6, adultAgeMonths: 15, windowStartHours: 18, windowEndHours: 12 }))).toMatchInlineSnapshot(`
      {
        "windowEndHours": "Giờ kết thúc phải lớn hơn giờ bắt đầu.",
        "youngStockAgeMonths": "Tuổi bò tơ phải lớn hơn tuổi cai sữa.",
      }
    `)
    expect(validateParameters(values({ weaningAgeMonths: 2, gestationLengthDays: 301, bcsScale: '1-10' as Values['bcsScale'] }))).toMatchInlineSnapshot(`
      {
        "bcsScale": "Thang BCS là bắt buộc.",
        "gestationLengthDays": "Thời gian mang thai phải nằm trong khoảng 270 đến 300.",
        "weaningAgeMonths": "Tuổi cai sữa phải nằm trong khoảng 3 đến 12.",
      }
    `)
  })

  it('TC-18-18/19/20: checks upper weaning age and strict age/time ordering at the specified values', () => {
    expect(validateParameters(values({ weaningAgeMonths: 13 })).weaningAgeMonths).toBe('Tuổi cai sữa phải nằm trong khoảng 3 đến 12.')
    expect(validateParameters(values({ weaningAgeMonths: 12, youngStockAgeMonths: 12 })).youngStockAgeMonths)
      .toBe('Tuổi bò tơ phải lớn hơn tuổi cai sữa.')
    expect(validateParameters(values({ windowStartHours: 12, windowEndHours: 10 })).windowEndHours)
      .toBe('Giờ kết thúc phải lớn hơn giờ bắt đầu.')
  })

  it('needs a source note and an effective date from today', () => {
    expect(validateParameterVersion({ parameters: values(), sourceNote: 'Theo khuyến cáo thú y', effectiveFrom: '2026-11-20' } as Version, '2026-11-19')).toMatchInlineSnapshot(`{}`)
    expect(validateParameterVersion({ parameters: values(), sourceNote: '', effectiveFrom: '2026-11-18' } as Version, '2026-11-19')).toMatchInlineSnapshot(`
      {
        "effectiveFrom": "Ngày áp dụng phải từ hôm nay trở đi.",
        "sourceNote": "Ghi chú nguồn là bắt buộc.",
      }
    `)
    expect(validateParameterVersion({ parameters: values(), sourceNote: 'x', effectiveFrom: '' } as Version, '2026-11-19')).toMatchInlineSnapshot(`
      {
        "effectiveFrom": "Ngày áp dụng là bắt buộc.",
      }
    `)
  })
})
