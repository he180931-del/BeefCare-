import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { SessionContext, type Session } from '../../../src/features/authorization/sessionContext'
import { subscriptionDemoStore } from '../../../src/features/subscription/data/subscriptionDemoStore'
import FirstSubscriptionPage from '../../../src/features/subscription/pages/FirstSubscriptionPage'
import SubscriptionRoutes from '../../../src/features/subscription/pages/SubscriptionRoutes'

function Where() {
  const l = useLocation()
  return <output data-testid="where">{l.pathname}{l.search}</output>
}

function renderAt(path: string, role?: Session['role']) {
  const tree = (
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/dang-ky-goi" element={<FirstSubscriptionPage />} />
        <Route path="/goi-dich-vu/*" element={<SubscriptionRoutes />} />
        <Route path="*" element={<div>trang khác</div>} />
      </Routes>
      <Where />
    </MemoryRouter>
  )
  const session: Session | null = role ? { role, fullName: 'Nguyễn Văn Hùng', email: 'hung.nv@gmail.com', farmId: 1, farmName: 'Trại bò Yên Bài – Ba Vì', logout: async () => {} } : null
  return render(session ? <SessionContext.Provider value={session}>{tree}</SessionContext.Provider> : tree)
}

beforeEach(async () => { await subscriptionDemoStore.reset() })

