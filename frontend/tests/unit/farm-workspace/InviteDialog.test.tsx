import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { BackendError } from '../../../src/api/backendClient'
import { SessionContext, type Session } from '../../../src/features/authorization/sessionContext'
import MembersPage from '../../../src/features/farm-workspace/pages/MembersPage'
import InvitationsPage from '../../../src/features/farm-workspace/pages/InvitationsPage'

const api = vi.hoisted(() => ({
  getFarm: vi.fn(), listMembers: vi.fn(), listInvitations: vi.fn(),
  inviteMember: vi.fn(), resendInvitation: vi.fn(), changeMember: vi.fn(),
}))
vi.mock('../../../src/features/farm-workspace/api/farmWorkspaceApi', () => ({ farmWorkspaceApi: api }))

const farm = { id: 401, name: 'Trại kiểm thử', role: 'OWNER', serviceStatus: 'ACTIVE', version: 1 }
const member = { id: 52, userId: 152, email: 'inactive@example.test', fullName: 'Thành viên đã ngưng', role: 'MANAGER', status: 'INACTIVE', joinedAt: '2026-01-01T03:00:00Z', version: 4, actions: ['REACTIVATE'] }
// A1 (D29): the whole list with the farm name, time zone and service status SCR-13 needs.
const memberList = (changes = {}) => ({ farmName: 'Trại kiểm thử', timeZone: 'Asia/Ho_Chi_Minh', serviceStatus: 'ACTIVE', counts: { all: 1, managers: 0, technicians: 0, inactive: 1 }, items: [member], ...changes })
const invitation = { id: 76, email: 'pending@example.test', role: 'MANAGER', status: 'PENDING', validityDays: 7, createdAt: '2026-11-11T03:00:00Z', lastSentAt: '2026-11-11T03:00:00Z', expiresAt: '2026-11-18T03:00:00Z', version: 3 }
const owner: Session = { role: 'OWNER', fullName: 'Chủ trại kiểm thử', email: 'owner@example.test', farmId: farm.id, farmName: farm.name, logout: vi.fn() }
const open = (path = '/loi-moi') => render(
  <SessionContext.Provider value={owner}><MemoryRouter initialEntries={[`${path}?farmId=${farm.id}&m=invite`]}>
    <Routes><Route path="/loi-moi" element={<InvitationsPage />} /><Route path="/thanh-vien" element={<MembersPage />} /></Routes>
  </MemoryRouter></SessionContext.Provider>,
)
async function fill(email: string) {
  const user = userEvent.setup()
  const dialog = await screen.findByRole('dialog', { name: 'Mời thành viên' })
  await user.type(within(dialog).getByLabelText('Thư điện tử người nhận *'), email)
  await user.click(within(dialog).getByRole('button', { name: 'Kỹ thuật viên' }))
  await user.click(within(dialog).getByRole('button', { name: 'Gửi lời mời' }))
  return { user, dialog }
}

beforeEach(() => {
  vi.resetAllMocks()
  api.getFarm.mockResolvedValue(farm)
  api.listMembers.mockResolvedValue(memberList())
  api.listInvitations.mockResolvedValue({ items: [invitation], total: 1, page: 0, size: 20, counts: { PENDING: 1, ACCEPTED: 0, EXPIRED: 0, CANCELLED: 0 }, asOf: '2026-11-11T03:00:00Z' })
  api.inviteMember.mockResolvedValue({ ...invitation, id: 77, email: 'new@example.test', role: 'TECHNICIAN' })
  api.resendInvitation.mockResolvedValue({ ...invitation, version: 4 })
  api.changeMember.mockResolvedValue({ ...member, status: 'ACTIVE', version: 5, actions: ['CHANGE_ROLE', 'DEACTIVATE'] })
})

