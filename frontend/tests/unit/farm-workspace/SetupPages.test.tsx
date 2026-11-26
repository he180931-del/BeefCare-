import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { pageLoader, readCurrentFarmId } from '../../../src/app/session/currentFarm'
import { SessionContext, type Session } from '../../../src/app/session/sessionContext'
import AcceptInvitationPage from '../../../src/features/farm-workspace/pages/AcceptInvitationPage'
import FarmInformationPage from '../../../src/features/farm-workspace/pages/FarmInformationPage'
import FarmRegistrationPage from '../../../src/features/farm-workspace/pages/FarmRegistrationPage'
import FarmSelectPage from '../../../src/features/farm-workspace/pages/FarmSelectPage'
import { farmWorkspaceApi } from '../../../src/features/farm-workspace/api/farmWorkspaceApi'

const farm = { farmId: 1, farmName: 'Trại bò Yên Bài – Ba Vì' }
function Where() {
  const location = useLocation()
  return <output data-testid="where">{location.pathname + location.search}</output>
}
const sessions: Record<string, Session> = {
  owner: { role: 'OWNER', fullName: 'Nguyễn Văn Hùng', email: 'owner@beefcare.local', ...farm, logout: vi.fn() },
  manager: { role: 'MANAGER', fullName: 'Trần Quốc Long', email: 'manager@beefcare.local', ...farm, logout: vi.fn() },
  technician: { role: 'TECHNICIAN', fullName: 'Lê Thị Mai', email: 'technician@beefcare.local', ...farm, logout: vi.fn() },
}
const renderAt = (who: string, path: string, route: string, element: JSX.Element) => render(
  <SessionContext.Provider value={sessions[who]}>
    <MemoryRouter initialEntries={[path]}><Routes><Route path={route} element={element} /><Route path="/dang-ky-goi" element={<p>Trang gói dịch vụ</p>} /><Route path="/tong-quan" element={<p>Trang chủ trại</p>} /></Routes></MemoryRouter>
  </SessionContext.Provider>,
)

