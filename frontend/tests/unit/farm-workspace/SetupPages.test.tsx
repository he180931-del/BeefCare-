import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { SessionContext, type Session } from '../../../src/features/authorization/sessionContext'
import AcceptInvitationPage from '../../../src/features/farm-workspace/pages/AcceptInvitationPage'
import FarmInformationPage from '../../../src/features/farm-workspace/pages/FarmInformationPage'
import FarmRegistrationPage from '../../../src/features/farm-workspace/pages/FarmRegistrationPage'
import FarmSelectPage from '../../../src/features/farm-workspace/pages/FarmSelectPage'

const farm = { farmId: 1, farmName: 'Trại bò Yên Bài – Ba Vì' }
const sessions: Record<string, Session> = {
  owner: { role: 'OWNER', fullName: 'Nguyễn Văn Hùng', email: 'owner@beefcare.local', ...farm, logout: vi.fn() },
  manager: { role: 'MANAGER', fullName: 'Trần Quốc Long', email: 'manager@beefcare.local', ...farm, logout: vi.fn() },
  technician: { role: 'TECHNICIAN', fullName: 'Lê Thị Mai', email: 'technician@beefcare.local', ...farm, logout: vi.fn() },
}
const renderAt = (who: string, path: string, route: string, element: JSX.Element) => render(
  <SessionContext.Provider value={sessions[who]}>
    <MemoryRouter initialEntries={[path]}><Routes><Route path={route} element={element} /><Route path="/goi-dich-vu" element={<p>Trang gói dịch vụ</p>} /></Routes></MemoryRouter>
  </SessionContext.Provider>,
)

describe('Select Farm', () => {
  it('shows each farm with its role, size and the action its service state allows', async () => {
    renderAt('owner', '/chon-trai', '/chon-trai', <FarmSelectPage />)
    expect(await screen.findByText('Trại Tản Lĩnh')).toBeInTheDocument()
    expect(screen.getByText('4 trang trại bạn có quyền truy cập')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Vào trại' })).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Thanh toán để kích hoạt' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Gửi yêu cầu hỗ trợ' })).toBeEnabled()
    expect(screen.getByText('Đến 14/11/2026')).toBeInTheDocument()
    expect(screen.getByText('Gói do chủ trại quản lý')).toBeInTheDocument()
  })

  it('shows the empty and error states from ?demo=', async () => {
    const empty = renderAt('owner', '/chon-trai?demo=empty', '/chon-trai', <FarmSelectPage />)
    expect(await screen.findByText('Tài khoản chưa liên kết với trang trại nào')).toBeInTheDocument()
    empty.unmount()
    renderAt('owner', '/chon-trai?demo=load-error', '/chon-trai', <FarmSelectPage />)
    expect(await screen.findByText('Không tải được danh sách trang trại.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument()
  })
})

describe('Register Farm', () => {
  it('validates the required fields, then creates the farm and opens plan selection', async () => {
    const user = userEvent.setup()
    renderAt('owner', '/dang-ky-trai', '/dang-ky-trai', <FarmRegistrationPage />)
    await user.click(await screen.findByRole('button', { name: /Tạo trang trại và tiếp tục/ }))
    expect(await screen.findByText('Tên trại cần có từ 2 đến 150 ký tự.')).toBeInTheDocument()
    expect(screen.getByText('Chọn quy mô đàn dự kiến.')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Tên trại *'), 'Trại Thung Mây')
    await user.selectOptions(screen.getByLabelText('Tỉnh/Thành *'), 'Phú Thọ')
    await user.type(screen.getByLabelText('Xã/Phường *'), 'Xã Minh Đài')
    await user.selectOptions(screen.getByLabelText('Quy mô dự kiến *'), '150_300')
    await user.click(screen.getByRole('button', { name: /Tạo trang trại và tiếp tục/ }))
    expect(await screen.findByText('Trang gói dịch vụ')).toBeInTheDocument()
  })
})

describe('Accept Invitation', () => {
  it('hides the farm details when the signed-in email differs from the invited one', async () => {
    renderAt('owner', '/invitation/accept?token=mock-invitation-token', '/invitation/accept', <AcceptInvitationPage />)
    expect(await screen.findByText(/được gửi tới thư điện tử khác/)).toBeInTheDocument()
    expect(screen.queryByText('Trang trại')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Chấp nhận & vào trại' })).toBeDisabled()
  })

  it('shows the expired state for an expired or unknown link', async () => {
    const expired = renderAt('technician', '/invitation/accept?token=mock-invitation-expired', '/invitation/accept', <AcceptInvitationPage />)
    expect(await screen.findByText('Lời mời không còn hiệu lực')).toBeInTheDocument()
    expect(screen.getByText('Đã hết hạn')).toBeInTheDocument()
    expect(screen.getByText('24/10/2026 08:10')).toBeInTheDocument()
    expired.unmount()
    renderAt('technician', '/invitation/accept', '/invitation/accept', <AcceptInvitationPage />)
    expect(await screen.findByText('Liên kết không hợp lệ')).toBeInTheDocument()
  })

  it('accepts the invitation with the matching email', async () => {
    const user = userEvent.setup()
    renderAt('technician', '/invitation/accept?token=mock-invitation-token', '/invitation/accept', <AcceptInvitationPage />)
    expect(await screen.findByText('Chờ bạn chấp nhận')).toBeInTheDocument()
    expect(screen.getByText('Xem hồ sơ bò qua quét QR hoặc danh sách')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Chấp nhận & vào trại' }))
    expect(await screen.findByText('Bạn đã tham gia Trại bò Yên Bài – Ba Vì với vai trò Kỹ thuật viên.')).toBeInTheDocument()
  })
})

describe('Farm Information', () => {
  it('lets the Owner edit and save, and validates the name', async () => {
    const user = userEvent.setup()
    renderAt('owner', '/thong-tin-trai', '/thong-tin-trai', <FarmInformationPage />)
    const name = await screen.findByLabelText('Tên trại *')
    expect(await screen.findByText('owner@beefcare.local')).toBeInTheDocument()
    await user.clear(name)
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    expect(await screen.findByText('Tên trại cần có từ 2 đến 150 ký tự.')).toBeInTheDocument()
    await user.type(name, 'Trại bò Yên Bài – Ba Vì')
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    expect(await screen.findByText('Thông tin trang trại đã được cập nhật.')).toBeInTheDocument()
  })

  it('is read-only for a Manager', async () => {
    renderAt('manager', '/thong-tin-trai', '/thong-tin-trai', <FarmInformationPage />)
    expect(await screen.findByText(/chỉ dành cho Chủ trại/)).toBeInTheDocument()
    expect(screen.getByLabelText('Tên trại *')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Lưu thay đổi' })).toBeDisabled()
  })
})
