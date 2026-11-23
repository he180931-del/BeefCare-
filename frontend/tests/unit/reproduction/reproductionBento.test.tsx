import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { resetReproductionDemo } from '../../../src/features/reproduction/api/reproductionApi'
import ReproductionWorklistPage from '../../../src/features/reproduction/pages/ReproductionWorklistPage'
import ReproductionProfileTab from '../../../src/features/reproduction/components/ReproductionProfileTab'

// docs/BeefCare-Bento-Grid.md §3 + Figma Tab 18: một khối nổi bật mỗi màn, màu cảnh báo theo dữ liệu hiện tại.
const tileOf = (label: string) => screen.getByText(label).closest('.rounded-2xl') as HTMLElement
const valueOf = (tile: HTMLElement) => Number(tile.children[1]?.textContent)
const panelOf = (heading: string) => screen.getByRole('heading', { name: new RegExp(heading) }).closest('section') as HTMLElement

describe('reproduction Bento layout (Figma Tab 18)', () => {
  beforeEach(async () => {
    await resetReproductionDemo()
  })

  it('D71: "Việc cần làm" is the only emphasis block; the alert block is light red only when some cows need attention', async () => {
    render(<MemoryRouter><ReproductionWorklistPage /></MemoryRouter>)
    await screen.findByRole('row', { name: /BC-000142/ })
    const tiles = screen.getByRole('region', { name: 'Chỉ số sinh sản' })
    expect(tiles.querySelectorAll('.bg-brand-dark')).toHaveLength(1)
    expect(within(tiles).getByText('Việc cần làm').closest('section')).toHaveClass('bg-brand-dark')
    const alert = within(tiles).getByText(/^(Cần chú ý|Không có bò cần chú ý)$/).closest('section') as HTMLElement
    const notEligible = Number(within(alert).getByText('bò chưa đủ điều kiện phối').previousElementSibling?.textContent ?? 0)
    expect(alert).toHaveClass(notEligible > 0 ? 'bg-err-bg' : 'bg-ok-bg')
  })

  it('opens the cow from the keyboard: rows take focus and Enter opens the Sinh sản tab', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/sinh-san']}>
        <Routes>
          <Route path="/sinh-san" element={<ReproductionWorklistPage />} />
          <Route path="/cattle/:code" element={<h1>Hồ sơ bò</h1>} />
        </Routes>
      </MemoryRouter>,
    )
    const row = await screen.findByRole('row', { name: /BC-000142/ })
    expect(row).toHaveAttribute('tabindex', '0')
    row.focus()
    await user.keyboard('{Enter}')
    expect(await screen.findByRole('heading', { name: 'Hồ sơ bò' })).toBeInTheDocument()
  })

  it('D68: shows the status as the dark block with the window inside and a white primary button; eligibility met is light green', async () => {
    render(<MemoryRouter><ReproductionProfileTab cattleCode="BC-000142" role="MANAGER" /></MemoryRouter>)
    await screen.findByText('Trạng thái sinh sản')

    const status = panelOf('Trạng thái sinh sản')
    expect(status).toHaveClass('bg-brand-dark')
    expect(within(status).getByRole('button', { name: 'Ghi phối giống' })).toHaveClass('bg-white', 'text-brand')
    expect(within(status).getByRole('button', { name: 'Ghi động dục' })).toHaveClass('bg-white/12', 'text-white')
    expect(within(status).getByText('Cửa sổ phối gợi ý')).toBeInTheDocument()
    expect(panelOf('Điều kiện xét phối')).toHaveClass('bg-ok-bg')
  })

  it('D67: cow bred over 21 days ago gets "Xác nhận có thai (quan sát)" which opens the check prefilled with Observation', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><ReproductionProfileTab cattleCode="BC-000061" role="MANAGER" /></MemoryRouter>)
    await user.click(await screen.findByRole('button', { name: 'Xác nhận có thai (quan sát)' }))
    const dialog = await screen.findByRole('dialog', { name: 'Ghi khám thai' })
    expect(within(dialog).getByRole('combobox', { name: 'Phương pháp' })).toHaveValue('OBSERVATION')
    expect(within(dialog).getByRole('radio', { name: 'Có thai' })).toBeChecked()
  })

  it('tints the current pregnancy yellow only when the cow is due soon', async () => {
    render(<MemoryRouter><ReproductionProfileTab cattleCode="BC-000087" role="MANAGER" /></MemoryRouter>)
    await screen.findByText('Thai kỳ hiện tại')

    const pregnancy = panelOf('Thai kỳ hiện tại')
    const dueSoon = within(pregnancy).queryByText('Sắp đẻ') !== null
    expect(pregnancy).toHaveClass(dueSoon ? 'bg-warn-bg' : 'bg-white')
    expect(panelOf('Lịch sử sinh bê')).toHaveClass('bg-white')
  })
})