describe('Select Farm', () => {
  const openWithState = (state: unknown) => render(
    <SessionContext.Provider value={sessions.owner}>
      <MemoryRouter initialEntries={[{ pathname: '/chon-trai', state }]}><Routes><Route path="/chon-trai" element={<FarmSelectPage />} /></Routes></MemoryRouter>
    </SessionContext.Provider>,
  )

  it('comes back to the farm screen that asked for a farm once one is entered (deep link in a new tab)', async () => {
    const load = vi.spyOn(pageLoader, 'load').mockImplementation(() => undefined)
    const user = userEvent.setup()
    openWithState({ returnTo: '/cattle/BC-000142?tab=vaccine' })
    await user.click((await screen.findAllByRole('button', { name: 'Vào trại' }))[0])
    await waitFor(() => expect(load).toHaveBeenCalledWith('/cattle/BC-000142?tab=vaccine'))
    load.mockRestore()
  })

  it('opens the only ACTIVE farm directly (AF4) and returns to the requested screen', async () => {
    const active = (await farmWorkspaceApi.listFarms()).find((farm) => farm.serviceStatus === 'ACTIVE')!
    const list = vi.spyOn(farmWorkspaceApi, 'listFarms').mockResolvedValue([active])
    const load = vi.spyOn(pageLoader, 'load').mockImplementation(() => undefined)
    const replace = vi.spyOn(pageLoader, 'replace').mockImplementation(() => undefined)
    openWithState({ fromSignIn: true, returnTo: '/pens' })
    // Select Farm leaves the history: Back must not reopen it and enter the farm again.
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/pens'))
    expect(load).not.toHaveBeenCalled()
    load.mockRestore()
    replace.mockRestore()
    list.mockRestore()
  })

  it('opens the payment page of a farm that cannot be entered yet, keeping the farm of the tab and ignoring returnTo', async () => {
    const load = vi.spyOn(pageLoader, 'load').mockImplementation(() => undefined)
    const user = userEvent.setup()
    render(
      <SessionContext.Provider value={sessions.owner}>
        <MemoryRouter initialEntries={[{ pathname: '/chon-trai', state: { returnTo: '/cattle' } }]}><Routes>
          <Route path="/chon-trai" element={<FarmSelectPage />} />
          <Route path="/dang-ky-goi" element={<Where />} />
        </Routes></MemoryRouter>
      </SessionContext.Provider>,
    )
    await user.click(await screen.findByRole('button', { name: 'Thanh toán để kích hoạt' }))
    expect(await screen.findByTestId('where')).toHaveTextContent(/^\/dang-ky-goi\?farm=\d+&from=chon-trai$/)
    expect(load).not.toHaveBeenCalled()
    expect(readCurrentFarmId()).toBe(1)
    load.mockRestore()
  })

  it('ignores a return address outside the app and opens the farm home instead', async () => {
    const load = vi.spyOn(pageLoader, 'load').mockImplementation(() => undefined)
    const user = userEvent.setup()
    openWithState({ returnTo: '//evil.example/steal' })
    await user.click((await screen.findAllByRole('button', { name: 'Vào trại' }))[0])
    await waitFor(() => expect(load).toHaveBeenCalledWith('/tong-quan'))
    load.mockRestore()
  })

  it('shows each farm with its role, size and the action its service state allows', async () => {
    renderAt('owner', '/chon-trai', '/chon-trai', <FarmSelectPage />)
    expect(await screen.findByText('Trại Tản Lĩnh')).toBeInTheDocument()
    expect(screen.getByText('Số lượng trang trại: 4 trang trại')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Vào trại' })).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Thanh toán để kích hoạt' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Gửi phiếu hỗ trợ' })).toBeEnabled()
    expect(screen.getByText('Đến 14/11/2026')).toBeInTheDocument()
    expect(screen.getAllByText('Chưa có kỳ dịch vụ').length).toBeGreaterThan(0)
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
  it('"Quay lại" on a page opened straight from a link goes to Select Farm instead of leaving the app (SCR-10 #11)', async () => {
    const user = userEvent.setup()
    render(<SessionContext.Provider value={sessions.owner}><MemoryRouter initialEntries={['/dang-ky-trai']}><Routes>
      <Route path="/dang-ky-trai" element={<FarmRegistrationPage />} /><Route path="/chon-trai" element={<p>Trang chọn trại</p>} />
    </Routes></MemoryRouter></SessionContext.Provider>)
    await user.click(await screen.findByRole('button', { name: /Quay lại/ }))
    expect(await screen.findByText('Trang chọn trại')).toBeInTheDocument()
  })

  it('validates the required fields, then creates the farm and opens plan selection', async () => {
    const user = userEvent.setup()
    renderAt('owner', '/dang-ky-trai', '/dang-ky-trai', <FarmRegistrationPage />)
    await user.click(await screen.findByRole('button', { name: /Tạo trại và tiếp tục/ }))
    expect(await screen.findByText('Tên trại là bắt buộc.')).toBeInTheDocument() // MSG-COM-06
    // The invalid fields are marked for assistive technology (and drawn with a red border), as on SCR-51.
    expect(screen.getByLabelText('Tên trại *')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Tỉnh/Thành *')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Người liên hệ')).not.toHaveAttribute('aria-invalid')

    await user.type(screen.getByLabelText('Tên trại *'), 'Trại Thung Mây')
    await user.selectOptions(screen.getByLabelText('Tỉnh/Thành *'), 'Phú Thọ')
    await user.type(screen.getByLabelText('Xã/Phường *'), 'Xã Minh Đài')
    await user.selectOptions(screen.getByLabelText('Quy mô dự kiến'), '150_300')
    await user.click(screen.getByRole('button', { name: /Tạo trại và tiếp tục/ }))
    expect(await screen.findByText('Trang gói dịch vụ')).toBeInTheDocument()
  })
})

describe('Accept Invitation', () => {
  it('hides the farm details when the signed-in email differs from the invited one', async () => {
    renderAt('owner', '/invitation/accept?token=mock-invitation-token', '/invitation/accept', <AcceptInvitationPage />)
    expect(await screen.findByText('Lời mời này được gửi tới email khác. Hãy đăng nhập bằng email được mời để chấp nhận.')).toBeInTheDocument()
    expect(screen.queryByText('Trang trại')).not.toBeInTheDocument()
    expect(screen.queryByText('Trại bò Yên Bài – Ba Vì')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Chấp nhận & vào trại' })).not.toBeInTheDocument()
  })

  it('shows the expired state for an expired or unknown link', async () => {
    const expired = renderAt('technician', '/invitation/accept?token=mock-invitation-expired', '/invitation/accept', <AcceptInvitationPage />)
    expect(await screen.findByText('Lời mời không còn hiệu lực')).toBeInTheDocument()
    expect(screen.getByText('Hết hạn')).toBeInTheDocument()
    expect(screen.getByText('Lời mời không còn hiệu lực (Hết hạn). Hết hạn lúc 24/10/2026 08:10.')).toBeInTheDocument()
    expired.unmount()
    renderAt('technician', '/invitation/accept', '/invitation/accept', <AcceptInvitationPage />)
    expect(await screen.findByText('Lời mời không còn hiệu lực (Liên kết không hợp lệ).')).toBeInTheDocument()
  })

  it('accepts the invitation with the matching email', async () => {
    const user = userEvent.setup()
    const load = vi.spyOn(pageLoader, 'load').mockImplementation(() => undefined)
    renderAt('technician', '/invitation/accept?token=mock-invitation-token', '/invitation/accept', <AcceptInvitationPage />)
    expect(await screen.findByText('Chờ bạn chấp nhận')).toBeInTheDocument()
    expect(screen.getByText('Xem hồ sơ bò qua quét QR hoặc danh sách')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Chấp nhận & vào trại' }))
    expect(await screen.findByText('Bạn đã tham gia Trại bò Yên Bài – Ba Vì với vai trò Kỹ thuật viên.')).toBeInTheDocument()
    // then the Technician home of the joined farm opens with a fresh session (SCR-74, D28)
    await waitFor(() => expect(load).toHaveBeenCalledWith('/kt'), { timeout: 3000 })
  })
})

describe('Farm Information', () => {
  it('lets the Owner edit and save, and validates the name', async () => {
    const user = userEvent.setup()
    renderAt('owner', '/thong-tin-trai', '/thong-tin-trai', <FarmInformationPage />)
    const name = await screen.findByLabelText('Tên trại *')
    expect(screen.getByLabelText('Múi giờ')).toHaveValue('UTC+7 (giờ Việt Nam)')
    expect(screen.getByLabelText('Múi giờ')).toHaveAttribute('readonly')
    expect(await screen.findByText('owner@beefcare.local')).toBeInTheDocument()
    await user.clear(name)
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    expect(await screen.findByText('Tên trại là bắt buộc.')).toBeInTheDocument() // MSG-COM-06
    expect(name).toHaveAttribute('aria-invalid', 'true')
    await user.type(name, 'Trại bò Yên Bài – Ba Vì')
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    expect(await screen.findByText('Đã cập nhật thông tin trại.')).toBeInTheDocument()
  })

  it('redirects a Manager away from the Owner-only farm information page', async () => {
    renderAt('manager', '/thong-tin-trai', '/thong-tin-trai', <FarmInformationPage />)
    expect(await screen.findByText('Trang chủ trại')).toBeInTheDocument()
    expect(screen.queryByLabelText('Tên trại *')).not.toBeInTheDocument()
  })
})
