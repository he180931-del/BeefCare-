import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { resetReproductionDemo, reproductionApi } from '../../../src/features/reproduction/api/reproductionApi'
import ReproductionWorklistPage from '../../../src/features/reproduction/pages/ReproductionWorklistPage'
import TechnicianReproductionPage from '../../../src/features/reproduction/pages/TechnicianReproductionPage'
import ReproductionProfileTab from '../../../src/features/reproduction/components/ReproductionProfileTab'
import { SessionContext } from '../../../src/features/authorization/sessionContext'
import CalvingPage from '../../../src/features/reproduction/pages/CalvingPage'

describe('reproduction screens', () => {
  beforeEach(async () => {
    await resetReproductionDemo()
  })

  it('filters the worklist by the entered cattle name', async () => {
    render(<MemoryRouter><ReproductionWorklistPage /></MemoryRouter>)
    await screen.findByRole('row', { name: /BC-000142/ })

    expect(screen.queryByRole('row', { name: /BC-000061/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Đã phối – chờ khám \(1\)/ }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Tìm bò' }), { target: { value: 'Nâu' } })
    expect(screen.getByRole('row', { name: /BC-000061.*Nâu/ })).toBeInTheDocument()
    expect(screen.queryByRole('row', { name: /BC-000142/ })).not.toBeInTheDocument()
  })

  it('keeps the calving form read-only when no authenticated role is passed', async () => {
    render(<MemoryRouter initialEntries={['/cattle/BC-000087/sinh-san/de']}>
      <Routes>
        <Route path="/cattle/:code/sinh-san/de" element={<CalvingPage />} />
        <Route path="/cattle/:code" element={<h1>Hồ sơ bò</h1>} />
      </Routes>
    </MemoryRouter>)

    await screen.findByRole('heading', { name: 'Ghi sự kiện đẻ' })
    expect(screen.getByText('Chỉ Quản lý được ghi sự kiện đẻ. Chủ trại và Kỹ thuật viên xem ở chế độ chỉ đọc.')).toBeInTheDocument()
    expect((screen.getByRole('button', { name: 'Lưu sự kiện đẻ' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('lists estrus females on the technician phone page and shows the window badge', async () => {
    render(<SessionContext.Provider value={{ role: 'TECHNICIAN', fullName: 'Lê Thị Mai', email: 'mai@x.vn', farmId: 1, farmName: 'Trại bò Yên Bài – Ba Vì', logout: async () => undefined }}><MemoryRouter><TechnicianReproductionPage /></MemoryRouter></SessionContext.Provider>)
    expect(await screen.findByText('BC-000142')).toBeInTheDocument()
    expect(screen.getByText('Phối 14:30–18:30')).toBeInTheDocument()
    expect(screen.getByText('Chưa đủ điều kiện')).toBeInTheDocument()
    expect(screen.getByText('Kỹ thuật viên chỉ xem; báo Quản lý để ghi nhận.')).toBeInTheDocument()
  })

  it('opens the estrus dialog from ?m= for a manager and saves it', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/cattle/BC-000240?tab=repro&m=ghi-dong-duc']}><ReproductionProfileTab cattleCode="BC-000240" role="MANAGER" /></MemoryRouter>)
    await user.click(await screen.findByRole('button', { name: 'Lưu động dục' }))
    expect((await reproductionApi.getProfile('BC-000240')).status).toBe('IN_ESTRUS')
  })

  it('hides recording buttons from the owner', async () => {
    render(<MemoryRouter initialEntries={['/cattle/BC-000240?tab=repro&m=ghi-dong-duc']}><ReproductionProfileTab cattleCode="BC-000240" role="OWNER" /></MemoryRouter>)
    await screen.findByText('Trạng thái sinh sản')
    expect(screen.queryByRole('button', { name: 'Lưu động dục' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ghi động dục' })).not.toBeInTheDocument()
  })
})
