import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { useEffect } from 'react'
import { SessionContext, type Session } from '../../../src/app/session/sessionContext'
import { accountDemoStore } from '../../../src/features/account/data/accountDemoStore'
import { AccountMenu } from '../../../src/features/account'
import { AccountDialogProvider, type AccountDialogTab, useAccountDialog } from '../../../src/features/account/components/AccountDialogContext'

const farm = { farmId: 1, farmName: 'Trại bò Yên Bài – Ba Vì' }
const sessions: Record<string, Session> = {
  manager: { role: 'MANAGER', fullName: 'Trần Quốc Long', email: 'manager@beefcare.local', ...farm, logout: vi.fn() },
  owner: { role: 'OWNER', fullName: 'Nguyễn Văn Hùng', email: 'owner@beefcare.local', ...farm, logout: vi.fn() },
  technician: { role: 'TECHNICIAN', fullName: 'Lê Thị Mai', email: 'technician@beefcare.local', ...farm, logout: vi.fn() },
  pm: { role: 'PM', fullName: 'Đỗ Minh Quân', email: 'pm@beefcare.local', farmId: null, farmName: null, logout: vi.fn() },
}

function AutoOpen({ tab }: { tab: AccountDialogTab }) {
  const { openAccountDialog } = useAccountDialog()
  useEffect(() => openAccountDialog(tab), [openAccountDialog, tab])
  return null
}

const renderAs = (who: string, path: string, tab: AccountDialogTab = 'profile') => render(
  <SessionContext.Provider value={sessions[who]}>
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AccountDialogProvider><AutoOpen tab={tab} /></AccountDialogProvider>
    </MemoryRouter>
  </SessionContext.Provider>,
)

const renderFromRoute = (who: string, path: string) => render(
  <SessionContext.Provider value={sessions[who]}>
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AccountDialogProvider><div>Trang nền</div></AccountDialogProvider>
    </MemoryRouter>
  </SessionContext.Provider>,
)

beforeEach(async () => {
  vi.clearAllMocks()
  await accountDemoStore.reset()
})

describe('account dialog profile panel', () => {
  it('shows the shared profile content without the old per-farm permission card', async () => {
    renderAs('manager', '/chon-trai')

    expect(await screen.findByText('manager@beefcare.local')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Hồ sơ của tôi' })).toBeInTheDocument()
    expect(screen.getByText('Tài khoản BeefCare')).toBeInTheDocument()
    expect(screen.queryByText('Quyền của tôi trong trại này')).not.toBeInTheDocument()
  })

  it('mở Hồ sơ của tôi từ route m=ho-so cho vai trò nền tảng', async () => {
    renderFromRoute('pm', '/nen-tang/dich-vu?m=ho-so')

    expect(await screen.findByRole('heading', { name: 'Hồ sơ của tôi' })).toBeInTheDocument()
    expect(screen.getByText('pm@beefcare.local')).toBeInTheDocument()
  })

  it('saves the profile and reports field errors', async () => {
    const user = userEvent.setup()
    renderAs('manager', '/chon-trai')
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
    renderAs('manager', '/chon-trai?m=doi-mat-khau')
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
    expect(screen.queryByRole('dialog', { name: 'Đổi mật khẩu' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Cài đặt' })).toBeInTheDocument()
  })

  it('asks a Google-only account to re-authenticate before adding a password', async () => {
    const user = userEvent.setup()
    renderAs('pm', '/nen-tang?m=doi-mat-khau')
    const dialog = await screen.findByRole('dialog', { name: 'Thêm mật khẩu' })

    expect(within(dialog).queryByLabelText('Mật khẩu hiện tại *')).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Thêm mật khẩu' })).toBeDisabled()
    await user.click(within(dialog).getByRole('button', { name: 'Xác minh bằng Google' }))
    expect(await within(dialog).findByText('Đã xác minh bằng Google. Bạn có thể thêm mật khẩu BeefCare.')).toBeInTheDocument()
    await user.type(await within(dialog).findByLabelText('Mật khẩu mới *'), 'NewPassw0rd')
    await user.type(within(dialog).getByLabelText('Nhập lại mật khẩu mới *'), 'NewPassw0rd')
    await user.click(within(dialog).getByRole('button', { name: 'Thêm mật khẩu' }))
    expect(await screen.findByText(/Mật khẩu đã được đổi/)).toBeInTheDocument()
  })

  it('restores the password dialog after Google re-authentication', async () => {
    renderAs('manager', '/chon-trai?m=doi-mat-khau&googleReauthenticated=true')
    const dialog = await screen.findByRole('dialog', { name: 'Đổi mật khẩu' })

    expect(within(dialog).queryByLabelText('Mật khẩu hiện tại *')).not.toBeInTheDocument()
    expect(within(dialog).getByText('Đã xác minh bằng Google. Hãy đặt mật khẩu BeefCare mới.')).toBeInTheDocument()
  })

  it('keeps the account dialog open when Escape closes the nested password dialog', async () => {
    const user = userEvent.setup()
    renderAs('manager', '/chon-trai')

    await user.click(await screen.findByRole('button', { name: 'Đổi mật khẩu' }))
    expect(screen.getByRole('dialog', { name: 'Đổi mật khẩu' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Đổi mật khẩu' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Cài đặt' })).toBeInTheDocument()
  })

  it('uses the shared account menu to sign a technician out', async () => {
    const user = userEvent.setup()
    render(
      <SessionContext.Provider value={sessions.technician}>
        <MemoryRouter><AccountDialogProvider><AccountMenu /></AccountDialogProvider></MemoryRouter>
      </SessionContext.Provider>,
    )

    await user.click(screen.getByRole('button', { name: 'Lê Thị Mai, TECHNICIAN' }))
    await user.click(screen.getByRole('menuitem', { name: 'Đăng xuất' }))
    expect(sessions.technician.logout).toHaveBeenCalledOnce()
  })
})

describe('role permissions page', () => {
  it('shows the full Owner matrix and filters Owner-only rows for Manager', async () => {
    const user = userEvent.setup()
    renderAs('owner', '/chon-trai', 'permissions')

    expect(screen.getByRole('heading', { name: 'Quyền theo vai trò' })).toBeInTheDocument()
    expect(screen.getByTestId('permissions-bento-role')).toHaveClass('bg-white', 'border-field')
    expect(screen.getByTestId('permissions-bento-role')).not.toHaveClass('bg-brand-dark')
    expect(screen.getByTestId('permissions-bento-matrix')).toBeInTheDocument()
    expect(screen.getByTestId('permissions-bento-matrix')).toHaveClass('rounded-2xl', 'bg-white')
    expect(screen.getByText(/Chủ trại có quyền quản lý toàn bộ hoạt động trang trại/i)).toBeInTheDocument()
    expect(screen.getByText('Gói dịch vụ & thanh toán')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Quản lý' }))
    expect(screen.getByText('Hồ sơ bò & thẻ QR')).toBeInTheDocument()
    expect(screen.queryByText('Gói dịch vụ & thanh toán')).not.toBeInTheDocument()
  })
})
