import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Layout from '../../../src/components/Layout'
import { createMockAuthClient } from '../../../src/features/authentication/client'
import { demoUserFor, DEMO_USERS } from '../../../src/features/authentication/demoUsers'
import { HomeRedirect, RoleGate, sessionFromProfile, type AppRole } from '../../../src/features/authorization'
import { SessionContext, type Session } from '../../../src/features/authorization/sessionContext'

const sessionFor = (role: AppRole): Session => ({
  role, fullName: 'Nguyễn Văn Hùng', email: 'x@beefcare.local', farmId: 1, farmName: 'Trại thử nghiệm',
  ownerRegistrationCompleted: true, platformRole: null, activeFarmCount: 1, logout: async () => undefined,
})

const withSession = (role: AppRole, path: string, element: React.ReactElement) => render(
  <SessionContext.Provider value={sessionFor(role)}>
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/tong-quan" element={element} />
        <Route path="/kt" element={<div>Trang kỹ thuật viên</div>} />
        <Route path="/nen-tang/ho-tro" element={<div>Trang CS</div>} />
        <Route path="/nen-tang/dich-vu" element={<div>Trang PM</div>} />
        <Route path="/nen-tang/tai-khoan" element={<div>Trang SA</div>} />
        <Route path="/owner-registration" element={<div>Hoàn tất Owner</div>} />
        <Route path="/chon-trai" element={<div>Chọn trại</div>} />
      </Routes>
    </MemoryRouter>
  </SessionContext.Provider>,
)

describe('session from the backend profile', () => {
  it('prefers the platform role over any farm role', () => {
    const session = sessionFromProfile({ fullName: 'Đỗ Minh Quân', email: 'pm@x', platformRole: 'PM', farms: [{ farmId: 9, farmName: 'A', role: 'OWNER' }] })
    expect(session.role).toBe('PM')
  })

  it('uses the role in the farm and keeps the numeric farm id', () => {
    const session = sessionFromProfile({ fullName: 'Mai', email: 'm@x', platformRole: null, farms: [{ farmId: 1, farmName: 'Trại A', role: 'TECHNICIAN' }] })
    expect(session).toMatchObject({ role: 'TECHNICIAN', farmId: 1, farmName: 'Trại A' })
  })

  it('treats an account with no farm as an owner still onboarding', () => {
    expect(sessionFromProfile({ fullName: 'Mới', email: 'n@x', platformRole: null, farms: [] })).toMatchObject({ role: 'OWNER', farmId: null, farmName: null })
  })

  it('keeps owner completion and active-farm facts from the server profile', () => {
    const session = sessionFromProfile({ fullName: 'Mới', email: 'moi@x', ownerRegistrationCompleted: false, platformRole: null, farms: [{ farmId: 8, farmName: 'Chờ thanh toán', role: 'OWNER', serviceStatus: 'PENDING_PAYMENT' }] })
    expect(session).toMatchObject({ ownerRegistrationCompleted: false, activeFarmCount: 0 })
  })
})

