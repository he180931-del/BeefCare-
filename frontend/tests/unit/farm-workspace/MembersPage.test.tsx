import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { BackendError } from '../../../src/api/backendClient'
import { SessionContext, type Session } from '../../../src/features/authorization/sessionContext'
import MembersPage from '../../../src/features/farm-workspace/pages/MembersPage'
import type { MemberList, Membership } from '../../../src/features/farm-workspace/types'

const api = vi.hoisted(() => ({ listMembers: vi.fn(), getFarm: vi.fn() }))
vi.mock('../../../src/features/farm-workspace/api/farmWorkspaceApi', () => ({ farmWorkspaceApi: api }))

const owner: Session = { role: 'OWNER', email: 'owner@example.test', fullName: 'Chủ trại', farmId: 401, farmName: 'Trại kiểm thử', logout: vi.fn() }
const manager: Session = { ...owner, role: 'MANAGER', email: 'manager@example.test' }
const member = (id: number, fullName: string, role: Membership['role'], status: Membership['status'] = 'ACTIVE', changes: Partial<Membership> = {}): Membership => ({
  id, userId: id, fullName, email: `m${id}@example.test`, role, status, joinedAt: '2025-01-10T03:00:00Z', version: 1,
  actions: role === 'OWNER' ? [] : status === 'ACTIVE' ? ['CHANGE_ROLE', 'DEACTIVATE'] : ['REACTIVATE'], ...changes,
})
const list = (items: Membership[], changes: Partial<MemberList> = {}): MemberList => ({
  farmName: 'Trại kiểm thử', timeZone: 'Asia/Ho_Chi_Minh', serviceStatus: 'ACTIVE', items,
  counts: {
    all: items.length, managers: items.filter((row) => row.status === 'ACTIVE' && row.role === 'MANAGER').length,
    technicians: items.filter((row) => row.status === 'ACTIVE' && row.role === 'TECHNICIAN').length, inactive: items.filter((row) => row.status === 'INACTIVE').length,
  },
  ...changes,
})
const roster = () => [
  member(1, 'Nguyễn Văn Hùng', 'OWNER', 'ACTIVE', { joinedAt: '2024-02-29T18:30:00Z' }),
  member(2, 'trần quốc long', 'MANAGER'),
  member(3, 'Đỗ Văn Bình', 'TECHNICIAN'),
  member(4, 'Dương Thị Hoa', 'TECHNICIAN'),
  member(5, '', 'TECHNICIAN', 'ACTIVE', { email: 'an.kt@example.test' }),
  member(6, 'Bùi Văn Khoa', 'TECHNICIAN', 'INACTIVE'),
]
const open = (session: Session | null = owner, path = '/thanh-vien?farmId=401') => render(
  <SessionContext.Provider value={session}><MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/thanh-vien" element={<MembersPage />} />
  </Routes></MemoryRouter></SessionContext.Provider>,
)
const names = () => within(screen.getAllByRole('table')[0]).getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell')[0].querySelector('strong')?.textContent)

beforeEach(() => {
  vi.resetAllMocks()
  sessionStorage.clear()
  api.listMembers.mockResolvedValue(list(roster()))
})

