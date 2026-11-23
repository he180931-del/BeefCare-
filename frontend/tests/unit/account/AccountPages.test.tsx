import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { SessionContext, type Session } from '../../../src/app/session/sessionContext'
import { accountDemoStore } from '../../../src/features/account/data/accountDemoStore'
import AccountPage from '../../../src/features/account/pages/AccountPage'
import RolePermissionsPage from '../../../src/features/account/pages/RolePermissionsPage'

const farm = { farmId: 1, farmName: 'Trại bò Yên Bài – Ba Vì' }
const sessions: Record<string, Session> = {
  manager: { role: 'MANAGER', fullName: 'Trần Quốc Long', email: 'manager@beefcare.local', ...farm, logout: vi.fn() },
  owner: { role: 'OWNER', fullName: 'Nguyễn Văn Hùng', email: 'owner@beefcare.local', ...farm, logout: vi.fn() },
  technician: { role: 'TECHNICIAN', fullName: 'Lê Thị Mai', email: 'technician@beefcare.local', ...farm, logout: vi.fn() },
  pm: { role: 'PM', fullName: 'Đỗ Minh Quân', email: 'pm@beefcare.local', farmId: null, farmName: null, logout: vi.fn() },
}

const renderAs = (who: string, path: string, page: ReactNode) => render(
  <SessionContext.Provider value={sessions[who]}>
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{page}</MemoryRouter>
  </SessionContext.Provider>,
)

beforeEach(async () => {
  vi.clearAllMocks()
  await accountDemoStore.reset()
})

describe('account page', () => {
  it('shows the shared profile page without the old per-farm permission card', async () => {
    renderAs('manager', '/tai-khoan', <AccountPage />)

    expect(await screen.findByText('manager@beefcare.local')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Hồ sơ của tôi' })).toBeInTheDocument()
    expect(screen.getByText('Tài khoản BeefCare')).toBeInTheDocument()
    expect(screen.queryByText('Quyền của tôi trong trại này')).not.toBeInTheDocument()
  })

  it('saves the profile and reports field errors', async () => {
    const user = userEvent.setup()
    renderAs('manager', '/tai-khoan', <AccountPage />)
    const name = await screen.findByLabelText('Họ và tên *')

    await user.clear(name)
    await user.type(name, 'A')
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    expect(await screen.findByText('Họ và tên cần từ 2 đến 100 ký tự.')).toBeInTheDocument()

    await user.clear(name)
    await user.type(name, 'Trần Quốc Long B')
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    expect(await screen.findByText('Hồ sơ của bạn đã được cập nhật.')).toBeInTheDocument()
  })

  it('changes the password in a dialog opened with ?m=doi-mat-khau', async () => {
    const user = userEvent.setup()
    renderAs('manager', '/tai-khoan?m=doi-mat-khau', <AccountPage />)
    const dialog = await screen.findByRole('dialog', { name: 'Đổi mật khẩu' })

    await user.type(within(dialog).getByLabelText('Mật khẩu hiện tại *'), 'sai-mat-khau')
    await user.type(within(dialog).getByLabelText('Mật khẩu mới *'), 'NewPassw0rd')
    await user.type(within(dialog).getByLabelText('Nhập lại mật khẩu mới *'), 'NewPassw0rd')
    await user.click(within(dialog).getByRole('button', { name: 'Đổi mật khẩu' }))
    expect(await within(dialog).findByText('Mật khẩu hiện tại không đúng.')).toBeInTheDocument()

    await user.clear(within(dialog).getByLabelText('Mật khẩu hiện tại *'))
    await user.type(within(dialog).getByLabelText('Mật khẩu hiện tại *'), 'mock-demo')
    await user.click(within(dialog).getByRole('button', { name: 'Đổi mật khẩu' }))
    expect(await screen.findByText(/Mật khẩu đã được đổi/)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('asks a Google-only account to re-authenticate before adding a password', async () => {
    const user = userEvent.setup()
    renderAs('pm', '/tai-khoan?m=doi-mat-khau', <AccountPage />)
    const dialog = await screen.findByRole('dialog', { name: 'Thêm mật khẩu' })

    expect(within(dialog).queryByLabelText('Mật khẩu hiện tại *')).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Thêm mật khẩu' })).toBeDisabled()
    await user.click(within(dialog).getByRole('button', { name: 'Xác thực lại với Google' }))
    await user.type(await within(dialog).findByLabelText('Mật khẩu mới *'), 'NewPassw0rd')
    await user.type(within(dialog).getByLabelText('Nhập lại mật khẩu mới *'), 'NewPassw0rd')
    await user.click(within(dialog).getByRole('button', { name: 'Thêm mật khẩu' }))
    expect(await screen.findByText(/Mật khẩu đã được đổi/)).toBeInTheDocument()
  })

  it('restores the password dialog after Google re-authentication', async () => {
    renderAs('manager', '/tai-khoan?m=doi-mat-khau&googleReauthenticated=true', <AccountPage />)
    const dialog = await screen.findByRole('dialog', { name: 'Đổi mật khẩu' })

    expect(within(dialog).queryByLabelText('Mật khẩu hiện tại *')).not.toBeInTheDocument()
    expect(within(dialog).getByText('Đã xác thực lại với Google. Bạn không cần nhập mật khẩu hiện tại.')).toBeInTheDocument()
  })

  it('uses the shared account menu to sign a technician out', async () => {
    const user = userEvent.setup()
    renderAs('technician', '/tai-khoan', <AccountPage />)

    await screen.findByText('technician@beefcare.local')
    await user.click(screen.getByRole('button', { name: 'Lê Thị Mai, TECHNICIAN' }))
    await user.click(screen.getByRole('menuitem', { name: 'Đăng xuất' }))
    expect(sessions.technician.logout).toHaveBeenCalledOnce()
  })
})

describe('role permissions page', () => {
  it('shows the full Owner matrix and filters Owner-only rows for Manager', async () => {
    const user = userEvent.setup()
    renderAs('owner', '/quyen-theo-vai-tro', <RolePermissionsPage />)

    expect(screen.getByRole('heading', { name: 'Quyền theo vai trò' })).toBeInTheDocument()
    expect(screen.getByText('Gói dịch vụ & thanh toán')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Quản lý' }))
    expect(screen.getByText('Hồ sơ bò & thẻ QR')).toBeInTheDocument()
    expect(screen.queryByText('Gói dịch vụ & thanh toán')).not.toBeInTheDocument()
  })
})
