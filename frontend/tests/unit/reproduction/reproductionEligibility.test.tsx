import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { mapEligibility } from '../../../src/features/reproduction/api/reproductionBackend'
import { EligibilityCard } from '../../../src/features/reproduction/components/ReproductionCards'
import { NO_WEIGHING, eligibilityLabel, eligibilityScore } from '../../../src/features/reproduction/domain/reproductionRules'
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

  it('tab Sinh sản: dòng cân hiện "Chưa có lần cân", không gọi là "Chưa đạt"', () => {
    render(<EligibilityCard profile={{ eligibility: noWeighing } as ReproductionFemale} />)
    const row = screen.getByText('Cân ≥ 230 kg').closest('li') as HTMLElement
    expect(within(row).getByText(NO_WEIGHING)).toBeInTheDocument()
    expect(within(row).queryByText('Chưa đạt')).not.toBeInTheDocument()
  })
})

describe('TC-11-15: OPEN health-case eligibility slice', () => {
  it('maps and displays the server OPEN_HEALTH_CASE failure with two of three criteria met', () => {
    const eligibility = mapEligibility({
      met: false,
      criteria: [
        { name: 'MINIMUM_AGE', required: 13, value: 36, met: true },
        { name: 'MINIMUM_WEIGHT', required: 230, value: 300, met: true },
        { name: 'OPEN_HEALTH_CASE', required: 0, value: 1, met: false },
      ],
    })!
    expect(eligibility).toMatchObject({ status: 'NOT_MET', noOpenHealthCase: false, failedConditions: ['sức khỏe'] })
    expect(eligibilityScore(eligibility)).toMatchObject({ met: 2, total: 3, label: 'Chưa đạt 2/3', failed: ['sức khỏe'] })

    render(<EligibilityCard profile={{ eligibility } as ReproductionFemale} />)
    const healthRow = screen.getByText('Không có ca bệnh mở').closest('li') as HTMLElement
    expect(within(healthRow).getByText('Có ca mở')).toBeInTheDocument()
    expect(screen.getByText('Chưa đạt 2/3')).toBeInTheDocument()
  })
})

describe('D67: tiêu chí sau đẻ và nhắc cân lại', () => {
  const postpartum = mapEligibility({
    met: false, failed: ['POSTPARTUM_INTERVAL'],
    criteria: [
      { name: 'MINIMUM_AGE', required: '13', value: '40', met: true },
      { name: 'MINIMUM_WEIGHT', required: '230', value: '380', met: true },
      { name: 'OPEN_HEALTH_CASE', required: '0', value: '0', met: true },
      { name: 'POSTPARTUM_INTERVAL', required: '45', value: '14', met: false },
    ],
  }) as BreedingEligibility

  it('bò mới đẻ 14 ngày: thêm dòng "Sau đẻ ≥ 45 ngày", chưa đạt 3/4', () => {
    expect(postpartum).toMatchObject({ postpartumMet: false, requiredPostpartumDays: 45, daysSinceCalving: 14 })
    expect(eligibilityLabel(postpartum)).toBe('Chưa đạt · sau đẻ 14 ngày')
    render(<EligibilityCard profile={{ eligibility: postpartum } as ReproductionFemale} />)
    expect(screen.getByText('Sau đẻ ≥ 45 ngày').closest('li')).toHaveTextContent('14 ngày')
    expect(screen.getByText('Chưa đạt 3/4')).toBeInTheDocument()
  })

  it('chỉ thiếu lần cân: huy hiệu tổng là "Cần cân lại" (vàng), không phải "Chưa đạt"', () => {
    render(<EligibilityCard profile={{ eligibility: noWeighing } as ReproductionFemale} />)
    expect(screen.getByText('Cần cân lại')).toBeInTheDocument()
    expect(screen.queryByText(/^Chưa đạt/)).not.toBeInTheDocument()
  })
})
