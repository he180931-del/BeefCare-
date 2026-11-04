import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { screenById } from '../../../src/app/screenManifest'
import TechnicianLayout from '../../../src/components/TechnicianLayout'
import { TechnicianScreen } from '../../../src/features/technician/pages/TechnicianScreens'

describe('TechnicianScreen', () => {
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

  it('removes write actions in read-only state', () => {
    render(<TechnicianScreen screen={screenById('SCR-122')!} state="read-only" />)
    expect(screen.getByText('Chỉ xem')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ghi nhận đã cho ăn' })).not.toBeInTheDocument()
  })

  it('renders the SCR-32 scanner with camera and manual fallback semantics', () => {
    render(<TechnicianScreen screen={screenById('SCR-32')!} state="success" />)
    expect(screen.getByLabelText('Khung quét mã QR')).toBeInTheDocument()
    expect(screen.getByText('Camera chưa được kết nối trong bản minh họa', { exact: false })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Nhập mã bò, thẻ tai hoặc mã QR' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Đã nhận diện bò VN-0382' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mở hồ sơ bò' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quét lại' })).toBeInTheDocument()
  })

  it('keeps technician home read-only even in success state', () => {
    render(<TechnicianScreen screen={screenById('SCR-104')!} state="success" />)
    expect(screen.queryByRole('button', { name: 'Ghi kết quả' })).not.toBeInTheDocument()
    expect(screen.getByText('Mọi thông tin trên trang chủ kỹ thuật viên chỉ để xem.')).toBeInTheDocument()
  })

  it('offers scan as the recovery action when the daily home is empty', () => {
    render(<TechnicianScreen screen={screenById('SCR-104')!} state="empty" />)
    expect(screen.getByText('Hôm nay chưa có thông báo hoặc nhắc việc')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quét mã QR' })).toBeInTheDocument()
  })
})
