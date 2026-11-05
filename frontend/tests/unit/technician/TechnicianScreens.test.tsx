import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { screenById } from '../../../src/app/screenManifest'
import TechnicianLayout from '../../../src/components/TechnicianLayout'
import { TechnicianScreen } from '../../../src/features/technician/pages/TechnicianScreens'

function renderScreen(id: `SCR-${string}`, state: 'success' | 'read-only' | 'empty' = 'success') {
  return render(<MemoryRouter initialEntries={[`/ui/${id.toLowerCase()}`]}><TechnicianScreen screen={screenById(id)!} state={state} /></MemoryRouter>)
}

describe('TechnicianScreen', () => {
  beforeEach(() => window.localStorage.clear())
  it('keeps scan and daily actions reachable in the phone shell', () => {
    render(<MemoryRouter initialEntries={['/ui/scr-104']}><TechnicianLayout title="Công việc hôm nay"><TechnicianScreen screen={screenById('SCR-104')!} state="success" /></TechnicianLayout></MemoryRouter>)
    expect(screen.getByRole('button', { name: 'Quét mã QR' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Điều hướng kỹ thuật viên' })).toHaveTextContent('Khẩu phần hôm nay')
    expect(screen.getByText('Chào An,')).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Tìm bò theo mã hoặc thẻ tai' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Thông báo mới' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Nhắc việc hôm nay' })).toBeInTheDocument()
    expect(screen.getByText('2 phiên chưa ghi nhận')).toBeInTheDocument()
  })

  it('keeps farm switching and the technician profile reachable from the header', () => {
    render(<MemoryRouter initialEntries={['/ui/scr-104']}><TechnicianLayout title="Công việc hôm nay"><TechnicianScreen screen={screenById('SCR-104')!} state="success" /></TechnicianLayout></MemoryRouter>)

    expect(screen.getByRole('link', { name: 'Đổi trang trại' })).toHaveAttribute('href', '/ui/scr-10')
    expect(screen.getByRole('button', { name: 'Mở menu tài khoản' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Mở menu tài khoản' }))

    expect(screen.getByRole('menu')).toHaveTextContent('Hồ sơ của tôi')
    expect(screen.getByRole('menuitem', { name: 'Hồ sơ của tôi' })).toHaveAttribute('href', '/ui/scr-08')
  })

  it('removes write actions in read-only state', () => {
    renderScreen('SCR-122', 'read-only')
    expect(screen.getByText('Chỉ xem')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ghi nhận đã cho ăn' })).not.toBeInTheDocument()
  })

  it('records a ration locally when the technician confirms feeding', () => {
    renderScreen('SCR-122')
    fireEvent.click(screen.getAllByRole('button', { name: 'Ghi nhận đã cho ăn' })[0])
    expect(screen.getByText('Đã ghi nhận khẩu phần cho A1 · Bò cái sinh sản.')).toBeInTheDocument()
    expect(window.localStorage.getItem('beefcare-technician-rations.v1')).toContain('A1 · Bò cái sinh sản')
  })

  it('renders the SCR-32 scanner with camera and manual fallback semantics', () => {
    renderScreen('SCR-32')
    expect(screen.getByLabelText('Khung quét mã QR')).toBeInTheDocument()
    expect(screen.getByText('Bật camera để quét QR thẻ tai.')).toBeInTheDocument()
    const manual = screen.getByRole('textbox', { name: 'Nhập mã bò, thẻ tai hoặc mã QR' })
    fireEvent.change(manual, { target: { value: 'BC-000203' } })
    fireEvent.click(screen.getByRole('button', { name: 'Nhận diện' }))
    expect(screen.getByRole('heading', { name: 'Đã nhận diện bò BC-000203' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mở hồ sơ bò' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quét lại' })).toBeInTheDocument()
  })

  it('keeps technician home read-only even in success state', () => {
    renderScreen('SCR-104')
    expect(screen.queryByRole('button', { name: 'Ghi kết quả' })).not.toBeInTheDocument()
    expect(screen.getByText('Mọi thông tin trên trang chủ kỹ thuật viên chỉ để xem.')).toBeInTheDocument()
  })

  it('opens the selected reminder detail instead of leaving the item inert', () => {
    renderScreen('SCR-104')
    fireEvent.click(screen.getByRole('button', { name: /Kiểm tra bò sau điều trị/ }))
    expect(screen.getByRole('heading', { name: 'Nhắc việc · KT-01' })).toBeInTheDocument()
    expect(screen.getAllByText('VN-0382 · Chuồng A1')).toHaveLength(2)
  })

  it('offers scan as the recovery action when the daily home is empty', () => {
    renderScreen('SCR-104', 'empty')
    expect(screen.getByText('Hôm nay chưa có thông báo hoặc nhắc việc')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quét mã QR' })).toBeInTheDocument()
  })
})
