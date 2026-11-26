import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ReproductionActionDialog from '../../../src/features/reproduction/components/ReproductionActionDialog'
import ReproductionProfileTab from '../../../src/features/reproduction/components/ReproductionProfileTab'
import { reproductionApi } from '../../../src/features/reproduction/api/reproductionApi'
import { mapProfile } from '../../../src/features/reproduction/api/reproductionBackend'
import { REPRODUCTION_DEMO } from '../../../src/features/reproduction/data/reproductionMock'
import type { ReproductionCommand, ReproductionFemale } from '../../../src/features/reproduction/types'

afterEach(() => vi.restoreAllMocks())

describe('reproduction indicators and estimated calving date', () => {
  it('TC-11-22 formats three conceptions and five breedings in the profile adapter', () => {
    const profile = mapProfile({
      cattleId: 1122,
      code: 'BC-001122',
      applicable: true,
      herdStatus: 'ACTIVE',
      status: 'PREGNANT',
      indicators: { conceptions: 3, services: 5 },
      timeline: [],
      calvings: [],
    })

    expect(profile.indicators.conceptionSummary).toBe('3 lần có thai / 5 lần phối')
  })

  it('TC-11-23 renders the approved overdue-for-conception badge wording', async () => {
    const seeded = REPRODUCTION_DEMO.find((row) => row.cattleCode === 'BC-000087')!
    const profile: ReproductionFemale = {
      ...seeded,
      status: 'POST_CALVING',
      applicable: true,
      herdStatus: 'ACTIVE',
      indicators: { ...seeded.indicators, daysSinceLastCalving: 111, overdueForConception: true },
    }
    vi.spyOn(reproductionApi, 'getProfile').mockResolvedValue(profile)

    render(
      <MemoryRouter initialEntries={['/cattle/BC-000087?tab=repro']}>
        <ReproductionProfileTab cattleCode="BC-000087" role="MANAGER" />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Quá hạn thụ thai')).toBeInTheDocument()
  })

  it('TC-12-02 calculates an estimated calving date from a four-month pregnancy without a linked breeding', () => {
    const seeded = REPRODUCTION_DEMO.find((row) => row.cattleCode === 'BC-000142')!
    const profile = { ...seeded, events: [] }
    const handlers = {
      onClose: vi.fn(),
      onRecord: vi.fn(async (_command: ReproductionCommand) => undefined),
      onCorrectEvent: vi.fn(async () => undefined),
      onVoidEvent: vi.fn(async () => undefined),
      onCorrectCalving: vi.fn(async () => undefined),
      onVoidCalving: vi.fn(async () => undefined),
      onVoidCalf: vi.fn(async () => undefined),
    }

    render(
      <MemoryRouter>
        <ReproductionActionDialog target={{ mode: 'record', action: 'RECORD_PREGNANCY_CHECK' }} profile={profile} {...handlers} />
      </MemoryRouter>,
    )

    const dialog = screen.getByRole('dialog', { name: 'Ghi khám thai' })
    fireEvent.change(screen.getByLabelText('Thời điểm khám', { selector: 'input' }), { target: { value: '2026-11-01T09:00' } })
    fireEvent.change(screen.getByLabelText('Số tháng chửa'), { target: { value: '4' } })

    expect(screen.getByLabelText('Lần phối liên kết')).toHaveValue('')
    expect(screen.getByLabelText('Cơ sở ngày dự kiến đẻ')).toHaveValue('Ước tính theo số tháng (ESTIMATED)')
    expect(screen.getByLabelText('Ngày dự kiến đẻ')).toHaveValue('13/04/2027')
    expect(dialog).toBeInTheDocument()
  })
})
