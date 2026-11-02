import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import CowList from '../../../src/features/cattle/pages/CowList'
import CowProfile from '../../../src/features/cattle/pages/CowProfile'
import ScanQrPage from '../../../src/features/cattle/pages/ScanQrPage'
import TechnicianCattleRoutes from '../../../src/features/cattle/pages/TechnicianCattleRoutes'
import { initialCows } from '../../../src/data/cowsData'

const Where = () => <p data-testid="where">{useLocation().pathname + useLocation().search}</p>

describe('cattle slice S12', () => {
  beforeEach(() => localStorage.setItem('beefcare:latency', '0'))

  it('uses the ear tag from the frame for BC-000203', () => {
    expect(initialCows.find((c) => c.code === 'BC-000203')?.tag).toBe('VN-BV-0512')
  })

  it('reads ?q= from the topbar search as the initial search text', async () => {
    render(<MemoryRouter initialEntries={['/cattle?q=BC-000203']}><CowList /></MemoryRouter>)
    expect(await screen.findByPlaceholderText('Mã hiển thị, số tai, tên gọi…')).toHaveValue('BC-000203')
    expect(await screen.findByText('BC-000203')).toBeInTheDocument()
    expect(screen.queryByText('BC-000125')).not.toBeInTheDocument()
  })

  it('changes the primary action by tab and sends the cattle code to the recording page', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/cattle/BC-000125?tab=growth']}>
        <Routes><Route path="/cattle/:code" element={<CowProfile />} /><Route path="*" element={<Where />} /></Routes>
      </MemoryRouter>,
    )
    await user.click(await screen.findByRole('button', { name: 'Ghi nhận cân & BCS' }))
    expect(await screen.findByLabelText('Cân nặng')).toBeInTheDocument()
  })

  it.each([['vaccine', 'Ghi nhận tiêm'], ['health', 'Mở ca sức khỏe']])('shows the %s tab action', async (tab, label) => {
    render(<MemoryRouter initialEntries={[`/cattle/BC-000125?tab=${tab}`]}><Routes><Route path="/cattle/:code" element={<CowProfile />} /></Routes></MemoryRouter>)
    expect(await screen.findByRole('button', { name: label })).toBeInTheDocument()
  })

  it('shows the technician profile with its care tabs and no write actions', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/kt/dan-bo/BC-000125']}><Routes><Route path="/kt/dan-bo/*" element={<TechnicianCattleRoutes />} /></Routes></MemoryRouter>)
    expect(await screen.findByRole('button', { name: 'Tăng trưởng' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sinh sản' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cập nhật hồ sơ' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Tiêm phòng' }))
    expect(screen.getByRole('button', { name: 'Tiêm phòng' })).toBeInTheDocument()
  })

  it('identifies a cattle by ear tag and reports an unknown code', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/kt/quet-qr']}><ScanQrPage /></MemoryRouter>)
    await user.type(screen.getByLabelText('Nhập mã thủ công'), 'KHONG-CO')
    await user.click(screen.getByRole('button', { name: 'Tra cứu' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Mã này không phải thẻ tai')
    await user.clear(screen.getByLabelText('Nhập mã thủ công'))
    await user.type(screen.getByLabelText('Nhập mã thủ công'), 'VN-BV-0512')
    await user.click(screen.getByRole('button', { name: 'Tra cứu' }))
    expect(await screen.findByText('Đã nhận diện')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mở hồ sơ' })).toBeInTheDocument()
  })
})