describe('role navigation', () => {
  it.each([
    ['OWNER', 'Trang chủ trại'],
    ['MANAGER', 'Trang chủ trại'],
    ['TECHNICIAN', 'Trang kỹ thuật viên'],
    ['CS', 'Trang CS'],
    ['PM', 'Trang PM'],
    ['SA', 'Trang SA'],
  ] as const)('sends %s to its own home from /', (role, text) => {
    withSession(role, '/', <div>Trang chủ trại</div>)
    expect(screen.getByText(text)).toBeInTheDocument()
  })

  it('sends an incomplete owner to owner registration before every role destination', () => {
    const session = { ...sessionFor('PM'), ownerRegistrationCompleted: false }
    render(<SessionContext.Provider value={session}><MemoryRouter initialEntries={['/']}><Routes><Route path="/" element={<HomeRedirect />} /><Route path="/owner-registration" element={<div>Hoàn tất Owner</div>} /></Routes></MemoryRouter></SessionContext.Provider>)
    expect(screen.getByText('Hoàn tất Owner')).toBeInTheDocument()
  })

  it('keeps an incomplete owner out of a directly requested farm screen', () => {
    const session = { ...sessionFor('OWNER'), ownerRegistrationCompleted: false }
    render(<SessionContext.Provider value={session}><MemoryRouter initialEntries={['/tong-quan']}><Routes><Route path="/tong-quan" element={<RoleGate allow={['OWNER', 'MANAGER']}><div>Bí mật</div></RoleGate>} /><Route path="/owner-registration" element={<div>Hoàn tất Owner</div>} /></Routes></MemoryRouter></SessionContext.Provider>)
    expect(screen.queryByText('Bí mật')).not.toBeInTheDocument()
    expect(screen.getByText('Hoàn tất Owner')).toBeInTheDocument()
  })

  it('opens farm selection when there is not exactly one active farm', () => {
    const session = { ...sessionFor('OWNER'), activeFarmCount: 2 }
    render(<SessionContext.Provider value={session}><MemoryRouter initialEntries={['/']}><Routes><Route path="/" element={<HomeRedirect />} /><Route path="/chon-trai" element={<div>Chọn trại</div>} /></Routes></MemoryRouter></SessionContext.Provider>)
    expect(screen.getByText('Chọn trại')).toBeInTheDocument()
  })

  it.each([
    ['TECHNICIAN', 'Trang kỹ thuật viên'],
    ['PM', 'Trang PM'],
  ] as const)('redirects %s away from a farm desk screen', (role, text) => {
    withSession(role, '/tong-quan', <RoleGate allow={['OWNER', 'MANAGER']}><div>Bí mật</div></RoleGate>)
    expect(screen.queryByText('Bí mật')).not.toBeInTheDocument()
    expect(screen.getByText(text)).toBeInTheDocument()
  })

  it('does not restrict a screen rendered outside a session', () => {
    render(<MemoryRouter><RoleGate allow={['SA']}><div>Nội dung</div></RoleGate></MemoryRouter>)
    expect(screen.getByText('Nội dung')).toBeInTheDocument()
  })
})

describe('shell menu by role', () => {
  const shell = (role: AppRole) => withSession(role, '/tong-quan', <Layout title="Tiêu đề"><div>Nội dung</div></Layout>)

  it('shows the owner-only farm items to the owner', () => {
    shell('OWNER')
    expect(screen.getByRole('link', { name: 'Gói dịch vụ' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Thông tin trại' })).toBeInTheDocument()
  })

  it('hides subscription and support from the manager', () => {
    shell('MANAGER')
    expect(screen.queryByRole('link', { name: 'Gói dịch vụ' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Thành viên & quyền' })).toBeInTheDocument()
  })

  it('gives platform roles their own menu without a farm selector', () => {
    shell('PM')
    expect(screen.getByRole('link', { name: 'Bảng giá gói' })).toBeInTheDocument()
    expect(screen.getByText('Platform Manager · PM')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Đàn bò' })).not.toBeInTheDocument()
    expect(screen.queryByText('Trại thử nghiệm')).not.toBeInTheDocument()
  })

  it('takes the display name and initials from the session', () => {
    shell('OWNER')
    expect(screen.getByText('Nguyễn Văn Hùng')).toBeInTheDocument()
    expect(screen.getByText('NH')).toBeInTheDocument()
    expect(screen.getByText('Trại thử nghiệm')).toBeInTheDocument()
  })
})

describe('mock sign-in', () => {
  it('has one demo account for each role', () => {
    expect(DEMO_USERS.map((user) => user.role).sort()).toEqual(['CS', 'MANAGER', 'OWNER', 'PM', 'SA', 'TECHNICIAN'])
  })

  it('keeps the chosen account across a reload and forgets it on sign-out', async () => {
    await createMockAuthClient().login('pm@beefcare.local', 'mock-demo')
    const afterReload = createMockAuthClient()
    expect(await afterReload.isAuthenticated()).toBe(true)
    expect(demoUserFor(sessionStorage.getItem('beefcare:mock-user')).role).toBe('PM')
    await afterReload.logout()
    expect(await createMockAuthClient().isAuthenticated()).toBe(false)
  })

  it('rejects an empty password', async () => {
    await expect(createMockAuthClient().login('owner@beefcare.local', '')).rejects.toThrow('Email hoặc mật khẩu chưa chính xác.')
  })
})
