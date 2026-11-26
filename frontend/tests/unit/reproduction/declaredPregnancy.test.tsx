import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { reproductionApi, resetReproductionDemo } from '../../../src/features/reproduction/api/reproductionApi'
import { mapDeclaredPregnancy, mapProfile, mapWorklistItem } from '../../../src/features/reproduction/api/reproductionMapper'
import ReproductionProfileTab from '../../../src/features/reproduction/components/ReproductionProfileTab'
import { declaredPregnancyText, dueLabel } from '../../../src/features/reproduction/domain/reproductionRules'
import type { ReproductionFemale } from '../../../src/features/reproduction/types'

// D82: khai báo "mang thai" lúc nhập đàn đi tiếp vào tab Sinh sản (SCR-39 #3) và danh sách SCR-38.
const CODE = 'BC-000240'
const DECLARED = { months: 4, entryDate: '2026-11-20T00:00' }

describe('ánh xạ khai báo mang thai', () => {
  it('đọc estMonths và ngày nhập; thiếu ngày nhập coi như không có', () => {
    expect(mapDeclaredPregnancy({ estMonths: 4, entryDate: '2026-11-20' })).toEqual(DECLARED)
    expect(mapDeclaredPregnancy({ estMonths: null, entryDate: '2026-11-20' })).toEqual({ months: null, entryDate: '2026-11-20T00:00' })
    expect(mapDeclaredPregnancy({ estMonths: 4 })).toBeNull()
    expect(mapDeclaredPregnancy(null)).toBeNull()
  })

  it('hồ sơ A2: việc cần làm là khám thai thay vì phối', () => {
    const profile = mapProfile({ cattleId: 1, code: CODE, status: 'AWAITING_BREEDING', applicable: true, declaredPregnancy: { estMonths: 4, entryDate: '2026-11-20' } })
    expect(profile.declaredPregnancy).toEqual(DECLARED)
    expect(profile.nextAction).toBe('Khám thai')
    expect(mapProfile({ cattleId: 1, code: CODE, status: 'AWAITING_BREEDING', applicable: true }).declaredPregnancy).toBeNull()
  })

  it('dòng A1: có khai báo và hạn khám thai dù điều kiện phối chưa đạt', () => {
    const row = mapWorklistItem({
      cattleId: 1, code: CODE, status: 'AWAITING_BREEDING', nextAction: 'PREGNANCY_CHECK', due: { date: '2026-11-27' },
      eligibility: { met: false, failed: ['MINIMUM_WEIGHT'], criteria: [] }, declaredPregnancy: { estMonths: 4, entryDate: '2026-11-20' },
    })
    expect(row.declaredPregnancy).toEqual(DECLARED)
    expect(dueLabel(row)).toBe('27/11/2026')
  })

  it('chữ hiển thị', () => {
    expect(declaredPregnancyText(DECLARED)).toBe('Khai báo mang thai ~4 tháng (chưa khám)')
    expect(declaredPregnancyText({ months: null, entryDate: DECLARED.entryDate })).toBe('Khai báo mang thai (chưa khám)')
  })
})

describe('tab Sinh sản của bò khai mang thai chưa khám', () => {
  beforeEach(async () => {
    await resetReproductionDemo()
    const real = reproductionApi.getProfile.bind(reproductionApi)
    vi.spyOn(reproductionApi, 'getProfile').mockImplementation(async (code: string) => {
      const profile = await real(code)
      return profile && ({ ...profile, declaredPregnancy: DECLARED } as ReproductionFemale)
    })
  })
  afterEach(() => vi.restoreAllMocks())

  const renderTab = () => render(<MemoryRouter initialEntries={[`/cattle/${CODE}?tab=repro`]}><ReproductionProfileTab cattleCode={CODE} role="MANAGER" /></MemoryRouter>)

  it('hiện khối khai báo, nút chính là Ghi khám thai', async () => {
    renderTab()
    expect(await screen.findByText('Khai báo mang thai ~4 tháng (chưa khám) · nhập 20/11/2026. Ghi khám thai để xác nhận.')).toBeInTheDocument()
    const buttons = screen.getAllByRole('button').filter((b) => /^Ghi /.test(b.textContent ?? ''))
    expect(buttons[0]).toHaveTextContent('Ghi khám thai')
  })

  it('ghi phối: cảnh báo trước, "Vẫn ghi" mở popup ghi phối', async () => {
    const user = userEvent.setup()
    renderTab()
    await user.click(await screen.findByRole('button', { name: 'Ghi phối giống' }))
    const warning = await screen.findByRole('dialog', { name: 'Bò có khai báo mang thai' })
    expect(within(warning).getByRole('alert')).toHaveTextContent(`${CODE} được khai báo mang thai ~4 tháng khi nhập ngày 20/11/2026, chưa khám thai. Nên khám thai trước khi phối.`)
    await user.click(within(warning).getByRole('button', { name: 'Vẫn ghi' }))
    expect(screen.queryByRole('dialog', { name: 'Bò có khai báo mang thai' })).not.toBeInTheDocument()
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('ghi phối: chọn "Ghi khám thai" chuyển sang popup khám thai', async () => {
    const user = userEvent.setup()
    renderTab()
    await user.click(await screen.findByRole('button', { name: 'Ghi phối giống' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Bò có khai báo mang thai' })).getByRole('button', { name: 'Ghi khám thai' }))
    expect(await screen.findByRole('dialog', { name: /khám thai/i })).toBeInTheDocument()
  })
})
