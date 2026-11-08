import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { BackendError } from '../../../src/api/backendClient'
import { pageLoader, readCurrentFarmId } from '../../../src/api/currentFarm'
import { SessionContext, type Session } from '../../../src/features/authorization/sessionContext'
import { farmWorkspaceApi } from '../../../src/features/farm-workspace/api/farmWorkspaceApi'
import { farmAction } from '../../../src/features/farm-workspace/components/FarmCard'
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
function SubscriptionPage() {
  const location = useLocation()
  return <p>Trang gói dịch vụ {location.search}</p>
}
const renderAt = (who: string, path: string | { pathname: string; state?: unknown }, route: string, element: JSX.Element) => render(
  <SessionContext.Provider value={sessions[who]}>
    <MemoryRouter initialEntries={[path]}><Routes>
      <Route path={route} element={element} />
      <Route path="/goi-dich-vu" element={<SubscriptionPage />} />
      <Route path="/tong-quan" element={<p>Trang chủ trại</p>} />
      <Route path="/dang-ky-goi" element={<PlanSelection />} />
      <Route path="/owner-registration" element={<p>SCR-07 Hoàn tất hồ sơ chủ trại</p>} />
    </Routes></MemoryRouter>
  </SessionContext.Provider>,
)

describe('Select Farm (UC-FE02-02)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    sessionStorage.clear()
  })

  const cardOf = async (name: string) => (await screen.findByRole('heading', { name })).closest('article') as HTMLElement

  it('shows each farm with its place, role, herd size, service and the action its role and status allow', async () => {
    renderAt('owner', '/chon-trai', '/chon-trai', <FarmSelectPage />)
    expect(await screen.findByText('Trại Tản Lĩnh')).toBeInTheDocument()
    expect(screen.getByText('4 trang trại bạn có quyền truy cập')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Vào trại' })).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Thanh toán để kích hoạt' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Gửi phiếu hỗ trợ' })).toBeEnabled()
    expect(screen.getByText('Đến 14/11/2026')).toBeInTheDocument()
    // SCR-09 field 7 is the same for every role: the Manager card also shows the service end date.
    expect(screen.getByText('Đến 31/03/2027')).toBeInTheDocument()
    expect(screen.getByText('Chưa có kỳ dịch vụ')).toBeInTheDocument()
    expect(screen.getByText('Đang tạm ngưng')).toBeInTheDocument()
  })

  it.each([
    ['OWNER', 'ACTIVE', 'Vào trại', '/tong-quan'],
    ['MANAGER', 'ACTIVE', 'Vào trại', '/tong-quan'],
    ['TECHNICIAN', 'ACTIVE', 'Vào trại', '/kt'],
    ['OWNER', 'PENDING_PAYMENT', 'Thanh toán để kích hoạt', '/dang-ky-goi?farm=8&from=chon-trai'],
    ['OWNER', 'EXPIRED', 'Gia hạn', '/goi-dich-vu/gia-han?farm=8&from=chon-trai'],
    ['OWNER', 'SUSPENDED', 'Gửi phiếu hỗ trợ', '/ho-tro/moi?category=FARM_SERVICE&farmId=8'],
    ['MANAGER', 'EXPIRED', 'Chủ trại quản lý gói dịch vụ', null],
    ['TECHNICIAN', 'SUSPENDED', 'Chủ trại quản lý gói dịch vụ', null],
  ] as const)('SCR-09 card action: %s + %s → "%s" (%s)', (role, serviceStatus, label, to) => {
    expect(farmAction({ id: 8, name: 'Trại 8', role, serviceStatus, version: 1 })).toMatchObject({ label, to, disabled: to === null })
  })

  it('rechecks access, keeps the farm for this tab and reloads into its home (steps 3-5, R-02-12)', async () => {
    const user = userEvent.setup()
    const load = vi.spyOn(pageLoader, 'load').mockImplementation(() => undefined)
    const select = vi.spyOn(farmWorkspaceApi, 'selectFarm')
    renderAt('owner', '/chon-trai', '/chon-trai', <FarmSelectPage />)
    await user.click(within(await cardOf('Trại bò Yên Bài – Ba Vì')).getByRole('button', { name: 'Vào trại' }))
    await waitFor(() => expect(load).toHaveBeenCalledWith('/tong-quan'))
    expect(select).toHaveBeenCalledWith(1)
    expect(readCurrentFarmId()).toBe(1)
  })

  it('AF1 makes the PENDING_PAYMENT farm current and opens plan selection (SCR-58) for it', async () => {
    const user = userEvent.setup()
    const load = vi.spyOn(pageLoader, 'load').mockImplementation(() => undefined)
    renderAt('owner', '/chon-trai', '/chon-trai', <FarmSelectPage />)
    await user.click(await screen.findByRole('button', { name: 'Thanh toán để kích hoạt' }))
    await waitFor(() => expect(load).toHaveBeenCalledWith('/dang-ky-goi?farm=2&from=chon-trai'))
    expect(readCurrentFarmId()).toBe(2)
  })

  it('TC-02-11 shows a Manager the farm that is not ACTIVE as a locked card with MSG-FE02-04', async () => {
    vi.spyOn(farmWorkspaceApi, 'listFarms').mockResolvedValue([
      { id: 3, name: 'Trại Cẩm Lĩnh', role: 'MANAGER', serviceStatus: 'ACTIVE', version: 1 },
      { id: 6, name: 'Trại Đồng Xoài', role: 'MANAGER', serviceStatus: 'EXPIRED', version: 1, serviceUntil: '2026-09-30' },
    ])
    renderAt('manager', '/chon-trai', '/chon-trai', <FarmSelectPage />)
    const locked = await cardOf('Trại Đồng Xoài')
    expect(within(locked).getByRole('button', { name: 'Chủ trại quản lý gói dịch vụ' })).toBeDisabled()
    expect(within(locked).getByText('Trại Đồng Xoài không khả dụng vì dịch vụ đang ở trạng thái Đã hết hạn. Vui lòng liên hệ Chủ trại.')).toBeInTheDocument()
  })

  it('shows the last day of service like SCR-57: the backend end time is exclusive', async () => {
    // 15/11/2026 00:00 in Asia/Ho_Chi_Minh ends the period, so the last day of service is 14/11/2026.
    vi.spyOn(farmWorkspaceApi, 'listFarms').mockResolvedValue([
      { id: 1, name: 'Trại bò Yên Bài – Ba Vì', role: 'OWNER', serviceStatus: 'ACTIVE', version: 1, serviceUntil: '2026-11-14T17:00:00Z' },
    ])
    renderAt('owner', '/chon-trai', '/chon-trai', <FarmSelectPage />)
    expect(await screen.findByText('Đến 14/11/2026')).toBeInTheDocument()
  })

  it('E1 shows MSG-COM-01 and reloads the list when the membership was removed after the list was shown', async () => {
    const user = userEvent.setup()
    const load = vi.spyOn(pageLoader, 'load').mockImplementation(() => undefined)
    const list = vi.spyOn(farmWorkspaceApi, 'listFarms')
    vi.spyOn(farmWorkspaceApi, 'selectFarm').mockRejectedValueOnce(new BackendError(403, { code: 'MSG-COM-01', params: {} }))
    renderAt('owner', '/chon-trai', '/chon-trai', <FarmSelectPage />)
    await user.click(within(await cardOf('Trại bò Yên Bài – Ba Vì')).getByRole('button', { name: 'Vào trại' }))
    expect(await screen.findByText(/^Bạn không có quyền thực hiện thao tác này\./)).toBeInTheDocument()
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2))
    expect(load).not.toHaveBeenCalled()
    expect(readCurrentFarmId()).toBeNull()
  })

  it('AF3 also applies when the service stopped after the list was shown (MSG-FE02-04 from the backend)', async () => {
    const user = userEvent.setup()
    const load = vi.spyOn(pageLoader, 'load').mockImplementation(() => undefined)
    vi.spyOn(farmWorkspaceApi, 'selectFarm').mockRejectedValueOnce(new BackendError(403, { code: 'MSG-FE02-04', params: { farm: 'Trại Cẩm Lĩnh', status: 'EXPIRED' } }))
    renderAt('manager', '/chon-trai', '/chon-trai', <FarmSelectPage />)
    await user.click(within(await cardOf('Trại Cẩm Lĩnh')).getByRole('button', { name: 'Vào trại' }))
    expect(await screen.findByText(/^Trại Cẩm Lĩnh không khả dụng vì dịch vụ đang ở trạng thái Đã hết hạn\./)).toBeInTheDocument()
    expect(load).not.toHaveBeenCalled()
  })

  it('does not reload into a farm it could not keep for this tab', async () => {
    const user = userEvent.setup()
    const load = vi.spyOn(pageLoader, 'load').mockImplementation(() => undefined)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    renderAt('owner', '/chon-trai', '/chon-trai', <FarmSelectPage />)
    await user.click(within(await cardOf('Trại bò Yên Bài – Ba Vì')).getByRole('button', { name: 'Vào trại' }))
    expect(await screen.findByText(/Trình duyệt đang chặn lưu dữ liệu/)).toBeInTheDocument()
    expect(load).not.toHaveBeenCalled()
  })

  it('AF4 opens the only available farm directly after sign-in, but not from the farm switcher', async () => {
    const load = vi.spyOn(pageLoader, 'load').mockImplementation(() => undefined)
    const only = { id: 3, name: 'Trại Cẩm Lĩnh', role: 'TECHNICIAN' as const, serviceStatus: 'ACTIVE' as const, version: 1 }
    vi.spyOn(farmWorkspaceApi, 'listFarms').mockResolvedValue([only])
    vi.spyOn(farmWorkspaceApi, 'selectFarm').mockResolvedValue(only)
    const switcher = renderAt('technician', '/chon-trai', '/chon-trai', <FarmSelectPage />)
    expect(await screen.findByRole('heading', { name: 'Trại Cẩm Lĩnh' })).toBeInTheDocument()
    expect(load).not.toHaveBeenCalled()
    switcher.unmount()
    renderAt('technician', { pathname: '/chon-trai', state: { fromSignIn: true } }, '/chon-trai', <FarmSelectPage />)
    await waitFor(() => expect(load).toHaveBeenCalledWith('/kt'))
    expect(readCurrentFarmId()).toBe(3)
  })

  it('opens SCR-07 first when the Owner profile is not complete (SCR-09 "Register new farm")', async () => {
    const user = userEvent.setup()
    const profile = await farmWorkspaceApi.getProfile()
    vi.spyOn(farmWorkspaceApi, 'getProfile').mockResolvedValue({ ...profile, ownerRegistrationCompleted: false })
    renderAt('owner', '/chon-trai', '/chon-trai', <FarmSelectPage />)
    await screen.findByRole('heading', { name: 'Trại Tản Lĩnh' })
    await user.click(screen.getByRole('button', { name: 'Đăng ký trại mới' }))
    expect(await screen.findByText('SCR-07 Hoàn tất hồ sơ chủ trại')).toBeInTheDocument()
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

describe('Farm Information (UC-FE02-03)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    sessionStorage.clear()
  })

  const save = () => screen.getByRole('button', { name: 'Lưu thay đổi' })

  it('lets the Owner edit and save with MSG-FE02-05, and validates the name', async () => {
    const user = userEvent.setup()
    renderAt('owner', '/thong-tin-trai', '/thong-tin-trai', <FarmInformationPage />)
    const name = await screen.findByLabelText('Tên trại *')
    expect(await screen.findByText('owner@beefcare.local')).toBeInTheDocument()
    await user.clear(name)
    await user.click(save())
    expect(await screen.findByText('Tên trại cần có từ 2 đến 150 ký tự.')).toBeInTheDocument()
    await user.type(name, 'Trại bò Yên Bài – Ba Vì')
    await user.click(save())
    expect(await screen.findByText('Đã cập nhật thông tin trại.')).toBeInTheDocument()
  })

  it('TC-02-17, decision 4b: a Manager is sent to their home and the farm is not loaded', async () => {
    const getFarm = vi.spyOn(farmWorkspaceApi, 'getFarm')
    renderAt('manager', '/thong-tin-trai', '/thong-tin-trai', <FarmInformationPage />)
    expect(await screen.findByText('Trang chủ trại')).toBeInTheDocument()
    expect(getFarm).not.toHaveBeenCalled()
  })

  it('shows the service summary from the backend: last day of the period, renewal, suspension and days left (Q4)', async () => {
    const farm = await farmWorkspaceApi.getFarm(1)
    vi.spyOn(farmWorkspaceApi, 'getFarm').mockResolvedValue({
      ...farm, serviceStatus: 'SUSPENDED', serviceUntil: '2026-12-31T17:00:00Z', renewalOpensAt: '2026-10-02T17:00:00Z',
      suspendedAt: '2026-11-01T03:00:00Z', daysRemaining: 60, ownerEmail: 'owner@beefcare.local',
    })
    renderAt('owner', '/thong-tin-trai', '/thong-tin-trai', <FarmInformationPage />)
    // The period ends at 01/01/2027 00:00 (exclusive), so its last day is 31/12/2026, as SCR-57 shows it.
    expect(await screen.findByText('31/12/2026')).toBeInTheDocument()
    expect(screen.getByText('03/10/2026')).toBeInTheDocument()
    expect(screen.getByText('Có · 01/11/2026')).toBeInTheDocument()
    expect(screen.getByText('60 ngày')).toBeInTheDocument()
  })

  it('opens the subscription of this farm (SCR-57)', async () => {
    const user = userEvent.setup()
    renderAt('owner', '/thong-tin-trai', '/thong-tin-trai', <FarmInformationPage />)
    await user.click(await screen.findByRole('button', { name: 'Xem gói dịch vụ' }))
    expect(await screen.findByText('Trang gói dịch vụ ?farm=1')).toBeInTheDocument()
  })

  it('sends the same request key again when the Owner retries after a failure (GBR-88)', async () => {
    const user = userEvent.setup()
    const update = vi.spyOn(farmWorkspaceApi, 'updateFarm').mockRejectedValueOnce(new Error('Mất kết nối mạng.'))
    renderAt('owner', '/thong-tin-trai', '/thong-tin-trai', <FarmInformationPage />)
    const name = await screen.findByLabelText('Tên trại *')
    await user.clear(name)
    await user.type(name, 'Trại Yên Bài mới')
    await user.click(save())
    expect(await screen.findByText('Mất kết nối mạng.')).toBeInTheDocument()
    await user.click(save())
    await waitFor(() => expect(update).toHaveBeenCalledTimes(2))
    const [firstKey, secondKey] = update.mock.calls.map((call) => call[2]?.idempotencyKey)
    expect(firstKey).toBeTruthy()
    expect(secondKey).toBe(firstKey)
    expect(await screen.findByText('Đã cập nhật thông tin trại.')).toBeInTheDocument()
  })

  it('asks for a province from the list when the saved one is not among the 34 (Q3)', async () => {
    const user = userEvent.setup()
    const farm = await farmWorkspaceApi.getFarm(1)
    vi.spyOn(farmWorkspaceApi, 'getFarm').mockResolvedValue({ ...farm, province: 'Hà Tây' })
    const update = vi.spyOn(farmWorkspaceApi, 'updateFarm')
    renderAt('owner', '/thong-tin-trai', '/thong-tin-trai', <FarmInformationPage />)
    expect(await screen.findByLabelText('Tỉnh/Thành *')).toHaveValue('Hà Tây')
    await user.click(save())
    expect(await screen.findByText('Chọn tỉnh hoặc thành phố trong danh sách.')).toBeInTheDocument()
    expect(update).not.toHaveBeenCalled()
  })
})
