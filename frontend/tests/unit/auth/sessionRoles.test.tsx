import { afterEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Layout from '../../../src/components/Layout'
import { createMockAuthClient } from '../../../src/features/authentication/client'
import { demoUserFor, DEMO_USERS } from '../../../src/features/authentication/demoUsers'
import { HomeRedirect, RoleGate, markOwnerRegistrationCompleted, sessionFromProfile, type AppRole } from '../../../src/features/authorization'
import { SessionContext, type Session } from '../../../src/features/authorization/sessionContext'
import { clearCurrentFarmId, writeCurrentFarmId } from '../../../src/api/currentFarm'

afterEach(() => clearCurrentFarmId())

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
  it('keeps the server account id for authorization checks', () => {
    expect(sessionFromProfile({ id: 47, fullName: 'CS thật', email: 'cs@x', platformRole: 'CS', farms: [] })).toMatchObject({ id: 47, role: 'CS' })
  })

  it('marks the in-memory session complete after owner registration succeeds', () => {
    expect(markOwnerRegistrationCompleted({ ...sessionFor('OWNER'), ownerRegistrationCompleted: false })).toMatchObject({ ownerRegistrationCompleted: true })
  })

  it('prefers the platform role over any farm role', () => {
    const session = sessionFromProfile({ fullName: 'Đỗ Minh Quân', email: 'pm@x', platformRole: 'PM', farms: [{ farmId: 9, farmName: 'A', role: 'OWNER' }] })
    expect(session.role).toBe('PM')
  })

  it('uses the role in the farm and keeps the numeric farm id', () => {
    const session = sessionFromProfile({ fullName: 'Mai', email: 'm@x', platformRole: null, farms: [{ farmId: 1, farmName: 'Trại A', role: 'TECHNICIAN' }] })
    expect(session).toMatchObject({ role: 'TECHNICIAN', farmId: 1, farmName: 'Trại A' })
  })

  it('uses the farm selected on this device when the account has several farms', () => {
    writeCurrentFarmId(9)
    const session = sessionFromProfile({ fullName: 'Mai', email: 'm@x', platformRole: null, farms: [
      { farmId: 1, farmName: 'Trại A', role: 'OWNER', serviceStatus: 'ACTIVE' },
      { farmId: 9, farmName: 'Trại B', role: 'TECHNICIAN', serviceStatus: 'ACTIVE' },
    ] })
    expect(session).toMatchObject({ role: 'TECHNICIAN', farmId: 9, farmName: 'Trại B', activeFarmCount: 2 })
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
    ['OWNER', 'Chọn trại'],
    ['MANAGER', 'Chọn trại'],
    ['TECHNICIAN', 'Chọn trại'],
    ['CS', 'Trang CS'],
    ['PM', 'Trang PM'],
    ['SA', 'Trang SA'],
  ] as const)('sends %s through its correct landing route from /', (role, text) => {
    withSession(role, '/', <div>Trang chủ trại</div>)
    expect(screen.getByText(text)).toBeInTheDocument()
  })

  it.each([
    ['OWNER', 'Trang chủ trại'],
    ['MANAGER', 'Trang chủ trại'],
    ['TECHNICIAN', 'Trang kỹ thuật viên'],
  ] as const)('opens the selected farm home for %s', (role, text) => {
    writeCurrentFarmId(1)
    withSession(role, '/', <div>Trang chủ trại</div>)
    expect(screen.getByText(text)).toBeInTheDocument()
  })

  it('sends an account with no farm and no platform role to owner registration (UC-FE01-02 AF4)', () => {
    const session = { ...sessionFor('OWNER'), farmId: null, farmName: null, activeFarmCount: 0, ownerRegistrationCompleted: false }
    render(<SessionContext.Provider value={session}><MemoryRouter initialEntries={['/']}><Routes><Route path="/" element={<HomeRedirect />} /><Route path="/owner-registration" element={<div>Hoàn tất Owner</div>} /></Routes></MemoryRouter></SessionContext.Provider>)
    expect(screen.getByText('Hoàn tất Owner')).toBeInTheDocument()
  })

  it.each([
    ['MANAGER', 'Trang chủ trại', null],
    ['TECHNICIAN', 'Trang kỹ thuật viên', null],
    ['PM', 'Trang PM', 'PM'],
  ] as const)('lets a %s with an unfinished owner profile reach their own home (D28)', (role, text, platformRole) => {
    writeCurrentFarmId(1)
    const session = { ...sessionFor(role), platformRole, ownerRegistrationCompleted: false }
    render(<SessionContext.Provider value={session}><MemoryRouter initialEntries={['/']}><Routes><Route path="/" element={<HomeRedirect />} /><Route path="/tong-quan" element={<RoleGate allow={['OWNER', 'MANAGER']}><div>Trang chủ trại</div></RoleGate>} /><Route path="/kt" element={<RoleGate allow={['TECHNICIAN']}><div>Trang kỹ thuật viên</div></RoleGate>} /><Route path="/nen-tang/dich-vu" element={<div>Trang PM</div>} /><Route path="/owner-registration" element={<div>Hoàn tất Owner</div>} /></Routes></MemoryRouter></SessionContext.Provider>)
    expect(screen.getByText(text)).toBeInTheDocument()
    expect(screen.queryByText('Hoàn tất Owner')).not.toBeInTheDocument()
  })

  it('keeps an incomplete owner without any farm out of a directly requested farm screen', () => {
    const session = { ...sessionFor('OWNER'), farmId: null, farmName: null, activeFarmCount: 0, ownerRegistrationCompleted: false }
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
    expect(screen.getByText('Quản lý nền tảng · PM')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Đàn bò' })).not.toBeInTheDocument()
    expect(screen.queryByText('Trại thử nghiệm')).not.toBeInTheDocument()
  })

  it('shows the CS role in Vietnamese', () => {
    shell('CS')
    expect(screen.getByText('Nhân viên hỗ trợ · CS')).toBeInTheDocument()
    expect(screen.getByText('Nhân viên hỗ trợ')).toBeInTheDocument()
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
