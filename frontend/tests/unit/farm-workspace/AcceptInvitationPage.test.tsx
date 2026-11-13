import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { BackendError } from '../../../src/api/backendClient'
import { clearCurrentFarmId, pageLoader, readCurrentFarmId } from '../../../src/api/currentFarm'
import { SessionContext, type Session } from '../../../src/features/authorization/sessionContext'
import AcceptInvitationPage from '../../../src/features/farm-workspace/pages/AcceptInvitationPage'

const api = vi.hoisted(() => ({ previewInvitation: vi.fn(), acceptInvitation: vi.fn(), selectFarm: vi.fn() }))
vi.mock('../../../src/features/farm-workspace/api/farmWorkspaceApi', () => ({ farmWorkspaceApi: api }))

const invitee: Session = { role: 'OWNER', fullName: 'Người mới', email: 'moi@example.test', farmId: null, farmName: null, ownerRegistrationCompleted: false, logout: vi.fn().mockResolvedValue(undefined) }
const pending = {
  status: 'PENDING', farmId: 77, farmName: 'Trại Ba Vì', timeZone: 'Asia/Bangkok', email: 'moi@example.test', role: 'MANAGER',
  invitedBy: 'Nguyễn Văn Hùng', sentAt: '2026-11-14T02:00:00Z', expiresAt: '2026-11-21T02:00:00Z',
}
const open = (path = '/invitation/accept?token=tok-1') => render(
  <SessionContext.Provider value={invitee}>
    <MemoryRouter initialEntries={[path]}><Routes>
      <Route path="/invitation/accept" element={<AcceptInvitationPage />} />
      <Route path="/chon-trai" element={<p>Chọn trang trại</p>} />
      <Route path="/" element={<p>Trang chủ</p>} />
    </Routes></MemoryRouter>
  </SessionContext.Provider>,
)
const load = () => vi.spyOn(pageLoader, 'load').mockImplementation(() => undefined)

beforeEach(() => {
  vi.resetAllMocks()
  invitee.logout = vi.fn().mockResolvedValue(undefined)
  api.previewInvitation.mockResolvedValue(pending)
  api.acceptInvitation.mockResolvedValue({ membershipId: 501, farmId: 77, farmName: 'Trại Ba Vì', role: 'MANAGER' })
  api.selectFarm.mockResolvedValue({ id: 77, name: 'Trại Ba Vì', role: 'MANAGER', serviceStatus: 'ACTIVE' })
  localStorage.clear()
})
afterEach(() => { vi.restoreAllMocks(); clearCurrentFarmId() })