describe('Gói dịch vụ của trại', () => {
  it('hiện trạng thái dịch vụ, bảng giá và các kỳ đã mua', async () => {
    renderAt('/goi-dich-vu', 'OWNER')
    expect(await screen.findByText('15/11/2025 → 14/11/2026', { selector: 'dd' })).toBeInTheDocument()
    expect(screen.getByText('27 ngày')).toBeInTheDocument()
    expect(screen.getByText('Đang hoạt động')).toBeInTheDocument()
    expect(screen.getByText('3.060.000 đ')).toBeInTheDocument()
    const periods = screen.getByText('Các kỳ đã mua').closest('section, div') as HTMLElement
    expect(within(periods.parentElement as HTMLElement).getByText('BCA9X2M1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Gia hạn gói' })).toBeEnabled()
  })

  it('trại tạm ngưng không gia hạn được và hiện hộp thoại khi vào thẳng trang gia hạn', async () => {
    const first = renderAt('/goi-dich-vu?farm=3', 'OWNER')
    expect(await screen.findByText(/đang tạm ngưng dịch vụ/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Gia hạn gói' })).toBeDisabled()
    first.unmount()
    renderAt('/goi-dich-vu/gia-han?farm=3', 'OWNER')
    expect(await screen.findByRole('dialog', { name: 'Trại đang tạm ngưng dịch vụ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Gửi hỗ trợ/ })).toBeInTheDocument()
  })

  it('chỉ Owner: vai trò khác thấy thông báo không có quyền', async () => {
    renderAt('/goi-dich-vu', 'MANAGER')
    expect(await screen.findByText('Bạn không có quyền thực hiện thao tác này.')).toBeInTheDocument()
    expect(screen.queryByText('Trạng thái dịch vụ')).not.toBeInTheDocument()
  })
})

describe('Chọn thời hạn và tạo yêu cầu', () => {
  it('chưa chọn thời hạn thì chưa tạo được; chọn xong tạo yêu cầu mới và mở hướng dẫn', async () => {
    const user = userEvent.setup()
    renderAt('/goi-dich-vu/gia-han?farm=2', 'OWNER')
    const create = await screen.findByRole('button', { name: /Tạo yêu cầu thanh toán/ })
    expect(create).toBeDisabled()
    await user.click(screen.getByRole('radio', { name: /2 năm/ }))
    expect(screen.getAllByText('2.160.000 đ').length).toBeGreaterThan(1)
    expect(screen.getByText('18/10/2026 → 18/10/2028', { exact: false })).toBeInTheDocument()
    await user.click(create)
    expect(await screen.findByText(/Yêu cầu BCK4M7R2 · 2 năm/)).toBeInTheDocument()
    expect(screen.getByText('0386 671 863 000')).toBeInTheDocument()
    expect(screen.getByLabelText('Mã VietQR minh họa (demo)')).toBeInTheDocument()
    expect(screen.getByTestId('where')).toHaveTextContent('/goi-dich-vu/chuyen-khoan/BCK4M7R2?from=subscription&farm=2')
  })

  it('đã có yêu cầu còn hiệu lực: hộp thoại cho mở lại hướng dẫn cũ', async () => {
    const user = userEvent.setup()
    renderAt('/goi-dich-vu/gia-han', 'OWNER')
    await user.click(await screen.findByRole('radio', { name: /1 năm/ }))
    await user.click(screen.getByRole('button', { name: /Tạo yêu cầu thanh toán/ }))
    expect(await screen.findByRole('dialog', { name: 'Bạn đã có yêu cầu còn hiệu lực' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Mở lại hướng dẫn' }))
    expect(await screen.findByText(/Yêu cầu BCF7K2Q9 · 1 năm/)).toBeInTheDocument()
  })

  it('giá đổi sau khi xem: báo giá cũ và giá mới rồi xem lại giá mới', async () => {
    const user = userEvent.setup()
    renderAt('/goi-dich-vu/gia-han?farm=2&term=1', 'OWNER')
    const create = await screen.findByRole('button', { name: /Tạo yêu cầu thanh toán/ })
    await subscriptionDemoStore.publishPriceVersion({ id: 4, price1y: 1_320_000, price2y: 2_376_000, price3y: 3_366_000, effectiveAt: new Date(subscriptionDemoStore.now() - 1000).toISOString() })
    await user.click(create)
    const dialog = await screen.findByRole('dialog', { name: 'Bảng giá đã thay đổi' })
    expect(within(dialog).getByText('v3 · 1 năm · 1.200.000 đ')).toBeInTheDocument()
    expect(within(dialog).getByText('v4 · 1 năm · 1.320.000 đ')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Xem lại giá mới' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByText(/v4 · từ/)).toBeInTheDocument()
    expect(screen.getByText('1.320.000 đ', { selector: 'dd' })).toBeInTheDocument()
  })

  it('bảng giá không lấy được: hộp thoại giá chưa khả dụng', async () => {
    renderAt('/goi-dich-vu/gia-han?demo=price-unavailable', 'OWNER')
    expect(await screen.findByRole('dialog', { name: 'Giá gói chưa khả dụng' })).toBeInTheDocument()
  })

  it('đăng ký gói lần đầu của trại mới dẫn tới hướng dẫn chuyển khoản', async () => {
    const user = userEvent.setup()
    renderAt('/dang-ky-goi', 'OWNER')
    expect(await screen.findByText('Đăng ký gói dịch vụ · Trại Tản Lĩnh')).toBeInTheDocument()
    expect(screen.getByText('Đang chờ thanh toán')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: /1 năm/ }))
    await user.click(screen.getByRole('button', { name: /Tạo yêu cầu thanh toán/ }))
    expect(await screen.findByText(/Yêu cầu BCK4M7R2 · 1 năm · Trại Tản Lĩnh/)).toBeInTheDocument()
    expect(screen.getByTestId('where')).toHaveTextContent('from=onboarding')
  })
})

describe('Mở từ màn chọn trại (UC-FE02-02 AF1, MSG-FE02-03)', () => {
  const banner = 'Trại Tản Lĩnh đang ở trạng thái Chờ thanh toán. Chỉ dùng được thông tin trại, gói dịch vụ và hỗ trợ.'

  it('chọn thời hạn lần đầu hiện banner trạng thái khi Owner mở trại chưa hoạt động từ màn chọn trại', async () => {
    renderAt('/dang-ky-goi?farm=2&from=chon-trai', 'OWNER')
    expect(await screen.findByText(banner)).toBeInTheDocument()
  })

  it('luồng đăng ký trại mới không hiện banner', async () => {
    renderAt('/dang-ky-goi?farm=2', 'OWNER')
    expect(await screen.findByText('Đăng ký gói dịch vụ · Trại Tản Lĩnh')).toBeInTheDocument()
    expect(screen.queryByText(banner)).not.toBeInTheDocument()
  })

  it('trang gia hạn cũng hiện banner khi mở từ màn chọn trại', async () => {
    renderAt('/goi-dich-vu/gia-han?farm=2&from=chon-trai', 'OWNER')
    expect(await screen.findByText(banner)).toBeInTheDocument()
  })
})

describe('Hướng dẫn chuyển khoản', () => {
  it('hiện bộ đếm ngược, tiến trình và thông tin chuyển khoản của yêu cầu đang chờ', async () => {
    renderAt('/goi-dich-vu/chuyen-khoan/BCF7K2Q9', 'OWNER')
    expect(await screen.findByText('Thông tin chuyển khoản')).toBeInTheDocument()
    expect(screen.getByText(/^23:\d\d:\d\d$/)).toBeInTheDocument()
    expect(screen.getByText('08:42 19/10/2026')).toBeInTheDocument()
    expect(screen.getByText('MB Bank (Ngân hàng Quân đội)')).toBeInTheDocument()
    expect(screen.getByText('Ngân hàng ghi nhận giao dịch').closest('tr')).toHaveTextContent('Đang chờ')
    expect(screen.getAllByRole('button', { name: /^Sao chép/ })).toHaveLength(5)
  })

  it('kiểm tra lại khi giao dịch về: yêu cầu thành PAID và mở kỳ mới', async () => {
    const user = userEvent.setup()
    renderAt('/goi-dich-vu/chuyen-khoan/BCF7K2Q9?demo=bank-paid', 'OWNER')
    await user.click(await screen.findByRole('button', { name: 'Kiểm tra lại' }))
    expect(await screen.findByText(/đã được xác nhận\. Kỳ dịch vụ 15\/11\/2026 → 14\/11\/2027/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Về gói dịch vụ' })).toBeInTheDocument()
  })

  it('không lấy được kết quả: giữ nguyên yêu cầu và cho thử lại', async () => {
    const user = userEvent.setup()
    renderAt('/goi-dich-vu/chuyen-khoan/BCF7K2Q9?demo=result-unavailable', 'OWNER')
    await user.click(await screen.findByRole('button', { name: 'Kiểm tra lại' }))
    const dialog = await screen.findByRole('dialog', { name: 'Chưa lấy được kết quả thanh toán' })
    expect(within(dialog).getByText('BCF7K2Q9 · 1 năm')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Thử lại' })).toBeInTheDocument()
  })

  it('yêu cầu đã hết hạn: ẩn mã QR và mời tạo yêu cầu mới', async () => {
    renderAt('/goi-dich-vu/chuyen-khoan/BCE3P8L2', 'OWNER')
    expect(await screen.findByRole('dialog', { name: 'Yêu cầu đã hết hạn' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Mã VietQR minh họa (demo)')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Tạo yêu cầu mới/ })).toBeInTheDocument()
  })
})

describe('Lịch sử thanh toán', () => {
  it('liệt kê, lọc theo mã và mở chi tiết thanh toán đã xác nhận', async () => {
    const user = userEvent.setup()
    renderAt('/goi-dich-vu/lich-su', 'OWNER')
    expect(await screen.findByText('BCF7K2Q9')).toBeInTheDocument()
    expect(screen.getByText('BC77QK30')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Tìm mã thanh toán'), 'a9x')
    await waitFor(() => expect(screen.queryByText('BC77QK30')).not.toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Xem BCA9X2M1' }))
    const dialog = await screen.findByRole('region', { name: 'Chi tiết thanh toán' })
    expect(within(dialog).getByText('10/11/2025 09:15:40')).toBeInTheDocument()
    expect(within(dialog).getByText('15/11/2025 → 14/11/2026')).toBeInTheDocument()
    await user.click(within(dialog).getAllByRole('button', { name: 'Đóng' }).at(-1)!)
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Chi tiết thanh toán' })).not.toBeInTheDocument())
  })

  it('yêu cầu đang chờ mở lại hướng dẫn', async () => {
    const user = userEvent.setup()
    renderAt('/goi-dich-vu/lich-su', 'OWNER')
    await user.click(await screen.findByRole('button', { name: 'Mở lại' }))
    expect(await screen.findByText(/Yêu cầu BCF7K2Q9/)).toBeInTheDocument()
  })

  it('xem yêu cầu đã hết hạn từ lịch sử', async () => {
    renderAt('/goi-dich-vu/lich-su/BCE3P8L2', 'OWNER')
    const detail = await screen.findByRole('region', { name: 'Chi tiết thanh toán' })
    expect(within(detail).getByText('BCE3P8L2')).toBeInTheDocument()
    expect(within(detail).getByText('2.160.000 đ')).toBeInTheDocument()
  })

  it('trại chưa có thanh toán: trạng thái rỗng dẫn về gói của trại', async () => {
    renderAt('/goi-dich-vu/lich-su?farm=2', 'OWNER')
    expect(await screen.findByText('Chưa có thanh toán nào')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xem gói của trại' })).toBeInTheDocument()
  })
})
