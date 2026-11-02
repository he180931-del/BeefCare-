import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { SessionContext } from '../../../src/features/authorization/sessionContext'
import { platformServiceDemoStore } from '../../../src/features/platform-service/data/platformServiceDemoStore'
import FarmServiceRoutes from '../../../src/features/platform-service/pages/FarmServiceRoutes'
import PaymentReconciliationRoutes from '../../../src/features/platform-service/pages/PaymentReconciliationRoutes'
import PlanPriceRoutes from '../../../src/features/platform-service/pages/PlanPriceRoutes'
import PlatformSubscriptionRoutes from '../../../src/features/platform-service/pages/PlatformSubscriptionRoutes'

const session = (role: 'PM' | 'SA') => ({ role, fullName: 'Đỗ Minh Quân', email: 'pm@beefcare.vn', farmId: null, farmName: null, logout: async () => {} })
const renderAt = (node: JSX.Element, path: string, role: 'PM' | 'SA' = 'PM') =>
  render(
    <SessionContext.Provider value={session(role)}>
      <MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>
    </SessionContext.Provider>,
  )

beforeEach(async () => {
  await platformServiceDemoStore.reset()
})

describe('SCR-12 dịch vụ trang trại', () => {
  it('restores a suspended farm with a required reason', async () => {
    const user = userEvent.setup()
    renderAt(<FarmServiceRoutes />, '/nen-tang/dich-vu')
    expect(await screen.findByText('Hiển thị 6 / 128 trại')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Khôi phục/ }))
    const dialog = await screen.findByText('Khôi phục dịch vụ – Trại Suối Hai')
    expect(dialog).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Khôi phục dịch vụ' }))
    expect(await screen.findByText('Lý do khôi phục là bắt buộc.')).toBeInTheDocument()
    await user.type(screen.getByRole('textbox', { name: /Lý do khôi phục/ }), 'Chủ trại xác nhận qua TK-1027')
    await user.click(screen.getByRole('button', { name: 'Khôi phục dịch vụ' }))
    expect(await screen.findByText(/Dịch vụ của Trại Suối Hai hiện đang hoạt động/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Khôi phục/ })).not.toBeInTheDocument()
  })

  it('shows an empty state for a search with no result and is read-only for other roles', async () => {
    const user = userEvent.setup()
    renderAt(<FarmServiceRoutes />, '/nen-tang/dich-vu', 'SA')
    await screen.findByText('Hiển thị 6 / 128 trại')
    for (const b of screen.getAllByRole('button', { name: 'Tạm ngừng' })) expect(b).toBeDisabled()
    await user.type(screen.getByLabelText('Tìm trại'), 'khongco')
    expect(await screen.findByText('Không có trại phù hợp')).toBeInTheDocument()
  })
})

describe('SCR-61 gói đăng ký', () => {
  it('selects a farm, shows the empty subscription note and opens the periods dialog', async () => {
    const user = userEvent.setup()
    renderAt(<PlatformSubscriptionRoutes />, '/nen-tang/goi-dang-ky')
    expect(await screen.findByText(/SUB-0048/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Trại Tản Lĩnh/ }))
    expect(await screen.findByText(/Chưa có đăng ký nên chưa có kỳ/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Trại bò Yên Bài/ }))
    await user.click(await screen.findByRole('button', { name: 'Kỳ hiện tại / tương lai' }))
    expect(await screen.findByText('Các kỳ đã mua của Yên Bài')).toBeInTheDocument()
    expect(screen.getByDisplayValue('BCA9X2M1 · 10/11/2025 09:31')).toBeInTheDocument()
  })
})

describe('SCR-62 thanh toán và đối soát', () => {
  it('blocks accepting a mistyped code and keeps the evidence on hold instead', async () => {
    const user = userEvent.setup()
    renderAt(<PaymentReconciliationRoutes />, '/nen-tang/thanh-toan')
    expect(await screen.findByText('FT26291000842')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Kiểm tra và chấp nhận' }))
    expect(await screen.findByText('Lý do & bằng chứng là bắt buộc.')).toBeInTheDocument()
    await user.type(screen.getByRole('textbox', { name: /Lý do & bằng chứng/ }), 'Mã có dấu cách')
    await user.click(screen.getByRole('button', { name: 'Kiểm tra và chấp nhận' }))
    expect(await screen.findByText('Chưa thể Chấp nhận chứng từ')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Giữ Tạm giữ để xác minh' }))
    expect(await screen.findByText(/Đã lưu quyết định Tạm giữ/)).toBeInTheDocument()
    expect((await screen.findAllByText('Tạm giữ')).length).toBeGreaterThan(0)
  })

  it('accepts a code-matched evidence once and reports the receipt', async () => {
    const user = userEvent.setup()
    renderAt(<PaymentReconciliationRoutes />, '/nen-tang/thanh-toan')
    await user.click(await screen.findByRole('button', { name: 'FT26291…843' }))
    await user.type(await screen.findByRole('textbox', { name: /Lý do & bằng chứng/ }), 'Nguồn tin cậy; các kiểm tra đều đạt')
    await user.click(screen.getByRole('button', { name: 'Kiểm tra và chấp nhận' }))
    expect(await screen.findByText('Xem lại Chấp nhận — mã đã khớp')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Xác nhận Chấp nhận' }))
    expect(await screen.findByText('Đã xác nhận thanh toán')).toBeInTheDocument()
    expect(screen.getByDisplayValue('RC-26-0412')).toBeInTheDocument()
  })

  it('does not let a non-PM act on evidence', async () => {
    renderAt(<PaymentReconciliationRoutes />, '/nen-tang/thanh-toan', 'SA')
    await screen.findByText('FT26291000842')
    expect(screen.getByRole('button', { name: 'Kiểm tra và chấp nhận' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Khóa chờ hoàn tiền' })).toBeDisabled()
  })
})

describe('SCR-63 bảng giá gói', () => {
  it('explains an invalid price, then schedules v4 and shows it in the history', async () => {
    const user = userEvent.setup()
    renderAt(<PlanPriceRoutes />, '/nen-tang/bang-gia')
    expect(await screen.findByText('Soạn bảng giá v4')).toBeInTheDocument()
    expect(screen.getAllByText('1.200.000 đ').length).toBeGreaterThan(0)
    const price1 = screen.getByRole('textbox', { name: /Giá 1 năm/ })
    await user.clear(price1)
    await user.type(price1, '0')
    await user.click(screen.getByRole('button', { name: 'Công bố v4' }))
    expect(await screen.findByText('Chưa thể công bố bảng giá')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Về chỉnh bảng giá/ }))
    await user.clear(price1)
    await user.type(price1, '1.100.000')
    fireEvent.change(document.getElementById('eff') as HTMLElement, { target: { value: '2099-01-01T00:00' } })
    await user.click(screen.getByRole('button', { name: 'Công bố v4' }))
    await user.click(await screen.findByRole('button', { name: 'Công bố phiên bản' }))
    expect(await screen.findByText('Đã công bố bảng giá v4')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Về bảng giá/ }))
    const history = (await screen.findByText('Lịch sử công bố')).closest('section') ?? document.body
    expect(within(history as HTMLElement).getByText('Lên lịch')).toBeInTheDocument()
  })
})