describe('UC-FE03-05 / SCR-13 (D29)', () => {
  it('orders the Owner view by Vietnamese name, shows tab counts and the joined month in the farm time zone', async () => {
    const user = userEvent.setup(); open()
    expect(await screen.findByText('Bùi Văn Khoa')).toBeInTheDocument()
    expect(api.listMembers).toHaveBeenCalledWith(401, 'OWNER')
    expect(api.getFarm).not.toHaveBeenCalled()
    // Case ignored, Đ after D, no name → ordered and shown by email
    expect(names()).toEqual(['Chưa có tên', 'Bùi Văn Khoa', 'Dương Thị Hoa', 'Đỗ Văn Bình', 'Nguyễn Văn Hùng', 'trần quốc long'])
    expect(screen.getByRole('button', { name: 'Tất cả (6)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quản lý (1)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Kỹ thuật viên (3)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Đã ngưng (1)' })).toBeInTheDocument()
    // 29/02/2024 18:30 UTC is 01/03/2024 in Asia/Ho_Chi_Minh
    expect(screen.getByText('03/2024')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Thành viên/ }))
    expect(names()[0]).toBe('trần quốc long')
  })

  it('filters Technicians to active ones and Inactive to deactivated members, with the actions the server allows', async () => {
    const user = userEvent.setup(); open()
    await screen.findByText('Bùi Văn Khoa')
    await user.click(screen.getByRole('button', { name: 'Kỹ thuật viên (3)' }))
    expect(names()).toEqual(['Chưa có tên', 'Dương Thị Hoa', 'Đỗ Văn Bình'])
    await user.click(screen.getByRole('button', { name: 'Đã ngưng (1)' }))
    expect(names()).toEqual(['Bùi Văn Khoa'])
    expect(screen.getByRole('button', { name: 'Kích hoạt lại' })).toBeEnabled()
    expect(screen.getByText('Đã ngưng', { selector: 'span' })).toBeInTheDocument()
  })

  it('keeps Deactivate available while the farm is not ACTIVE and locks invite, change role and reactivate', async () => {
    const rows = roster().map((row) => ({ ...row, actions: row.role !== 'OWNER' && row.status === 'ACTIVE' ? ['DEACTIVATE' as const] : [] }))
    api.listMembers.mockResolvedValue(list(rows, { serviceStatus: 'EXPIRED' }))
    open()
    expect(await screen.findByText(/Dịch vụ trại hiện không hoạt động/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mời thành viên' })).toBeDisabled()
    expect(screen.getAllByRole('button', { name: 'Đổi vai trò' }).every((button) => (button as HTMLButtonElement).disabled)).toBe(true)
    expect(screen.getAllByRole('button', { name: 'Ngưng' }).every((button) => !(button as HTMLButtonElement).disabled)).toBe(true)
    expect(screen.getByRole('button', { name: 'Kích hoạt lại' })).toBeDisabled()
  })

  it('is read-only for a Manager without the farm detail API, invitations, actions or the Inactive tab', async () => {
    api.listMembers.mockResolvedValue(list(roster().filter((row) => row.status === 'ACTIVE').map((row) => ({ ...row, actions: [] })), { counts: { all: 5, managers: 1, technicians: 3 } }))
    open(manager)
    expect(await screen.findByText(/Chế độ xem chỉ đọc/)).toBeInTheDocument()
    expect(api.listMembers).toHaveBeenCalledWith(401, 'MANAGER')
    expect(api.getFarm).not.toHaveBeenCalled()
    expect(screen.queryByRole('columnheader', { name: 'Thao tác' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Lời mời' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mời thành viên' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Đã ngưng/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tất cả (5)' })).toBeInTheDocument()
  })

  it('shows 20 rows per page and returns to the first page when the tab changes', async () => {
    const many = [member(1, 'Chủ Trại', 'OWNER'), ...Array.from({ length: 24 }, (_, i) => member(10 + i, `Kỹ thuật ${String(i + 1).padStart(2, '0')}`, 'TECHNICIAN'))]
    api.listMembers.mockResolvedValue(list(many))
    const user = userEvent.setup(); open()
    await screen.findByText('Chủ Trại')
    expect(names()).toHaveLength(20)
    expect(screen.getByText('Hiển thị 1–20 trong 25 thành viên')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Trang sau' }))
    expect(names()).toEqual(['Kỹ thuật 20', 'Kỹ thuật 21', 'Kỹ thuật 22', 'Kỹ thuật 23', 'Kỹ thuật 24'])
    await user.click(screen.getByRole('button', { name: 'Kỹ thuật viên (24)' }))
    expect(screen.getByText('Hiển thị 1–20 trong 24 thành viên')).toBeInTheDocument()
  })

  it('offers Clear filters on an empty tab and Retry after a load failure', async () => {
    api.listMembers.mockResolvedValueOnce(list([member(1, 'Chủ Trại', 'OWNER')]))
    const user = userEvent.setup(); const view = open()
    await screen.findByText('Chủ Trại')
    await user.click(screen.getByRole('button', { name: 'Quản lý (0)' }))
    expect(screen.getByText('Không có bản ghi phù hợp với bộ lọc.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }))
    expect(names()).toEqual(['Chủ Trại'])
    view.unmount()

    api.listMembers.mockRejectedValueOnce(new BackendError(500, { code: 'MSG-COM-03' })).mockResolvedValueOnce(list(roster()))
    open()
    expect(await screen.findByRole('button', { name: 'Thử lại' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByText('Bùi Văn Khoa')).toBeInTheDocument()
  })

  it('keeps the tab and order per account and farm for the session', async () => {
    const user = userEvent.setup(); const first = open()
    await screen.findByText('Bùi Văn Khoa')
    await user.click(screen.getByRole('button', { name: 'Kỹ thuật viên (3)' }))
    await user.click(screen.getByRole('button', { name: /Thành viên/ }))
    first.unmount()
    const again = open()
    await screen.findByText('Đỗ Văn Bình')
    expect(names()).toEqual(['Đỗ Văn Bình', 'Dương Thị Hoa', 'Chưa có tên'])
    again.unmount()
    open(owner, '/thanh-vien?farmId=402')
    await screen.findByText('Bùi Văn Khoa')
    expect(names()[0]).toBe('Chưa có tên')
  })

  it('shows Table III-2 for the three roles', async () => {
    open()
    await screen.findByText('Bùi Văn Khoa')
    const table = screen.getAllByRole('table')[1]
    expect(within(table).getAllByRole('row')).toHaveLength(18)
    const membersRow = within(table).getByText('Thành viên & vai trò').closest('tr')!
    expect(within(membersRow).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Thành viên & vai trò', 'Quản lý', 'Xem danh sách', '—'])
    expect(within(table).getByText('Lập lịch, ghi và sửa')).toBeInTheDocument()
  })
})
