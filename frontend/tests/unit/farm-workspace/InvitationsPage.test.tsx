import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import { BackendError } from '../../../src/api/backendClient'
import { SessionContext, type Session } from '../../../src/features/authorization/sessionContext'
import InvitationsPage from '../../../src/features/farm-workspace/pages/InvitationsPage'

const api = vi.hoisted(() => ({ getFarm: vi.fn(), listInvitations: vi.fn(), cancelInvitation: vi.fn(), resendInvitation: vi.fn() }))
vi.mock('../../../src/features/farm-workspace/api/farmWorkspaceApi', () => ({ farmWorkspaceApi: api }))
const owner: Session = { role: 'OWNER', email: 'owner@example.test', fullName: 'Chủ trại', farmId: 401, farmName: 'Trại kiểm thử', logout: vi.fn() }
const farm = { id: 401, name: 'Trại kiểm thử', role: 'OWNER', serviceStatus: 'ACTIVE', timeZone: 'UTC', version: 1 }
const row = (id: number) => ({ id, email: `invite${id}@example.test`, role: 'TECHNICIAN', status: 'PENDING', lastSentAt: '2026-11-12T03:00:00Z', expiresAt: '2026-11-19T03:00:00Z', validityDays: 7, version: 3, accountHint: 'NO_ACCOUNT' })
const counts = { PENDING: 23, ACCEPTED: 4, EXPIRED: 2, CANCELLED: 1 }
const page = (items = [row(23)], changes = {}) => ({ items, counts, total: 23, page: 0, size: 20, asOf: '2026-11-12T04:00:00Z', ...changes })
const open = (path = '/loi-moi?farmId=401', session = owner) => render(
  <SessionContext.Provider value={session}><MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/loi-moi" element={<InvitationsPage />} />
    <Route path="/thanh-vien" element={<Link to="/loi-moi?farmId=401">Quay lại lời mời</Link>} />
  </Routes></MemoryRouter></SessionContext.Provider>,
)

beforeEach(() => {
  vi.resetAllMocks()
  api.getFarm.mockResolvedValue(farm)
  api.listInvitations.mockImplementation(async (_id, query) => page(query?.page === 1 ? [row(3), row(2), row(1)] : Array.from({ length: 20 }, (_, i) => row(23 - i)), { page: query?.page ?? 0 }))
  api.cancelInvitation.mockResolvedValue({ ...row(23), status: 'CANCELLED' })
  api.resendInvitation.mockResolvedValue(row(23))
})