describe('UC-FE03-04 / SCR-15', () => {
  it('shows the farm, inviter, last send and expiry in the farm time zone with the role permissions', async () => {
    open()
    expect(await screen.findByText('Chờ bạn chấp nhận')).toBeInTheDocument()
    expect(api.previewInvitation).toHaveBeenCalledWith('tok-1', 'moi@example.test')
    expect(screen.getByText('Nguyễn Văn Hùng')).toBeInTheDocument()
    expect(screen.getByText('14/11/2026 09:00')).toBeInTheDocument()
    expect(screen.getByText('21/11/2026 09:00')).toBeInTheDocument()
    expect(screen.getByText('Thư điện tử được mời').nextSibling).toHaveTextContent('moi@example.test')
    expect(screen.getByText('Thư điện tử đang đăng nhập').nextSibling).toHaveTextContent('moi@example.test')
    expect(screen.getByText('Quyền của vai trò')).toBeInTheDocument()
  })

  it('keeps the invitation pending when the person decides later (AF1)', async () => {
    const user = userEvent.setup(); open()
    await user.click(await screen.findByRole('button', { name: 'Để sau' }))
    expect(await screen.findByText('Chọn trang trại')).toBeInTheDocument()
    expect(api.acceptInvitation).not.toHaveBeenCalled()
  })

  it('accepts, shows MSG-FE03-10, keeps the joined farm and opens the role home with a fresh session', async () => {
    const user = userEvent.setup(); const loader = load(); open()
    await user.click(await screen.findByRole('button', { name: 'Chấp nhận & vào trại' }))
    expect(await screen.findByText('Bạn đã tham gia Trại Ba Vì với vai trò Quản lý.')).toBeInTheDocument()
    await waitFor(() => expect(loader).toHaveBeenCalledWith('/tong-quan'), { timeout: 3000 })
    expect(api.selectFarm).toHaveBeenCalledWith(77)
    expect(readCurrentFarmId()).toBe(77)
    expect(api.acceptInvitation).toHaveBeenCalledTimes(1)
  })

  it('switches to the no-longer-valid state with the status when acceptance finds the link cancelled', async () => {
    const user = userEvent.setup()
    api.acceptInvitation.mockRejectedValue(new BackendError(400, { code: 'MSG-FE03-08', params: { status: 'CANCELLED', expiresAt: '2026-11-21T02:00:00Z' } }))
    open()
    await user.click(await screen.findByRole('button', { name: 'Chấp nhận & vào trại' }))
    expect(await screen.findByText('Lời mời không còn hiệu lực')).toBeInTheDocument()
    expect(screen.getByText('Lời mời không còn hiệu lực (Đã hủy). Hết hạn lúc 21/11/2026 09:00.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Liên hệ BeefCare' })).toBeInTheDocument()
  })

  it('keeps the review open and the button usable after a save failure', async () => {
    const user = userEvent.setup()
    api.acceptInvitation.mockRejectedValueOnce(new BackendError(500, { code: 'MSG-COM-02' }))
    open()
    await user.click(await screen.findByRole('button', { name: 'Chấp nhận & vào trại' }))
    expect(await screen.findByText('Máy chủ chưa xử lý được yêu cầu. Dữ liệu chưa được xác nhận đã lưu.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Chấp nhận & vào trại' })).toBeEnabled()
  })

  it('hides the farm for another e-mail and remembers the link before signing out to switch account', async () => {
    const user = userEvent.setup()
    api.previewInvitation.mockRejectedValue(new BackendError(403, { code: 'MSG-FE03-09' }))
    open()
    expect(await screen.findByText('Lời mời này được gửi tới email khác. Hãy đăng nhập bằng email được mời để chấp nhận.')).toBeInTheDocument()
    expect(screen.queryByText('Trại Ba Vì')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Chấp nhận & vào trại' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Đăng xuất để đổi tài khoản' }))
    expect(invitee.logout).toHaveBeenCalled()
    expect(JSON.parse(localStorage.getItem('beefcare.pendingInvitation') ?? '{}').path).toBe('/invitation/accept?token=tok-1')
  })

  it('explains that an inactive farm keeps the invitation pending (E3)', async () => {
    api.previewInvitation.mockRejectedValue(new BackendError(403, { code: 'MSG-FE03-04' }))
    open()
    expect(await screen.findByText('Trang trại chưa thể nhận thành viên')).toBeInTheDocument()
    expect(screen.getByText(/Lời mời vẫn đang chờ/)).toBeInTheDocument()
  })

  it('offers a retry when the invitation cannot be loaded', async () => {
    const user = userEvent.setup()
    api.previewInvitation.mockRejectedValueOnce(new Error('network')).mockResolvedValue(pending)
    open()
    await user.click(await screen.findByRole('button', { name: /Thử lại/ }))
    expect(await screen.findByText('Chờ bạn chấp nhận')).toBeInTheDocument()
    expect(api.previewInvitation).toHaveBeenCalledTimes(2)
  })

  it('shows the existing membership when the accepted link is reopened (AF2) and enters through the farm check', async () => {
    const user = userEvent.setup()
    api.previewInvitation.mockResolvedValue({ ...pending, status: 'ACCEPTED', membershipId: 501 })
    api.selectFarm.mockResolvedValue({ id: 77, name: 'Trại Ba Vì', role: 'MANAGER', serviceStatus: 'SUSPENDED' })
    const loader = load(); open()
    expect(await screen.findByText('Bạn đã là thành viên của Trại Ba Vì với vai trò Quản lý.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Vào trại' }))
    expect(await screen.findByText(/Trại Ba Vì không khả dụng/)).toBeInTheDocument()
    expect(loader).not.toHaveBeenCalled()
    expect(api.acceptInvitation).not.toHaveBeenCalled()
  })
})
