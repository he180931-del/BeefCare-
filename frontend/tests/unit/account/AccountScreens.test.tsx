import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { screenById } from '../../../src/app/screenManifest'
import { AccountScreen } from '../../../src/features/account/pages/AccountScreens'

describe('AccountScreen', () => {
  it('renders explicit owner registration requirements in one column', () => {
    render(<AccountScreen screen={screenById('SCR-03')!} state="success" />)
    expect(screen.getByRole('heading', { name: 'Đăng ký Chủ trại' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Họ và tên' })).toBeRequired()
    expect(screen.getByRole('textbox', { name: 'Email' })).toBeRequired()
    expect(screen.getByRole('button', { name: 'Tạo tài khoản' })).toBeInTheDocument()
  })

  it('uses one flat member table and labels fixture data', () => {
    const { container } = render(<AccountScreen screen={screenById('SCR-15')!} state="success" />)
    expect(screen.getByText('Dữ liệu minh họa · chưa lưu')).toBeInTheDocument()
    expect(screen.getAllByRole('table').length).toBeGreaterThanOrEqual(1)
    expect(container.querySelectorAll('section.rounded-xl')).toHaveLength(0)
  })

  it('names the failing state precisely', () => {
    render(<AccountScreen screen={screenById('SCR-17')!} state="error" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Không thể tải lời mời vào trang trại')
  })

  it.each([
    ['SCR-01', 'Quản lý đàn bò từ hồ sơ đến quyết định', 'Bảng giá hiện hành'],
    ['SCR-02', 'Tiếp tục với Google', 'Ghi nhớ đăng nhập'],
    ['SCR-03', 'Xác nhận mật khẩu', 'Điều khoản sử dụng và Chính sách dữ liệu'],
    ['SCR-04', 'Email xác minh đã được gửi', 'Gửi lại email xác minh'],
    ['SCR-05', 'Kết quả gửi luôn giống nhau', 'Gửi liên kết đặt lại'],
    ['SCR-06', 'Email của liên kết', 'Các phiên đăng nhập khác sẽ kết thúc'],
    ['SCR-07', 'Bước 1 / 3', 'Hoàn tất và đăng ký trang trại'],
    ['SCR-08', 'Phương thức đăng nhập', 'Quyền của tôi tại trang trại'],
    ['SCR-09', 'Tài khoản', 'Lưu mật khẩu'],
    ['SCR-10', 'Vai trò của bạn', 'Vào trang trại'],
    ['SCR-11', 'Bước 2 / 3', 'Quy mô đàn dự kiến'],
    ['SCR-12', 'Thông tin vận hành', 'Tóm tắt dịch vụ'],
    ['SCR-13', 'Danh sách dịch vụ', 'Ngày kết thúc phạm vi'],
    ['SCR-14', 'Thời hạn đã mua không thay đổi', 'Lý do'],
    ['SCR-15', 'Quyền theo vai trò', 'Tháng tham gia'],
    ['SCR-16', 'Hiệu lực lời mời', 'Quyền của vai trò đã chọn'],
    ['SCR-17', 'Hết hạn lúc', 'Gửi lại'],
    ['SCR-18', 'Ngày hiệu lực', 'Ngừng hoạt động'],
    ['SCR-19', 'Email đăng nhập', 'Chấp nhận và vào trại'],
  ])('renders dedicated business content for %s', (id, firstMarker, secondMarker) => {
    render(<AccountScreen screen={screenById(id as `SCR-${string}`)!} state="success" />)
    expect(screen.getAllByText(firstMarker, { exact: false }).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(secondMarker, { exact: false }).length).toBeGreaterThanOrEqual(1)
  })

  it('keeps manager membership and actions read-only', () => {
    render(<AccountScreen screen={screenById('SCR-15')!} state="read-only" />)
    expect(screen.getAllByText('Chỉ xem').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByRole('button', { name: 'Mời thành viên' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Đổi vai trò' })).not.toBeInTheDocument()
  })

  it('uses a contextual invitation empty state', () => {
    render(<AccountScreen screen={screenById('SCR-17')!} state="empty" />)
    expect(screen.getByText('Chưa có lời mời thành viên')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mời thành viên' })).toBeInTheDocument()
  })
})
