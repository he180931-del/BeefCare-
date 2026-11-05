import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { screenById } from '../../../src/app/screenManifest'
import { PlatformScreen } from '../../../src/features/platform/pages/PlatformScreens'

function renderPlatform(id: `SCR-${string}`, state: 'success' | 'empty' | 'read-only', role: 'pm' | 'sa' = 'sa') {
  return render(<MemoryRouter><PlatformScreen screen={screenById(id)!} state={state} role={role} /></MemoryRouter>)
}

describe('PlatformScreen', () => {
  beforeEach(() => localStorage.clear())

  it('keeps support and reconciliation in the BeefCare visual language', () => {
    renderPlatform('SCR-91', 'success', 'pm')
    expect(screen.getByRole('heading', { name: 'Thanh toán và đối soát' })).toBeInTheDocument()
    expect(screen.getAllByText('Chờ đối soát').length).toBeGreaterThan(0)
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('lets PM add a local finance work item and open its detail', () => {
    renderPlatform('SCR-91', 'success', 'pm')

    expect(screen.getByLabelText('Phân trang bảng')).toHaveTextContent('100 dòng')
    fireEvent.click(screen.getByRole('button', { name: 'Ghi nhận khoản thu' }))
    expect(screen.getByRole('heading', { name: 'Ghi nhận khoản thu · công việc mới' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Nội dung *'), { target: { value: 'Đối soát phí tháng 11' } })
    fireEvent.change(screen.getByLabelText('Đối tượng *'), { target: { value: 'Trại Suối Giàng' } })
    fireEvent.change(screen.getByLabelText('Giá trị / ghi chú *'), { target: { value: '4.800.000 đ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu công việc' }))

    expect(screen.getByText('Đã thêm công việc vào danh sách cục bộ.')).toBeInTheDocument()
    expect(screen.getAllByText('Đối soát phí tháng 11').length).toBeGreaterThan(0)
    fireEvent.click(screen.getAllByRole('button', { name: 'Mở' })[0])
    expect(screen.getByRole('heading', { name: /Chi tiết công việc/ })).toBeInTheDocument()
  })

  it.each([
    ['SCR-20', 'Tài khoản người dùng', 'Trang trại tham gia', 'Tạm ngừng tài khoản'],
    ['SCR-21', 'Quyền nhân sự nền tảng', 'SA hoạt động cuối cùng', 'Lịch sử quyền'],
    ['SCR-80', 'Lịch sử kiểm tra', 'Mã tương quan', 'Chi tiết thay đổi'],
  ])('renders a dedicated platform workbench for %s', (id, heading, firstMarker, secondMarker) => {
    renderPlatform(id as `SCR-${string}`, 'success')
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
    expect(screen.getAllByText(firstMarker, { exact: false }).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(secondMarker, { exact: false }).length).toBeGreaterThanOrEqual(1)
  })

  it('removes account status actions in read-only review state', () => {
    renderPlatform('SCR-20', 'read-only')
    expect(screen.getByText('Chỉ xem')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tạm ngừng tài khoản' })).not.toBeInTheDocument()
  })

  it('shows contextual audit empty guidance', () => {
    renderPlatform('SCR-80', 'empty')
    expect(screen.getByText('Chưa có bản ghi trong khoảng đã chọn')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Đặt lại 7 ngày gần nhất' })).toBeInTheDocument()
  })

  it('keeps all 100 preview audit rows inside the default seven-day window', () => {
    renderPlatform('SCR-80', 'success')
    expect(screen.getByRole('button', { name: 'Xuất kết quả lọc' })).toBeEnabled()
    expect(screen.getByLabelText('Phân trang bảng')).toHaveTextContent(/Hiển thị 1–\d+ \/ 100 dòng/)
    expect(screen.getByRole('button', { name: 'Trang 4' })).toBeInTheDocument()
  })
})
