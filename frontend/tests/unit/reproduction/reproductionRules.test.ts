import { describe, expect, it } from 'vitest'
import {
  actionsForStatus,
  filterWorklist,
  validateCalving,
  validateReproductionCommand,
} from '../../../src/features/reproduction/domain/reproductionRules'
import { REPRODUCTION_DEMO } from '../../../src/features/reproduction/data/reproductionMock'

describe('reproduction rules', () => {
  it('filters the worklist by status, text, pen, breed and advisory eligibility', () => {
    const all = filterWorklist(REPRODUCTION_DEMO, {})
    expect(all.length).toBeGreaterThan(4)

    expect(filterWorklist(REPRODUCTION_DEMO, { status: 'IN_ESTRUS' }).map((row) => row.cattleCode))
      .toContain('BC-000142')
    expect(filterWorklist(REPRODUCTION_DEMO, { status: 'BRED', query: 'Nâu' }).map((row) => row.cattleCode))
      .toEqual(['BC-000061'])
    expect(filterWorklist(REPRODUCTION_DEMO, { penCode: 'C1', breed: 'Zebu đỏ' }).map((row) => row.cattleCode))
      .toContain('BC-000142')
    expect(filterWorklist(REPRODUCTION_DEMO, { eligibility: 'NOT_MET' }).every((row) => row.eligibility?.status === 'NOT_MET'))
      .toBe(true)
  })

  it('offers actions by reproductive status without turning advisory eligibility into a block', () => {
    expect(actionsForStatus('AWAITING_BREEDING')).toEqual(['RECORD_ESTRUS', 'RECORD_BREEDING'])
    expect(actionsForStatus('BRED')).toContain('RECORD_PREGNANCY_CHECK')
    expect(actionsForStatus('PREGNANT')).toEqual(['RECORD_PREGNANCY_CHECK', 'RECORD_PREGNANCY_UPDATE', 'RECORD_CALVING'])

    const cow = REPRODUCTION_DEMO.find((row) => row.cattleCode === 'BC-000142')!
    const errors = validateReproductionCommand({
      type: 'BREEDING',
      occurredAt: '2026-11-01T09:00',
      method: 'NATURAL_SERVICE',
      sireSource: 'FARM',
      farmSireId: 'sire-1',
    }, { today: '2026-11-01T12:00', profile: cow })
    expect(errors).toEqual([])
  })

  it('validates pregnancy checks, including estimated months only for pregnant results', () => {
    const cow = REPRODUCTION_DEMO.find((row) => row.cattleCode === 'BC-000061')!
    expect(validateReproductionCommand({
      type: 'PREGNANCY_CHECK',
      occurredAt: '2026-11-01T09:00',
      result: 'PREGNANT',
      method: 'ULTRASOUND',
      estimatedMonths: 0,
    }, { today: '2026-11-01T12:00', profile: cow })).toContain('Số tháng mang thai phải từ 1 đến 9.')

    expect(validateReproductionCommand({
      type: 'PREGNANCY_CHECK',
      occurredAt: '2026-11-01T09:00',
      result: 'NOT_PREGNANT',
      estimatedMonths: 3,
    }, { today: '2026-11-01T12:00', profile: cow })).toContain('Chỉ nhập số tháng khi kết quả là Có thai.')
  })

  it('validates estrus timestamps and external sire requirements without blocking advisory eligibility', () => {
    const cow = REPRODUCTION_DEMO.find((row) => row.cattleCode === 'BC-000142')!
    expect(validateReproductionCommand({ type: 'ESTRUS', occurredAt: '2026-11-02T08:00' }, { today: '2026-11-01T12:00', profile: cow }))
      .toContain('Thời điểm sự kiện không được ở tương lai.')
    expect(validateReproductionCommand({
      type: 'BREEDING', occurredAt: '2026-10-21T09:00', method: 'ARTIFICIAL_INSEMINATION', sireSource: 'EXTERNAL',
    }, { today: '2026-11-01T12:00', profile: cow })).toContain('Nhập giống bò đực hoặc giống tinh ngoài trại.')
  })

  it('validates live calf fields and prevents duplicate ear tags', () => {
    const dam = REPRODUCTION_DEMO.find((row) => row.cattleCode === 'BC-000087')!
    const errors = validateCalving({
      birthAt: '2026-11-01T08:00',
      pregnancyId: dam.openPregnancy?.id,
      course: 'NORMAL', damCondition: 'GOOD', retainedPlacenta: false,
      calves: [{
        outcome: 'LIVE', sex: 'FEMALE', weightKg: 26.5, weightBasis: 'MEASURED',
        earTag: 'VN-BV-0001', penId: 'pen-d', breed: 'Lai Sind', registration: 'DRAFT',
      }],
    }, { today: '2026-11-01T12:00', existingEarTags: ['VN-BV-0001'] })
    expect(errors).toContain('Số tai VN-BV-0001 đã được sử dụng.')
  })

  it('keeps an active pregnancy chronology check even when the calving is left unlinked', () => {
    const errors = validateCalving({
      birthAt: '2026-02-01T08:00', pregnancyId: null, course: 'NORMAL', damCondition: 'GOOD',
      retainedPlacenta: false, calves: [{ outcome: 'STILLBORN', sex: 'UNKNOWN' }],
    }, {
      today: '2026-11-01T12:00', existingEarTags: [],
      openPregnancyId: 'preg-087-4', openPregnancyConfirmedAt: '2026-02-18T09:00',
    })
    expect(errors).toContain('Thời điểm đẻ không được trước ngày xác nhận có thai.')
  })
})
