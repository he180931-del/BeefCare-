import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import App from '../../../src/app/routes/AppRoutes'
import { SessionContext, type Session } from '../../../src/app/session/sessionContext'

function Where() {
  const location = useLocation()
  return <output data-testid="where" data-search={location.search} data-return-to={(location.state as { returnTo?: string } | null)?.returnTo ?? ''}>{location.pathname}</output>
}

const routeCases = [
  ['/terms', 'Điều khoản sử dụng'],
  ['/data-policy', 'Chính sách dữ liệu'],
  ['/owner-registration', 'Hoàn tất hồ sơ chủ trại'],
  ['/chon-trai', 'Chọn trang trại'],
  ['/dang-ky-trai', 'Đăng ký trang trại'],
  ['/thong-tin-trai?farmId=1', 'Thông tin trại'],
  ['/thanh-vien?farmId=1', 'Thành viên & vai trò'],
  ['/loi-moi?farmId=1', 'Lời mời thành viên'],
  ['/invitation/accept?token=route-smoke', 'Lời mời không còn hiệu lực'],
  ['/sinh-san', 'Sinh sản'],
  ['/cattle/BC-000087/sinh-san/de', 'Ghi sự kiện đẻ'],
  ['/thuc-an/hom-nay', 'Khẩu phần hôm nay'],
] as const

describe('application route smoke', () => {
  it.each(routeCases)('renders %s through its registered route', async (path, heading) => {
    render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument()
  })

  it('does not expose the internal SRS source note on the public legal page', async () => {
    render(<MemoryRouter initialEntries={['/terms']}><App /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'Điều khoản sử dụng' })).toBeInTheDocument()
    expect(screen.queryByText(/SRS 28\/10\/2026/)).not.toBeInTheDocument()
  })
})

describe('farm screens without an entered farm (UC-FE02-02)', () => {
  beforeEach(() => sessionStorage.clear())
  it.each(['/tong-quan', '/cattle', '/pens', '/thuc-an/nhat-ky', '/thanh-vien', '/bao-cao-thu-chi', '/kt', '/kt/dan-bo/BC-1'])('sends %s to Select Farm instead of a default farm', async (path) => {
    render(<MemoryRouter initialEntries={[path]}><App /><Where /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'Chọn trang trại' })).toBeInTheDocument()
    expect(screen.getByTestId('where')).toHaveTextContent('/chon-trai')
  })

  // A code is unique only within its farm: the address names no farm, so the record is not reopened in whichever farm
  // gets entered; the section that lists it is.
  it.each([
    ['/cattle/BC-000142?tab=vaccine', '/cattle'],
    ['/cattle/BC-000087/sinh-san/de', '/cattle'],
    ['/kt/dan-bo/BC-1', '/kt/dan-bo'],
    ['/herd-entry/new?id=PN-2026-0001', '/herd-entry/new'],
    ['/thuc-an/kiem-ke', '/thuc-an/kiem-ke'],
  ])('remembers the section of %s so Select Farm comes back to %s', async (path, section) => {
    render(<MemoryRouter initialEntries={[path]}><App /><Where /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'Chọn trang trại' })).toBeInTheDocument()
    expect(screen.getByTestId('where')).toHaveAttribute('data-return-to', section)
  })

  it.each(['/tai-khoan', '/quyen-theo-vai-tro', '/ho-so', '/kt/tai-khoan', '/nen-tang/ho-so'])('redirects the retired account route %s to the authenticated home flow', async (path) => {
    render(<MemoryRouter initialEntries={[path]}><App /><Where /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'Chọn trang trại' })).toBeInTheDocument()
    expect(screen.getByTestId('where')).toHaveTextContent('/chon-trai')
  })

  it('keeps the password modal parameters after Google returns through the retired account route', async () => {
    render(<MemoryRouter initialEntries={['/tai-khoan?m=doi-mat-khau&googleReauthenticated=true']}><App /><Where /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'Chọn trang trại' })).toBeInTheDocument()
    expect(screen.getByTestId('where')).toHaveAttribute('data-search', '?m=doi-mat-khau&googleReauthenticated=true')
  })

  it('keeps the Owner pages that name their farm in the address (?farm=, ?farmId=) reachable', async () => {
    render(<MemoryRouter initialEntries={['/thong-tin-trai?farmId=1']}><App /><Where /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'Thông tin trại' })).toBeInTheDocument()
  })
})

describe('an account with several farm roles', () => {
  // Owner of farm 1, Technician of farm 9. Without a farm in the tab the session role is the strongest one (OWNER).
  const mixed: Session = { role: 'OWNER', fullName: 'Mai', email: 'mai@example.test', farmId: null, farmName: null, farmRoles: { 1: 'OWNER', 9: 'TECHNICIAN' }, logout: async () => {} }
  const renderAs = (session: Session, path: string) => render(
    <SessionContext.Provider value={session}><MemoryRouter initialEntries={[path]}><App /><Where /></MemoryRouter></SessionContext.Provider>,
  )
  beforeEach(() => sessionStorage.clear())

  it.each([['/kt/nhac-viec', '/kt/nhac-viec'], ['/kt/dan-bo/BC-1', '/kt/dan-bo']])(
    'asks for the farm before the role, so %s is not lost to the Owner home', async (path, section) => {
      renderAs(mixed, path)
      expect(await screen.findByRole('heading', { name: 'Chọn trang trại' })).toBeInTheDocument()
      expect(screen.getByTestId('where')).toHaveAttribute('data-return-to', section)
    },
  )

  it('checks an Owner page named by ?farmId= against the role in that farm', async () => {
    sessionStorage.setItem('beefcare.currentFarmId', '1')
    renderAs({ ...mixed, farmId: 1, farmName: 'Trại A', farmRoles: { 1: 'OWNER', 9: 'MANAGER' } }, '/thong-tin-trai?farmId=9')
    expect(await screen.findByTestId('where')).toHaveTextContent('/tong-quan')
    expect(screen.queryByRole('heading', { name: 'Thông tin trại' })).not.toBeInTheDocument()
  })
})