describe('UC-FE03-02 / SCR-14', () => {
  it('requests Pending newest-first, uses global counts and shows one page in the farm time zone', async () => {
    open()
    expect(await screen.findByText('invite23@example.test')).toBeInTheDocument()
    expect(api.listInvitations).toHaveBeenCalledWith(401, expect.objectContaining({ status: 'PENDING', page: 0, size: 20, sort: 'lastSentAt', dir: 'desc' }))
    expect(screen.getByRole('button', { name: 'Đang chờ (23)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Đã chấp nhận (4)' })).toBeInTheDocument()
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(21)
    expect(screen.getAllByText('12/11/2026 03:00')).toHaveLength(20)
    expect(screen.queryByText('invite3@example.test')).not.toBeInTheDocument()
  })

  it('requests the next page, keeps tab totals, and resets the page when sorting or changing status', async () => {
    const user = userEvent.setup(); open()
    await screen.findByText('invite23@example.test')
    await user.click(screen.getByRole('button', { name: 'Trang sau' }))
    expect(await screen.findByText('invite1@example.test')).toBeInTheDocument()
    expect(api.listInvitations).toHaveBeenLastCalledWith(401, expect.objectContaining({ page: 1 }))
    expect(screen.getByRole('button', { name: 'Đang chờ (23)' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Gửi lần cuối/ }))
    await waitFor(() => expect(api.listInvitations).toHaveBeenLastCalledWith(401, expect.objectContaining({ page: 0, dir: 'asc' })))
    await user.click(screen.getByRole('button', { name: 'Đã chấp nhận (4)' }))
    await waitFor(() => expect(api.listInvitations).toHaveBeenLastCalledWith(401, expect.objectContaining({ status: 'ACCEPTED', page: 0, dir: 'asc' })))
  })

  it('restores filter and sort after leaving the page and keeps preferences isolated by farm', async () => {
    const user = userEvent.setup(); const view = open('/loi-moi?farmId=401&status=EXPIRED&dir=asc')
    await screen.findByText('invite23@example.test')
    await user.click(screen.getByRole('button', { name: 'Thành viên & vai trò' }))
    await user.click(await screen.findByRole('link', { name: 'Quay lại lời mời' }))
    await waitFor(() => expect(api.listInvitations).toHaveBeenLastCalledWith(401, expect.objectContaining({ status: 'EXPIRED', dir: 'asc' })))
    view.unmount(); api.listInvitations.mockClear(); api.getFarm.mockResolvedValue({ ...farm, id: 402 })
    open('/loi-moi?farmId=402')
    await waitFor(() => expect(api.listInvitations).toHaveBeenLastCalledWith(402, expect.objectContaining({ status: 'PENDING', dir: 'desc' })))
  })

  it('refreshes on request and after cancel using the observed version', async () => {
    const user = userEvent.setup(); open(); await screen.findByText('invite23@example.test')
    const initial = api.listInvitations.mock.calls.length
    await user.click(screen.getByRole('button', { name: 'Làm mới' }))
    await waitFor(() => expect(api.listInvitations.mock.calls.length).toBe(initial + 1))
    await screen.findByText('invite23@example.test')
    await user.click(screen.getAllByRole('button', { name: 'Hủy' })[0])
    await user.click(screen.getByRole('button', { name: 'Hủy lời mời' }))
    await waitFor(() => expect(api.cancelInvitation).toHaveBeenCalledWith(401, 23, { expectedVersion: 3, idempotencyKey: expect.any(String) }))
    await waitFor(() => expect(api.listInvitations.mock.calls.length).toBe(initial + 2))
    expect(await screen.findByText('Đã hủy lời mời.')).toBeInTheDocument()
  })

  it.each(['PENDING_PAYMENT', 'EXPIRED', 'SUSPENDED'])('allows viewing and cancellation while service is %s', async (serviceStatus) => {
    api.getFarm.mockResolvedValue({ ...farm, serviceStatus })
    open(); await screen.findByText('invite23@example.test')
    expect(screen.getByRole('button', { name: 'Mời thành viên' })).toBeDisabled()
    expect(screen.getAllByRole('button', { name: 'Gửi lại' }).every(button => button.hasAttribute('disabled'))).toBe(true)
    expect(screen.getAllByRole('button', { name: 'Hủy' })[0]).toBeEnabled()
  })

  it('shows read-only Expired rows from the server even if their stored Pending period just ended', async () => {
    api.listInvitations.mockResolvedValue(page([{ ...row(1), status: 'EXPIRED' }], { total: 1 }))
    open('/loi-moi?farmId=401&status=EXPIRED')
    await screen.findByText('invite1@example.test')
    expect(screen.queryByRole('button', { name: 'Gửi lại' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Hủy' })).not.toBeInTheDocument()
  })

  it('shows an empty result with Clear filters and retries a loading failure', async () => {
    const user = userEvent.setup()
    api.listInvitations.mockRejectedValueOnce(new Error('backend unavailable')).mockResolvedValue(page([], { total: 0, counts: { PENDING: 0, ACCEPTED: 0, EXPIRED: 0, CANCELLED: 0 } }))
    open(); await user.click(await screen.findByRole('button', { name: /Thử lại/ }))
    expect(await screen.findByText(/Không có bản ghi phù hợp/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }))
    await waitFor(() => expect(api.listInvitations).toHaveBeenLastCalledWith(401, expect.objectContaining({ status: 'PENDING', page: 0, dir: 'desc' })))
  })

  it('does not request invitation data for a Manager', async () => {
    open('/loi-moi?farmId=401', { ...owner, role: 'MANAGER' })
    expect(await screen.findByText(/không có quyền/i)).toBeInTheDocument()
    expect(api.listInvitations).not.toHaveBeenCalled()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('returns to the last remaining page when cancellation empties the current page', async () => {
    const user = userEvent.setup(); let cancelled = false
    api.listInvitations.mockImplementation(async (_id, query) => query.page === 1
      ? page(cancelled ? [] : [row(1)], { total: cancelled ? 20 : 21, page: 1 })
      : page([row(21)], { total: 20 }))
    api.cancelInvitation.mockImplementation(async () => { cancelled = true; return { ...row(1), status: 'CANCELLED' } })
    open('/loi-moi?farmId=401&page=1'); await screen.findByText('invite1@example.test')
    await user.click(screen.getByRole('button', { name: 'Hủy' }))
    await user.click(screen.getByRole('button', { name: 'Hủy lời mời' }))
    expect(await screen.findByText('invite21@example.test')).toBeInTheDocument()
    expect(api.listInvitations).toHaveBeenLastCalledWith(401, expect.objectContaining({ page: 0 }))
    expect(screen.getByText('Đã hủy lời mời.')).toBeInTheDocument()
  })

  it('keeps the confirmed version when the list is refreshed while confirmation is open', async () => {
    const user = userEvent.setup(); open(); await screen.findByText('invite23@example.test')
    await user.click(screen.getAllByRole('button', { name: 'Hủy' })[0])
    api.listInvitations.mockResolvedValue(page([{ ...row(23), version: 7 }]))
    await user.click(screen.getByRole('button', { name: 'Làm mới' }))
    await user.click(await screen.findByRole('button', { name: 'Hủy lời mời' }))
    expect(api.cancelInvitation).toHaveBeenCalledWith(401, 23, { expectedVersion: 3, idempotencyKey: expect.any(String) })
  })
})

describe('UC-FE03-03 / SCR-14 resend and cancel', () => {
  const pending = () => screen.findByText('invite23@example.test')

  it('asks MSG-FE03-06 in a dialog and Back closes it without a request', async () => {
    const user = userEvent.setup(); open(); await pending()
    await user.click(screen.getAllByRole('button', { name: 'Hủy' })[0])
    const dialog = screen.getByRole('dialog', { name: 'Hủy lời mời' })
    expect(within(dialog).getByText('Hủy lời mời gửi invite23@example.test? Link sẽ không còn tác dụng.')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Quay lại' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(api.cancelInvitation).not.toHaveBeenCalled()
  })

  it('resends with the observed version, shows MSG-FE03-05 with the new expiry and reloads the list', async () => {
    const user = userEvent.setup(); open(); await pending()
    const initial = api.listInvitations.mock.calls.length
    api.resendInvitation.mockResolvedValue({ ...row(23), version: 4, lastSentAt: '2026-11-14T02:00:00Z', expiresAt: '2026-11-21T02:00:00Z' })
    await user.click(screen.getAllByRole('button', { name: 'Gửi lại' })[0])
    expect(api.resendInvitation).toHaveBeenCalledWith(401, 23, { expectedVersion: 3, idempotencyKey: expect.any(String) })
    expect(await screen.findByText('Đã cập nhật lời mời tới invite23@example.test. Hệ thống đang gửi email. Hết hạn lúc 21/11/2026 02:00.')).toBeInTheDocument()
    await waitFor(() => expect(api.listInvitations.mock.calls.length).toBe(initial + 1))
  })

  it('shows the current status and reloads when the invitation is no longer pending', async () => {
    const user = userEvent.setup(); open(); await pending()
    const initial = api.listInvitations.mock.calls.length
    api.cancelInvitation.mockRejectedValue(new BackendError(409, { code: 'MSG-FE03-08', params: { status: 'ACCEPTED' } }))
    await user.click(screen.getAllByRole('button', { name: 'Hủy' })[0])
    await user.click(screen.getByRole('button', { name: 'Hủy lời mời' }))
    expect(await screen.findByText('Lời mời không còn hiệu lực (Đã chấp nhận).')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(api.listInvitations.mock.calls.length).toBe(initial + 1))
    expect(api.cancelInvitation).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['MSG-COM-05', 409, 'Dữ liệu đã thay đổi ở phiên khác. Tải lại trang rồi thử lại.'],
    ['MSG-FE03-04', 403, 'Mời thành viên, đổi vai trò và kích hoạt lại cần trại đang hoạt động (ACTIVE).'],
  ])('reloads after a resend rejected with %s and does not retry with a newer version', async (code, status, message) => {
    const user = userEvent.setup(); open(); await pending()
    const initial = api.listInvitations.mock.calls.length
    api.resendInvitation.mockRejectedValue(new BackendError(status, { code }))
    await user.click(screen.getAllByRole('button', { name: 'Gửi lại' })[0])
    expect(await screen.findByText(message)).toBeInTheDocument()
    await waitFor(() => expect(api.listInvitations.mock.calls.length).toBe(initial + 1))
    expect(api.resendInvitation).toHaveBeenCalledTimes(1)
  })

  it('keeps the dialog and the same request key after a save failure so the same intent can be retried', async () => {
    const user = userEvent.setup(); open(); await pending()
    const initial = api.listInvitations.mock.calls.length
    api.cancelInvitation.mockRejectedValueOnce(new BackendError(500, { code: 'MSG-COM-02' }))
    await user.click(screen.getAllByRole('button', { name: 'Hủy' })[0])
    const dialog = screen.getByRole('dialog', { name: 'Hủy lời mời' })
    await user.click(within(dialog).getByRole('button', { name: 'Hủy lời mời' }))
    expect(await within(dialog).findByText('Máy chủ chưa xử lý được yêu cầu. Dữ liệu chưa được xác nhận đã lưu.')).toBeInTheDocument()
    expect(api.listInvitations.mock.calls.length).toBe(initial)
    await user.click(within(dialog).getByRole('button', { name: 'Hủy lời mời' }))
    expect(await screen.findByText('Đã hủy lời mời.')).toBeInTheDocument()
    const [first, second] = api.cancelInvitation.mock.calls
    expect(second[2]).toEqual(first[2])
  })
})
