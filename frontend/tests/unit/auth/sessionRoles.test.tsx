import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { writeCurrentFarmId } from '../../../src/api/currentFarm'
import Layout from '../../../src/components/Layout'
import { createMockAuthClient } from '../../../src/features/authentication/client'
import { demoUserFor, DEMO_USERS } from '../../../src/features/authentication/demoUsers'
import { HomeRedirect, RoleGate, isStaleFarmSelection, sessionFromProfile, type AppRole } from '../../../src/features/authorization'
import { SessionContext, type Session } from '../../../src/features/authorization/sessionContext'

const sessionFor = (role: AppRole): Session => ({
  role, fullName: 'Nguyễn Văn Hùng', email: 'x@beefcare.local', farmId: 1, farmName: 'Trại thử nghiệm', logout: async () => undefined,
})

const withSession = (role: AppRole, path: string, element: React.ReactElement) => render(
  <SessionContext.Provider value={sessionFor(role)}>
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/chon-trai" element={<div>Chọn trang trại</div>} />
        <Route path="/tong-quan" element={element} />
        <Route path="/kt" element={<div>Trang kỹ thuật viên</div>} />
        <Route path="/nen-tang/ho-tro" element={<div>Trang CS</div>} />
        <Route path="/nen-tang/dich-vu" element={<div>Trang PM</div>} />
        <Route path="/nen-tang/tai-khoan" element={<div>Trang SA</div>} />
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

  it('UC-FE02-02 E1: a farm kept for this tab that is no longer in the profile is stale', () => {
    const profile = { farms: [{ farmId: 1, farmName: 'Trại A', role: 'OWNER' }] }
    expect(isStaleFarmSelection(profile, 5)).toBe(true)
    expect(isStaleFarmSelection(profile, 1)).toBe(false)
    expect(isStaleFarmSelection(profile, null)).toBe(false)
  })
})

describe('role navigation', () => {
  beforeEach(() => sessionStorage.clear())

  it.each([
    ['OWNER', 'Trang chủ trại'],
    ['MANAGER', 'Trang chủ trại'],
    ['TECHNICIAN', 'Trang kỹ thuật viên'],
    ['CS', 'Trang CS'],
    ['PM', 'Trang PM'],
    ['SA', 'Trang SA'],
  ] as const)('sends %s to its own home from / once a farm is entered in this tab', (role, text) => {
    writeCurrentFarmId(1)
    withSession(role, '/', <div>Trang chủ trại</div>)
    expect(screen.getByText(text)).toBeInTheDocument()
  })

  it.each(['OWNER', 'MANAGER', 'TECHNICIAN'] as const)('UC-FE02-02 sends %s to Select Farm after sign-in when no farm is entered yet', (role) => {
    withSession(role, '/', <div>Trang chủ trại</div>)
    expect(screen.getByText('Chọn trang trại')).toBeInTheDocument()
  })

  it.each([['PM', 'Trang PM'], ['SA', 'Trang SA']] as const)('keeps %s on its platform home without a farm', (role, text) => {
    withSession(role, '/', <div>Trang chủ trại</div>)
    expect(screen.getByText(text)).toBeInTheDocument()
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
