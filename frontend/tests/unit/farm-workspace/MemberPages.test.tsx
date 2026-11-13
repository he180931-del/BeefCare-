import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { SessionContext, type Session } from '../../../src/features/authorization/sessionContext'
import InvitationsPage from '../../../src/features/farm-workspace/pages/InvitationsPage'
import MembersPage from '../../../src/features/farm-workspace/pages/MembersPage'

const farm = { farmId: 1, farmName: 'Trại bò Yên Bài – Ba Vì' }
const owner: Session = { role: 'OWNER', fullName: 'Nguyễn Văn Hùng', email: 'owner@beefcare.local', ...farm, logout: vi.fn() }
const manager: Session = { role: 'MANAGER', fullName: 'Trần Quốc Long', email: 'manager@beefcare.local', ...farm, logout: vi.fn() }
const renderAs = (session: Session, path: string) => render(
  <SessionContext.Provider value={session}>
    <MemoryRouter initialEntries={[path]}><Routes><Route path="/thanh-vien" element={<MembersPage />} /><Route path="/loi-moi" element={<InvitationsPage />} /></Routes></MemoryRouter>
  </SessionContext.Provider>,
)

describe('Members and Roles', () => {
  it('filters by role and status and offers actions to the Owner', async () => {
    const user = userEvent.setup()
    renderAs(owner, '/thanh-vien')
    expect(await screen.findByRole('button', { name: 'Tất cả (7)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quản lý (2)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Kỹ thuật viên (4)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mời thành viên' })).toBeEnabled()
    expect(screen.getByText('03/2024')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ngừng hoạt động (1)' }))
    expect(screen.getByText('Bùi Văn Khoa')).toBeInTheDocument()
    expect(screen.queryByText('Phạm Văn Tú')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Kích hoạt lại' })).toBeInTheDocument()
  })

  it('shows the permissions of the chosen role', async () => {
    const user = userEvent.setup()
    renderAs(owner, '/thanh-vien')
    await screen.findByText('Quyền theo vai trò')
    expect(screen.getByLabelText('Thành viên & vai trò')).not.toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Kỹ thuật viên' }))
    expect(screen.getByLabelText(/Báo cáo & tổng quan/)).not.toBeChecked()
    expect(screen.getByLabelText(/Tiêm phòng/)).toBeChecked()
  })

  it('is read-only for a Manager: no actions, no invitations, no inactive tab or members', async () => {
    renderAs(manager, '/thanh-vien')
    expect(await screen.findByText(/Chế độ xem chỉ đọc/)).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Thao tác' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mời thành viên' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Lời mời' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Ngừng hoạt động \(/)).not.toBeInTheDocument()
    expect(screen.queryByText('Bùi Văn Khoa')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tất cả (6)' })).toBeInTheDocument()
  })

  it('deactivates a member through the ?m=doi-vai-tro dialog after a confirmation step', async () => {
    const user = userEvent.setup()
    renderAs(owner, '/thanh-vien?m=doi-vai-tro&id=6&a=DEACTIVATE')
    const dialog = await screen.findByRole('dialog', { name: 'Đổi vai trò / ngừng hoạt động' })
    await user.click(within(dialog).getByRole('button', { name: 'Lưu thay đổi' }))
    expect(await within(dialog).findByText('Nhập lý do (tối đa 500 ký tự).')).toBeInTheDocument()
    await user.type(within(dialog).getByLabelText('Lý do * (tối đa 500 ký tự)'), 'Nghỉ việc')
    await user.click(within(dialog).getByRole('button', { name: 'Lưu thay đổi' }))
    expect(await within(dialog).findByText(/Ngừng hoạt động Đinh Văn Sơn\?/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Xác nhận thay đổi' }))
    expect(await screen.findByText('Đã cập nhật tư cách thành viên của Đinh Văn Sơn.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ngừng hoạt động (2)' })).toBeInTheDocument()
  })
})

describe('Farm Invitations', () => {
  it('lists pending invitations with counts per status', async () => {
    renderAs(owner, '/loi-moi')
    expect(await screen.findByText('dinhthuy.kt@gmail.com')).toBeInTheDocument()
    expect(screen.getByText('Chưa có tài khoản')).toBeInTheDocument()
    expect(screen.getByText('17/10/2026 08:10')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Đang chờ (2)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Đã chấp nhận (6)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hết hạn (1)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Đã hủy (1)' })).toBeInTheDocument()
  })

  it('sends an invitation from the ?m=invite dialog once a role is chosen', async () => {
    const user = userEvent.setup()
    renderAs(owner, '/loi-moi?m=invite')
    const dialog = await screen.findByRole('dialog', { name: 'Mời thành viên' })
    expect(within(dialog).getByText('Chọn vai trò để xem các quyền cố định.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Gửi lời mời' })).toBeEnabled()
    await user.type(within(dialog).getByLabelText('Thư điện tử người nhận *'), 'phamtuan.kt@gmail.com')
    await user.click(within(dialog).getByRole('button', { name: 'Kỹ thuật viên' }))
    expect(within(dialog).getByLabelText(/Tiêm phòng/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Gửi lời mời' }))
    expect(await screen.findByText(/Đã tạo lời mời tới phamtuan.kt@gmail.com\. Hệ thống đang gửi email/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Đang chờ (3)' })).toBeInTheDocument()
  })

  it('rejects an email that already has a pending invitation', async () => {
    const user = userEvent.setup()
    renderAs(owner, '/loi-moi?m=invite')
    const dialog = await screen.findByRole('dialog', { name: 'Mời thành viên' })
    await user.type(within(dialog).getByLabelText('Thư điện tử người nhận *'), 'quang.manager@gmail.com')
    await user.click(within(dialog).getByRole('button', { name: 'Quản lý' }))
    await user.click(within(dialog).getByRole('button', { name: 'Gửi lời mời' }))
    expect(await within(dialog).findByText('Đã có lời mời đang chờ cho email này.')).toBeInTheDocument()
  })

  it('cancels a pending invitation after confirmation', async () => {
    const user = userEvent.setup()
    renderAs(owner, '/loi-moi')
    await screen.findByText('dinhthuy.kt@gmail.com')
    await user.click(screen.getAllByRole('button', { name: 'Hủy' })[0])
    await user.click(await screen.findByRole('button', { name: 'Xác nhận hủy' }))
    expect(await screen.findByText('Đã hủy lời mời.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Đã hủy (2)' })).toBeInTheDocument()
  })
})
