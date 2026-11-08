import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { SessionContext, type Session } from '../../../src/features/authorization/sessionContext'
import { accountDemoStore } from '../../../src/features/account/data/accountDemoStore'
import ProfilePage from '../../../src/features/account/pages/ProfilePage'
import PlatformProfilePage from '../../../src/features/account/pages/PlatformProfilePage'
import TechnicianAccountPage from '../../../src/features/account/pages/TechnicianAccountPage'

const farm = { farmId: 1, farmName: 'Trại bò Yên Bài – Ba Vì' }
const sessions: Record<string, Session> = {
  manager: { role: 'MANAGER', fullName: 'Trần Quốc Long', email: 'manager@beefcare.local', ...farm, logout: vi.fn() },
  owner: { role: 'OWNER', fullName: 'Nguyễn Văn Hùng', email: 'owner@beefcare.local', ...farm, logout: vi.fn() },
  technician: { role: 'TECHNICIAN', fullName: 'Lê Thị Mai', email: 'technician@beefcare.local', ...farm, logout: vi.fn() },
  pm: { role: 'PM', fullName: 'Đỗ Minh Quân', email: 'pm@beefcare.local', farmId: null, farmName: null, logout: vi.fn() },
}
const renderAs = (who: string, path: string, page: ReactNode) => render(<SessionContext.Provider value={sessions[who]}><MemoryRouter initialEntries={[path]}>{page}</MemoryRouter></SessionContext.Provider>)

beforeEach(async () => { await accountDemoStore.reset() })

describe('profile page', () => {
  it('shows the profile and the read-only permission table of the Manager role', async () => {
    renderAs('manager', '/ho-so', <ProfilePage />)
    expect(await screen.findByDisplayValue('manager@beefcare.local · đã xác minh')).toHaveAttribute('readonly')
    expect(screen.getByText('Quản lý tại Trại bò Yên Bài – Ba Vì')).toBeInTheDocument()
    expect(screen.getByText('Quyền của tôi trong trại này')).toBeInTheDocument()
    expect(screen.getByText('Hồ sơ bò & thẻ QR')).toBeInTheDocument()
    expect(screen.queryByText('Gói dịch vụ & thanh toán')).not.toBeInTheDocument()
  })

  it('saves the profile and reports field errors', async () => {
    const user = userEvent.setup()
    renderAs('manager', '/ho-so', <ProfilePage />)
    const name = await screen.findByLabelText('Họ và tên *')
    await user.clear(name)
    await user.type(name, 'A')
    await user.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }))
    expect(await screen.findByText('Họ và tên cần từ 2 đến 100 ký tự.')).toBeInTheDocument()
    await user.clear(name)
    await user.type(name, 'Trần Quốc Long B')
    await user.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }))
    expect(await screen.findByText('Hồ sơ của bạn đã được cập nhật.')).toBeInTheDocument()
  })

  it('changes the password in a dialog opened with ?m=doi-mat-khau', async () => {
    const user = userEvent.setup()
    renderAs('manager', '/ho-so?m=doi-mat-khau', <ProfilePage />)
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
    renderAs('pm', '/nen-tang/ho-so?m=doi-mat-khau', <PlatformProfilePage />)
    const dialog = await screen.findByRole('dialog', { name: 'Thêm mật khẩu' })
    expect(within(dialog).queryByLabelText('Mật khẩu hiện tại *')).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Thêm mật khẩu' })).toBeDisabled()
    await user.click(within(dialog).getByRole('button', { name: 'Xác thực lại với Google' }))
    await user.type(await within(dialog).findByLabelText('Mật khẩu mới *'), 'NewPassw0rd')
    await user.type(within(dialog).getByLabelText('Nhập lại mật khẩu mới *'), 'NewPassw0rd')
    await user.click(within(dialog).getByRole('button', { name: 'Thêm mật khẩu' }))
    expect(await screen.findByText(/Mật khẩu đã được đổi/)).toBeInTheDocument()
  })

  it('shows the whole table including Owner-only rows to the Owner, and no farm table to platform staff', async () => {
    const owner = renderAs('owner', '/ho-so', <ProfilePage />)
    expect(await screen.findByText('Gói dịch vụ & thanh toán')).toBeInTheDocument()
    owner.unmount()
    renderAs('pm', '/nen-tang/ho-so', <PlatformProfilePage />)
    expect(await screen.findByText('Platform Manager · PM')).toBeInTheDocument()
    expect(screen.queryByText('Quyền của tôi trong trại này')).not.toBeInTheDocument()
  })
})

describe('technician account page', () => {
  it('shows name, farm and role and signs out', async () => {
    const user = userEvent.setup()
    renderAs('technician', '/kt/tai-khoan', <TechnicianAccountPage />)
    expect(await screen.findByText('Kỹ thuật viên tại Trại bò Yên Bài – Ba Vì')).toBeInTheDocument()
    expect(screen.getByText('Lê Thị Mai')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Đăng xuất/ }))
    expect(sessions.technician.logout).toHaveBeenCalledOnce()
  })

  it('lets a technician update their full name and phone without changing email', async () => {
    const user = userEvent.setup()
    renderAs('technician', '/kt/tai-khoan', <TechnicianAccountPage />)
    const name = await screen.findByLabelText('Họ và tên *')
    await user.clear(name)
    await user.type(name, 'Lê Thị Mai Mới')
    await user.clear(screen.getByLabelText('Điện thoại liên hệ'))
    await user.type(screen.getByLabelText('Điện thoại liên hệ'), '0934 567 891')
    await user.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }))
    expect(await screen.findByText('Hồ sơ của bạn đã được cập nhật.')).toBeInTheDocument()
    expect(screen.getByDisplayValue('technician@beefcare.local')).toHaveAttribute('readonly')
  })
})
