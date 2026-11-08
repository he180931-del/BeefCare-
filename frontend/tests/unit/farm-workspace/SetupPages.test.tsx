import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { BackendError } from '../../../src/api/backendClient'
import { SessionContext, type Session } from '../../../src/features/authorization/sessionContext'
import { farmWorkspaceApi } from '../../../src/features/farm-workspace/api/farmWorkspaceApi'
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
function PlanSelection() {
  const location = useLocation()
  return <p>SCR-58 {location.search} · {(location.state as { notice?: string } | null)?.notice}</p>
}
const renderAt = (who: string, path: string, route: string, element: JSX.Element) => render(
  <SessionContext.Provider value={sessions[who]}>
    <MemoryRouter initialEntries={[path]}><Routes>
      <Route path={route} element={element} />
      <Route path="/goi-dich-vu" element={<p>Trang gói dịch vụ</p>} />
      <Route path="/dang-ky-goi" element={<PlanSelection />} />
      <Route path="/owner-registration" element={<p>SCR-07 Hoàn tất hồ sơ chủ trại</p>} />
    </Routes></MemoryRouter>
  </SessionContext.Provider>,
)

describe('Select Farm', () => {
  it('shows each farm with its role, size and the action its service state allows', async () => {
    renderAt('owner', '/chon-trai', '/chon-trai', <FarmSelectPage />)
    expect(await screen.findByText('Trại Tản Lĩnh')).toBeInTheDocument()
    expect(screen.getByText('4 trang trại bạn có quyền truy cập')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Vào trại' })).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Thanh toán để kích hoạt' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Gửi Ticket' })).toBeEnabled()
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
  beforeEach(() => {
    vi.restoreAllMocks()
    sessionStorage.clear()
  })

  const fillRequired = async (user: ReturnType<typeof userEvent.setup>, name = 'Trại Thung Mây') => {
    await user.type(await screen.findByLabelText('Tên trại *'), name)
    await user.selectOptions(screen.getByLabelText('Tỉnh/Thành *'), 'Phú Thọ')
    await user.type(screen.getByLabelText('Xã/Phường *'), 'Xã Minh Đài')
  }

  it('validates the required fields, then creates the farm and opens plan selection (SCR-58) for that farm', async () => {
    const user = userEvent.setup()
    renderAt('owner', '/dang-ky-trai', '/dang-ky-trai', <FarmRegistrationPage />)
    await user.click(await screen.findByRole('button', { name: 'Tạo trại và tiếp tục' }))
    expect(await screen.findByText('Tên trại cần có từ 2 đến 150 ký tự.')).toBeInTheDocument()
    expect(screen.queryByText('Chọn quy mô đàn dự kiến.')).not.toBeInTheDocument()

    await fillRequired(user)
    expect(screen.getByLabelText('Quy mô dự kiến')).toHaveValue('')
    await user.click(screen.getByRole('button', { name: 'Tạo trại và tiếp tục' }))
    expect(await screen.findByText(/^SCR-58 \?farm=\d+ · Đã đăng ký trại Trại Thung Mây\. Hãy chọn gói để kích hoạt\.$/)).toBeInTheDocument()
  })

  it('R-02-02 sends the same request key again when the Owner retries after a failure', async () => {
    const user = userEvent.setup()
    const register = vi.spyOn(farmWorkspaceApi, 'registerFarm').mockRejectedValueOnce(new Error('Mất kết nối mạng.'))
    renderAt('owner', '/dang-ky-trai', '/dang-ky-trai', <FarmRegistrationPage />)
    await fillRequired(user, 'Trại thử lại')
    await user.click(screen.getByRole('button', { name: 'Tạo trại và tiếp tục' }))
    expect(await screen.findByText('Mất kết nối mạng.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Tạo trại và tiếp tục' }))
    await waitFor(() => expect(register).toHaveBeenCalledTimes(2))
    const [firstKey, secondKey] = register.mock.calls.map((call) => call[1]?.idempotencyKey)
    expect(firstKey).toBeTruthy()
    expect(secondKey).toBe(firstKey)
    expect(await screen.findByText(/^SCR-58 \?farm=\d+/)).toBeInTheDocument()
  })

  it('UC-FE02-01 E1 shows MSG-FE02-02 and opens SCR-07 when the Owner profile is not complete', async () => {
    const user = userEvent.setup()
    const profile = await farmWorkspaceApi.getProfile()
    vi.spyOn(farmWorkspaceApi, 'getProfile').mockResolvedValue({ ...profile, ownerRegistrationCompleted: false })
    const register = vi.spyOn(farmWorkspaceApi, 'registerFarm')
    renderAt('owner', '/dang-ky-trai', '/dang-ky-trai', <FarmRegistrationPage />)
    expect(await screen.findByRole('dialog', { name: 'Chưa hoàn tất hồ sơ Chủ trại' })).toBeInTheDocument()
    expect(screen.getByText('Vui lòng hoàn tất hồ sơ Chủ trại trước khi đăng ký trại.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Hoàn tất hồ sơ' }))
    expect(await screen.findByText('SCR-07 Hoàn tất hồ sơ chủ trại')).toBeInTheDocument()
    expect(register).not.toHaveBeenCalled()
  })

  it('UC-FE02-01 E1 also handles MSG-FE02-02 returned by the backend', async () => {
    const user = userEvent.setup()
    vi.spyOn(farmWorkspaceApi, 'registerFarm').mockRejectedValueOnce(new BackendError(403, { code: 'MSG-FE02-02', params: {} }))
    renderAt('owner', '/dang-ky-trai', '/dang-ky-trai', <FarmRegistrationPage />)
    await fillRequired(user)
    await user.click(screen.getByRole('button', { name: 'Tạo trại và tiếp tục' }))
    expect(await screen.findByRole('dialog', { name: 'Chưa hoàn tất hồ sơ Chủ trại' })).toBeInTheDocument()
  })
})

describe('Accept Invitation', () => {
  it('hides the farm details when the signed-in email differs from the invited one', async () => {
    renderAt('owner', '/chap-nhan-loi-moi?token=mock-invitation-token', '/chap-nhan-loi-moi', <AcceptInvitationPage />)
    expect(await screen.findByText(/được gửi tới thư điện tử khác/)).toBeInTheDocument()
    expect(screen.queryByText('Trang trại')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Chấp nhận & vào trại' })).toBeDisabled()
  })

  it('shows the expired state for an expired or unknown link', async () => {
    const expired = renderAt('technician', '/chap-nhan-loi-moi?token=mock-invitation-expired', '/chap-nhan-loi-moi', <AcceptInvitationPage />)
    expect(await screen.findByText('Lời mời không còn hiệu lực')).toBeInTheDocument()
    expect(screen.getByText('Đã hết hạn')).toBeInTheDocument()
    expect(screen.getByText('24/10/2026 08:10')).toBeInTheDocument()
    expired.unmount()
    renderAt('technician', '/chap-nhan-loi-moi', '/chap-nhan-loi-moi', <AcceptInvitationPage />)
    expect(await screen.findByText('Liên kết không hợp lệ')).toBeInTheDocument()
  })

  it('accepts the invitation with the matching email', async () => {
    const user = userEvent.setup()
    renderAt('technician', '/chap-nhan-loi-moi?token=mock-invitation-token', '/chap-nhan-loi-moi', <AcceptInvitationPage />)
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
