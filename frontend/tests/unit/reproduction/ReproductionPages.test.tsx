import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { resetReproductionDemo, reproductionApi } from '../../../src/features/reproduction/api/reproductionApi'
import ReproductionActionDialog from '../../../src/features/reproduction/components/ReproductionActionDialog'
import ReproductionWorklistPage from '../../../src/features/reproduction/pages/ReproductionWorklistPage'
import CalvingPage from '../../../src/features/reproduction/pages/CalvingPage'
import { REPRODUCTION_DEMO } from '../../../src/features/reproduction/data/reproductionMock'

describe('reproduction screens', () => {
  beforeEach(async () => {
    await resetReproductionDemo()
  })

  it('filters the worklist by the entered cattle name', async () => {
    render(<MemoryRouter><ReproductionWorklistPage /></MemoryRouter>)
    await screen.findByRole('row', { name: /BC-000142/ })

    fireEvent.change(screen.getByRole('textbox', { name: 'Tìm bò' }), { target: { value: 'Nâu' } })
    expect(screen.getByRole('row', { name: /BC-000061.*Nâu/ })).toBeInTheDocument()
    expect(screen.queryByRole('row', { name: /BC-000142/ })).not.toBeInTheDocument()
  })

  it('submits a breeding form with the selected farm sire', async () => {
    const user = userEvent.setup()
    const onRecord = vi.fn(async () => undefined)
    render(<MemoryRouter><ReproductionActionDialog
      target={{ mode: 'record', action: 'RECORD_BREEDING' }}
      profile={REPRODUCTION_DEMO[0]!}
      onClose={() => undefined}
      onRecord={onRecord}
      onCorrectEvent={async () => undefined}
      onVoidEvent={async () => undefined}
      onCorrectCalving={async () => undefined}
      onVoidCalving={async () => undefined}
    /></MemoryRouter>)

    await user.selectOptions(screen.getByRole('combobox', { name: 'Bò đực trong trại' }), 'sire-1')
    await user.click(screen.getByRole('button', { name: 'Lưu sự kiện' }))

    expect(onRecord).toHaveBeenCalledWith(expect.objectContaining({
      type: 'BREEDING', method: 'NATURAL_SERVICE', sireSource: 'FARM', farmSireId: 'sire-1',
    }))
  })

  it('validates the calving form and records an eligible mock calving', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/cattle/BC-000087/sinh-san/de']}>
      <Routes>
        <Route path="/cattle/:code/sinh-san/de" element={<CalvingPage role="MANAGER" />} />
        <Route path="/cattle/:code" element={<h1>Hồ sơ bò</h1>} />
      </Routes>
    </MemoryRouter>)

    await screen.findByRole('heading', { name: /Ghi sự kiện đẻ · BC-000087/ })
    fireEvent.change(screen.getByLabelText('Cân nặng (kg)'), { target: { value: '26.5' } })
    await user.click(screen.getAllByRole('button', { name: 'Lưu sự kiện đẻ' })[0]!)
    expect(await screen.findByText('Bê 1: chọn cơ sở cân.')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Cơ sở cân'), 'MEASURED')
    await user.click(screen.getAllByRole('button', { name: 'Lưu sự kiện đẻ' })[0]!)
    expect(await screen.findByRole('heading', { name: 'Hồ sơ bò' })).toBeInTheDocument()
    const saved = await reproductionApi.getProfile('BC-000087')
    expect(saved.status).toBe('POST_CALVING')
    expect(saved.calvings[0]?.calves[0]?.weightKg).toBe(26.5)
  })

  it('keeps the calving form read-only when no authenticated role is passed', async () => {
    render(<MemoryRouter initialEntries={['/cattle/BC-000087/sinh-san/de']}>
      <Routes>
        <Route path="/cattle/:code/sinh-san/de" element={<CalvingPage />} />
        <Route path="/cattle/:code" element={<h1>Hồ sơ bò</h1>} />
      </Routes>
    </MemoryRouter>)

    await screen.findByRole('heading', { name: /Ghi sự kiện đẻ · BC-000087/ })
    expect(screen.getByText('Chỉ Quản lý được ghi sự kiện đẻ. Chủ trại và Kỹ thuật viên xem ở chế độ chỉ đọc.')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Lưu sự kiện đẻ' }).every((button) => (button as HTMLButtonElement).disabled)).toBe(true)
  })

  it('does not resubmit calf registration data when correcting a calving with an already registered calf', async () => {
    const user = userEvent.setup()
    const profile = REPRODUCTION_DEMO.find((row) => row.cattleCode === 'BC-000087')!
    const calving = profile.calvings[0]!
    const onCorrectCalving = vi.fn(async () => undefined)

    render(<MemoryRouter><ReproductionActionDialog
      target={{ mode: 'correct-calving', calving }}
      profile={profile}
      onClose={() => undefined}
      onRecord={async () => undefined}
      onCorrectEvent={async () => undefined}
      onVoidEvent={async () => undefined}
      onCorrectCalving={onCorrectCalving}
      onVoidCalving={async () => undefined}
    /></MemoryRouter>)

    await user.selectOptions(screen.getByRole('combobox', { name: 'Diễn biến đẻ' }), 'ASSISTED')
    await user.type(screen.getByRole('textbox', { name: 'Lý do' }), 'Bổ sung diễn biến')
    await user.click(screen.getByRole('button', { name: 'Lưu chỉnh sửa' }))

    expect(onCorrectCalving).toHaveBeenCalledWith(calving.id, expect.not.objectContaining({ calves: expect.anything() }), 'Bổ sung diễn biến')
  })
})
