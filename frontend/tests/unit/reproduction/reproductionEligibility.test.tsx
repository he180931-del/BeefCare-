import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { mapEligibility } from '../../../src/features/reproduction/api/reproductionBackend'
import { EligibilityCard } from '../../../src/features/reproduction/components/ReproductionCards'
import { NO_WEIGHING, eligibilityLabel } from '../../../src/features/reproduction/domain/reproductionRules'
import type { BreedingEligibility, ReproductionFemale } from '../../../src/features/reproduction/types'

// Chốt 15/11/2026: chỉ bản ghi cân VALID là lần cân (GBR-39); cân lúc nhập đàn không tính.
const noWeighing = mapEligibility({
  met: false, failed: ['MINIMUM_WEIGHT'],
  criteria: [
    { name: 'MINIMUM_AGE', required: '13', value: '36', met: true },
    { name: 'MINIMUM_WEIGHT', required: '230', value: 'Chưa có lần cân', met: false },
    { name: 'OPEN_HEALTH_CASE', required: '0', value: '0', met: true },
  ],
}) as BreedingEligibility

describe('điều kiện phối khi bò chưa có lần cân', () => {
  it('A1 / A2 "Chưa có lần cân" → tiêu chí cân không đạt, không có số cân', () => {
    expect(noWeighing).toMatchObject({ status: 'NOT_MET', minimumWeightMet: false, actualWeightKg: null, requiredWeightKg: 230 })
  })

  it('danh sách hiện "Chưa có lần cân" (không phải "Chưa đạt"); có điều kiện khác chưa đạt thì kèm câu này', () => {
    expect(eligibilityLabel(noWeighing)).toBe(NO_WEIGHING)
    expect(eligibilityLabel({ ...noWeighing, minimumAgeMet: false, actualAgeMonths: 11 })).toBe('Chưa đạt · tuổi 11 tháng · Chưa có lần cân')
    expect(eligibilityLabel({ ...noWeighing, actualWeightKg: 200 })).toBe('Chưa đạt · cân 200 kg')
  })

  it('tab Sinh sản: dòng cân hiện "Chưa có lần cân" ở cả giá trị và kết quả', () => {
    render(<EligibilityCard profile={{ eligibility: noWeighing } as ReproductionFemale} />)
    const row = screen.getByRole('cell', { name: 'Cân ≥ 230 kg' }).closest('tr') as HTMLElement
    expect(within(row).getAllByText(NO_WEIGHING)).toHaveLength(2)
    expect(within(row).queryByText('Chưa đạt')).not.toBeInTheDocument()
  })
})
