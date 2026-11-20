import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import App from '../../../src/app/routes/AppRoutes'

function Where() {
  const location = useLocation()
  return <output data-testid="where" data-return-to={(location.state as { returnTo?: string } | null)?.returnTo ?? ''}>{location.pathname}</output>
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
})

describe('farm screens without an entered farm (UC-FE02-02)', () => {
  beforeEach(() => sessionStorage.clear())
  it.each(['/tong-quan', '/cattle', '/pens', '/thuc-an/nhat-ky', '/thanh-vien', '/kt', '/kt/dan-bo/BC-1'])('sends %s to Select Farm instead of a default farm', async (path) => {
    render(<MemoryRouter initialEntries={[path]}><App /><Where /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'Chọn trang trại' })).toBeInTheDocument()
    expect(screen.getByTestId('where')).toHaveTextContent('/chon-trai')
  })

  it('remembers the requested screen so Select Farm can come back to it', async () => {
    render(<MemoryRouter initialEntries={['/cattle/BC-000142?tab=vaccine']}><App /><Where /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'Chọn trang trại' })).toBeInTheDocument()
    expect(screen.getByTestId('where')).toHaveAttribute('data-return-to', '/cattle/BC-000142?tab=vaccine')
  })

  it.each([['/ho-so', 'Hồ sơ & quyền của tôi'], ['/kt/tai-khoan', 'Tài khoản']])('keeps the account page %s open: profile and password do not need a farm', async (path, heading) => {
    render(<MemoryRouter initialEntries={[path]}><App /><Where /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument()
    expect(screen.getByTestId('where')).toHaveTextContent(path)
  })

  it('keeps the Owner pages that name their farm in the address (?farm=, ?farmId=) reachable', async () => {
    render(<MemoryRouter initialEntries={['/thong-tin-trai?farmId=1']}><App /><Where /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'Thông tin trại' })).toBeInTheDocument()
  })
})
