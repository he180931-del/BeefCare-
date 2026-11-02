import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../../../src/App'

const routeCases = [
  ['/owner-registration', 'Hoàn tất hồ sơ chủ trại'],
  ['/chon-trai', 'Chọn trang trại'],
  ['/dang-ky-trai', 'Đăng ký trang trại'],
  ['/thong-tin-trai?farmId=1', 'Thông tin trại'],
  ['/thanh-vien?farmId=1', 'Thành viên & vai trò'],
  ['/loi-moi?farmId=1', 'Lời mời thành viên'],
  ['/chap-nhan-loi-moi?token=route-smoke', 'Lời mời không còn hiệu lực'],
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