describe('UC-FE03-01 / D25', () => {
  it.each(['/loi-moi', '/thanh-vien'])('creates from %s with default 7 days, no selected role, and a queued notice with the exact expiry', async (path) => {
    open(path)
    const dialog = await screen.findByRole('dialog', { name: 'Mời thành viên' })
    expect(within(dialog).getByText('Chọn vai trò để xem các quyền cố định.')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Hết hạn sau')).toHaveValue('7')
    await fill('new@example.test')
    expect(api.inviteMember).toHaveBeenCalledWith(401, { email: 'new@example.test', role: 'TECHNICIAN', validityDays: 7 }, { idempotencyKey: expect.any(String) })
    expect(await screen.findByText(/Đã tạo lời mời tới new@example.test\. Hệ thống đang gửi email\./)).toHaveTextContent('18/11/2026 10:00')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(path === '/loi-moi' ? api.listInvitations.mock.calls.length : api.listMembers.mock.calls.length).toBeGreaterThan(1)
  })

  it.each(['/loi-moi', '/thanh-vien'])('shows the expiry in the farm time zone from %s (D26)', async (path) => {
    api.getFarm.mockResolvedValue({ ...farm, timeZone: 'UTC' })
    api.listMembers.mockResolvedValue(memberList({ timeZone: 'UTC' }))
    open(path)
    await fill('new@example.test')
    expect(await screen.findByText(/Đã tạo lời mời tới new@example.test/)).toHaveTextContent('Hết hạn lúc 18/11/2026 03:00.')
  })

  it.each(['/loi-moi', '/thanh-vien'])('offers an explicit resend from %s using the existing invitation and the observed version', async (path) => {
    api.inviteMember.mockRejectedValue(new BackendError(409, { code: 'MSG-FE03-03', params: { invitationId: 76, email: invitation.email } }))
    open(path)
    const { user, dialog } = await fill(invitation.email)
    const resend = await within(dialog).findByRole('button', { name: 'Gửi lại' })
    expect(api.listInvitations).toHaveBeenCalledWith(401, { invitationId: 76 })
    expect(api.resendInvitation).not.toHaveBeenCalled()
    expect(within(dialog).getByText(/vai trò Quản lý/)).toBeInTheDocument()
    await user.click(resend)
    expect(api.resendInvitation).toHaveBeenCalledWith(401, 76, { expectedVersion: 3, idempotencyKey: expect.any(String) })
    expect(await screen.findByText(/Hệ thống đang gửi email/)).toBeInTheDocument()
  })

  it.each(['/loi-moi', '/thanh-vien'])('opens Reactivate from %s without creating an invitation or silently changing the role', async (path) => {
    api.inviteMember.mockRejectedValue(new BackendError(409, { code: 'MSG-FE03-21', params: { membershipId: 52, email: member.email } }))
    open(path)
    const { user, dialog } = await fill(member.email)
    await user.click(await within(dialog).findByRole('button', { name: 'Kích hoạt lại' }))
    const reactivate = await screen.findByRole('dialog', { name: 'Kích hoạt lại thành viên' })
    expect(api.changeMember).not.toHaveBeenCalled()
    expect(within(reactivate).getByLabelText('Thành viên')).toHaveValue('Thành viên đã ngưng · inactive@example.test · Quản lý')
    await user.click(within(reactivate).getByRole('button', { name: 'Lưu thay đổi' }))
    expect(await within(reactivate).findByText('Nhập lý do (tối đa 500 ký tự).')).toBeInTheDocument()
    await user.type(within(reactivate).getByLabelText('Lý do * (tối đa 500 ký tự)'), 'Tiếp tục công việc')
    await user.click(within(reactivate).getByRole('button', { name: 'Lưu thay đổi' }))
    expect(api.changeMember).not.toHaveBeenCalled()
    await user.click(within(reactivate).getByRole('button', { name: 'Xác nhận thay đổi' }))
    expect(api.changeMember).toHaveBeenCalledWith(401, 52, expect.objectContaining({ action: 'REACTIVATE', role: undefined, effectiveDate: expect.any(String), reason: 'Tiếp tục công việc' }), { expectedVersion: 4, idempotencyKey: expect.any(String) })
    expect(await screen.findByText(/Đã cập nhật tư cách thành viên/)).toBeInTheDocument()
    expect(api.inviteMember).toHaveBeenCalledTimes(1)
  })

  it('shows required and format errors under each field instead of locking the send button (TC-03-01/02)', async () => {
    open()
    const user = userEvent.setup()
    const dialog = await screen.findByRole('dialog', { name: 'Mời thành viên' })
    const send = within(dialog).getByRole('button', { name: 'Gửi lời mời' })
    expect(send).toBeEnabled()
    await user.click(send)
    const email = within(dialog).getByLabelText('Thư điện tử người nhận *')
    expect(email.parentElement).toContainElement(within(dialog).getByText('Thư điện tử người nhận là bắt buộc.'))
    expect(within(dialog).getByText('Vai trò là bắt buộc.')).toBeInTheDocument()
    await user.type(email, 'abc')
    await user.click(within(dialog).getByRole('button', { name: 'Quản lý' }))
    await user.click(send)
    expect(email.parentElement).toContainElement(within(dialog).getByText('Nhập địa chỉ email hợp lệ.'))
    expect(within(dialog).queryByText('Vai trò là bắt buộc.')).not.toBeInTheDocument()
    expect(api.inviteMember).not.toHaveBeenCalled()
  })

  it('shows an existing ACTIVE member error under email and preserves the form', async () => {
    api.inviteMember.mockRejectedValue(new BackendError(409, { code: 'MSG-FE03-02' }))
    open()
    const { dialog } = await fill('active@example.test')
    const error = await within(dialog).findByText('Email này đã là thành viên đang hoạt động.')
    expect(within(dialog).getByLabelText('Thư điện tử người nhận *').parentElement).toContainElement(error)
    expect(within(dialog).getByLabelText('Thư điện tử người nhận *')).toHaveValue('active@example.test')
  })

  it('reuses the intent key after a failed request and changes it when the input changes', async () => {
    api.inviteMember.mockRejectedValue(new TypeError('Failed to fetch'))
    open()
    const { user, dialog } = await fill('new@example.test')
    await within(dialog).findByText('Failed to fetch')
    await user.click(within(dialog).getByRole('button', { name: 'Gửi lời mời' }))
    expect(api.inviteMember.mock.calls[1][2]).toEqual(api.inviteMember.mock.calls[0][2])
    await user.selectOptions(within(dialog).getByLabelText('Hết hạn sau'), '14')
    await user.click(within(dialog).getByRole('button', { name: 'Gửi lời mời' }))
    expect(api.inviteMember.mock.calls[2][2].idempotencyKey).not.toEqual(api.inviteMember.mock.calls[0][2].idempotencyKey)
  })

  it('asks before discarding entered fields and does not send on cancel', async () => {
    open()
    const user = userEvent.setup()
    const dialog = await screen.findByRole('dialog', { name: 'Mời thành viên' })
    await user.type(within(dialog).getByLabelText('Thư điện tử người nhận *'), 'new@example.test')
    await user.click(within(dialog).getByRole('button', { name: 'Hủy' }))
    await user.click(await within(dialog).findByRole('button', { name: 'Tiếp tục nhập' }))
    expect(within(dialog).getByLabelText('Thư điện tử người nhận *')).toHaveValue('new@example.test')
    await user.click(within(dialog).getByRole('button', { name: 'Hủy' }))
    await user.click(await within(dialog).findByRole('button', { name: 'Hủy thay đổi' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(api.inviteMember).not.toHaveBeenCalled()
  })
})
