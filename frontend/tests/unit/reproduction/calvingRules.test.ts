import { describe, expect, it } from 'vitest'
import {
  calvingIssues,
  calvingSummary,
  eligibilityScore,
  expectedCalvingDate,
  validateCalving,
} from '../../../src/features/reproduction/domain/reproductionRules'
import { REPRODUCTION_DEMO } from '../../../src/features/reproduction/data/reproductionMock'
import type { CalvingCommand } from '../../../src/features/reproduction/types'

const live: CalvingCommand['calves'][number] = {
  outcome: 'LIVE', sex: 'MALE', weightKg: 24, weightBasis: 'MEASURED', earTag: 'QR-6701-0249',
  penId: 'pen-d', breed: 'Lai Sind', registration: 'REGISTER_NOW', productionPurpose: 'UNDECIDED',
}
const command = (calves: CalvingCommand['calves']): CalvingCommand => ({
  birthAt: '2026-10-20T04:20', pregnancyId: 'preg-087-3', course: 'NORMAL', damCondition: 'GOOD', retainedPlacenta: false, calves,
})
const context = {
  today: '2026-10-20T12:00', existingEarTags: ['QR-6701-0001'],
  tagOwners: { 'qr-6701-0001': 'bò BC-000112' },
}

describe('calving rules (GBR-57, GBR-58, MSG-FE12-06/07/08, MSG-FE05-12)', () => {
  it('accepts one live registered calf with tag, pen, weight basis and a matching purpose', () => {
    expect(calvingIssues(command([live]), context)).toEqual([])
  })

  it('points a used tag at the calf field and names the cattle that owns it', () => {
    const issues = calvingIssues(command([{ ...live, earTag: 'qr-6701-0001' }]), context)
    expect(issues).toEqual([{ calf: 0, field: 'earTag', message: 'Mã qr-6701-0001 đã dùng cho bò BC-000112' }])
  })

  it('catches the same tag typed on two calves of one calving', () => {
    const issues = calvingIssues(command([live, { ...live, sex: 'FEMALE' }]), context)
    expect(issues.map((issue) => [issue.calf, issue.field])).toEqual([[1, 'earTag']])
  })

  it('needs a tag only when the live calf is registered now, not for a draft', () => {
    expect(calvingIssues(command([{ ...live, earTag: '' }]), context)[0]).toMatchObject({ calf: 0, field: 'earTag' })
    expect(calvingIssues(command([{ ...live, earTag: '', registration: 'DRAFT' }]), context)).toEqual([])
  })

  it('needs a weight basis with a weight and keeps the weight between 1 and 80 kg', () => {
    expect(calvingIssues(command([{ ...live, weightBasis: null }]), context)[0]).toMatchObject({ field: 'weightBasis' })
    expect(calvingIssues(command([{ ...live, weightKg: 81 }]), context)[0]).toMatchObject({ field: 'weight' })
  })

  it('refuses a SIRE purpose for a female calf and a BREEDING purpose for a male calf', () => {
    expect(calvingIssues(command([{ ...live, sex: 'FEMALE', productionPurpose: 'SIRE' }]), context)[0]).toMatchObject({ calf: 0, field: 'purpose' })
    expect(calvingIssues(command([{ ...live, sex: 'MALE', productionPurpose: 'BREEDING' }]), context)[0]).toMatchObject({ calf: 0, field: 'purpose' })
  })

  it('allows unknown sex only for a stillborn calf and asks for no tag, pen or registration there', () => {
    expect(calvingIssues(command([{ outcome: 'STILLBORN', sex: 'UNKNOWN' }]), context)).toEqual([])
    expect(calvingIssues(command([{ ...live, sex: 'UNKNOWN' }]), context)[0]).toMatchObject({ calf: 0, field: 'sex' })
  })

  it('requires at least one and at most four calf outcomes as a form-level error', () => {
    expect(calvingIssues(command([]), context)).toEqual([{ message: 'Sự kiện đẻ cần từ 1 đến 4 bê.' }])
    expect(validateCalving(command([live]), context)).toEqual([])
  })

  it('summarises calf outcomes the way the timeline shows them', () => {
    const calf = REPRODUCTION_DEMO.find((row) => row.cattleCode === 'BC-000061')!.calvings[0]!.calves[0]!
    expect(calvingSummary([
      { ...calf, number: 1 },
      { ...calf, number: 2, outcome: 'STILLBORN', sex: 'FEMALE', weightKg: 19, earTag: null },
    ])).toBe('2 bê: Sống · Đực · 25 kg · BC-000198; Chết lúc sinh · Cái · 19 kg')
  })
})

describe('breeding eligibility and expected date', () => {
  it('computes the eligibility score from the real conditions', () => {
    const byCode = (code: string) => REPRODUCTION_DEMO.find((row) => row.cattleCode === code)!.eligibility!
    expect(eligibilityScore(byCode('BC-000142'))).toMatchObject({ met: 3, total: 3, label: 'Đạt 3/3' })
    expect(eligibilityScore(byCode('BC-000188'))).toMatchObject({ met: 2, total: 3, label: 'Chưa đạt 2/3' })
  })

  it('adds the 283 day gestation length to a breeding time', () => {
    expect(expectedCalvingDate('2026-10-20T15:10')).toBe('2027-07-30T15:10')
  })
})
