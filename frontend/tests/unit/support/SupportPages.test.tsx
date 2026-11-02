import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { SessionContext } from '../../../src/features/authorization/sessionContext'
import { supportApi } from '../../../src/features/support/api/supportApi'
import { supportDemoStore } from '../../../src/features/support/data/supportDemoStore'
import SupportRoutes from '../../../src/features/support/pages/SupportRoutes'

const session = { role: 'OWNER' as const, fullName: 'Nguyễn Văn Hùng', email: 'hung@beefcare.vn', farmId: 1, farmName: 'Trại bò Yên Bài – Ba Vì', logout: async () => {} }

function Where() {
  const l = useLocation()
  return <output data-testid="where">{l.pathname + l.search}</output>
}
const renderAt = (path: string) =>
  render(
    <SessionContext.Provider value={session}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/ho-tro/*" element={<SupportRoutes />} />
        </Routes>
        <Where />
      </MemoryRouter>
    </SessionContext.Provider>,
  )

beforeEach(() => {
  vi.restoreAllMocks()
  void supportDemoStore.reset()
})

describe('SCR-64 danh sách ticket', () => {
  it('hiện ticket của tôi, lọc theo tab', async () => {
    const user = userEvent.setup()
    renderAt('/ho-tro')
    expect(await screen.findByText('TK-1042')).toBeInTheDocument()
    expect(screen.getByText('Tất cả (5)')).toBeInTheDocument()
    expect(screen.getByText('Chờ bạn xác nhận')).toBeInTheDocument()
    expect(screen.queryByText('TK-1043')).not.toBeInTheDocument()
    await user.click(screen.getByText('Chờ bạn phản hồi (1)'))
    expect(await screen.findByText('TK-1027')).toBeInTheDocument()
    expect(screen.queryByText('TK-1042')).not.toBeInTheDocument()
  })

  it('không có kết quả thì hiện trạng thái trống và xóa bộ lọc khôi phục danh sách', async () => {
    const user = userEvent.setup()
    renderAt('/ho-tro')
    await screen.findByText('TK-1042')
    await user.type(screen.getByPlaceholderText('Tìm mã / tiêu đề'), 'zzzz')
    expect(await screen.findByText('Không có ticket phù hợp')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Xóa bộ lọc/ }))
    expect(await screen.findByText('TK-1042')).toBeInTheDocument()
  })

  it('lỗi tải dữ liệu hiện hộp thoại và thử lại được', async () => {
    const user = userEvent.setup()
    vi.spyOn(supportApi, 'listTickets').mockRejectedValueOnce(new Error('boom'))
    renderAt('/ho-tro')
    const dialog = await screen.findByRole('dialog', { name: 'Chưa tải được dữ liệu' })
    await user.click(within(dialog).getByRole('button', { name: /Thử lại/ }))
    expect(await screen.findByText('TK-1042')).toBeInTheDocument()
  })
})

describe('SCR-65 gửi yêu cầu', () => {
  it('báo thiếu trường, giữ nội dung đã nhập, rồi gửi và hiện hộp thoại TK-1045', async () => {
    const user = userEvent.setup()
    renderAt('/ho-tro/moi')
    await user.click(await screen.findByRole('button', { name: /Gửi yêu cầu/ }))
    expect(await screen.findByText('Vui lòng chọn danh mục.')).toBeInTheDocument()
    expect(screen.getByText('Vui lòng nhập tiêu đề.')).toBeInTheDocument()
    expect(screen.getByText('Vui lòng nhập mô tả.')).toBeInTheDocument()

    await user.type(screen.getByLabelText(/Tiêu đề/, { selector: 'input' }), 'Chưa thấy xác nhận gia hạn')
    await user.selectOptions(screen.getByLabelText(/Danh mục/, { selector: 'select' }), 'PAYMENT')
    await user.type(screen.getByLabelText(/Mô tả chi tiết/, { selector: 'textarea' }), 'Đã chuyển khoản BCF7K2Q9')
    await user.click(screen.getByRole('button', { name: /Gửi yêu cầu/ }))

    const dialog = await screen.findByRole('dialog', { name: 'Đã gửi ticket TK-1045' })
    expect(within(dialog).getByText('MỚI NHẬN')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Xem ticket' }))
    expect(await screen.findByText(/TK-1045 · Chưa thấy xác nhận gia hạn/)).toBeInTheDocument()
    expect(screen.getByTestId('where')).toHaveTextContent('/ho-tro/1045')
  })

  it('phạm vi tài khoản không gắn trại', async () => {
    const user = userEvent.setup()
    renderAt('/ho-tro/moi')
    await user.click(await screen.findByText('Vấn đề tài khoản (không gắn trại)'))
    expect(screen.getByLabelText('Trang trại liên quan', { selector: 'select' })).toBeDisabled()
  })
})

describe('SCR-66 chi tiết ticket', () => {
  it('xác nhận kết quả: hiện hộp thoại, giữ Đã giải quyết và bỏ nút xác nhận', async () => {
    const user = userEvent.setup()
    renderAt('/ho-tro/1031')
    expect(await screen.findByText('Kết quả giải quyết · phiên bản 2')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Xác nhận đã giải quyết' }))
    const dialog = await screen.findByRole('dialog', { name: 'Bạn đã xác nhận kết quả' })
    expect(within(dialog).getByText('Kết quả phiên bản 2')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /Về ticket/ }))
    expect(screen.queryByRole('button', { name: 'Xác nhận đã giải quyết' })).not.toBeInTheDocument()
    expect(screen.getByText(/Bạn đã xác nhận kết quả này lúc/)).toBeInTheDocument()
  })

  it('mở lại bắt buộc lý do, rồi hiện ticket đã mở lại và xem được kết quả trước', async () => {
    const user = userEvent.setup()
    renderAt('/ho-tro/1031?m=mo-lai')
    await user.click(await screen.findByRole('button', { name: 'Xác nhận mở lại' }))
    expect(await screen.findByText('Vui lòng nhập lý do mở lại.')).toBeInTheDocument()
    await user.type(screen.getByLabelText(/Lý do mở lại/, { selector: 'textarea' }), 'Đã thử Chrome bản mới nhưng vẫn chưa quét được mã')
    await user.click(screen.getByRole('button', { name: 'Xác nhận mở lại' }))

    const reopened = await screen.findByRole('dialog', { name: 'Ticket TK-1031 đã mở lại' })
    expect(within(reopened).getByDisplayValue('Đang mở · Phạm Thu Hà tiếp tục phụ trách')).toBeInTheDocument()
    await user.click(within(reopened).getByRole('button', { name: 'Xem kết quả trước' }))
    const history = await screen.findByRole('dialog', { name: 'Lịch sử kết quả v2 · TK-1031' })
    expect(within(history).getByText(/chỉ đọc; không thể xác nhận hoặc đóng ticket/)).toBeInTheDocument()
  })

  it('kết quả mới hơn khi đang xem: báo đã thay đổi và tải lại phiên bản 3', async () => {
    const user = userEvent.setup()
    renderAt('/ho-tro/1031')
    await screen.findByText('Kết quả giải quyết · phiên bản 2')
    await supportDemoStore.simulateCsResolve(1031, 'Đã cấu hình lại bộ đọc thẻ cho máy này.')
    await user.click(screen.getByRole('button', { name: 'Xác nhận đã giải quyết' }))
    const dialog = await screen.findByRole('dialog', { name: 'Kết quả đã thay đổi' })
    await user.click(within(dialog).getByRole('button', { name: /Tải lại ticket/ }))
    expect(await screen.findByText('Kết quả giải quyết · phiên bản 3')).toBeInTheDocument()
  })

  it('gửi phản hồi: bắt buộc nội dung, cập nhật trạng thái khi đang chờ chủ trại', async () => {
    const user = userEvent.setup()
    renderAt('/ho-tro/1027')
    await user.click(await screen.findByRole('button', { name: /Gửi$/ }))
    expect(await screen.findByText('Vui lòng nhập nội dung phản hồi.')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Phản hồi công khai'), 'Mã yêu cầu là BCE3P8L2.')
    await user.click(screen.getByRole('button', { name: /Gửi$/ }))
    expect(await screen.findByText('Phản hồi của bạn đã được gửi.')).toBeInTheDocument()
    expect(screen.getByText('Mã yêu cầu là BCE3P8L2.')).toBeInTheDocument()
  })

  it('ticket đã đóng chỉ đọc; trả lời khi CS vừa đóng thì hiện hộp thoại đã đóng', async () => {
    const user = userEvent.setup()
    const closed = renderAt('/ho-tro/988')
    expect(await screen.findByText(/Ticket này đã đóng và chỉ đọc/)).toBeInTheDocument()
    expect(screen.getByLabelText('Phản hồi công khai')).toBeDisabled()
    expect(screen.queryByRole('button', { name: /Mở lại kèm lý do/ })).not.toBeInTheDocument()
    closed.unmount()

    renderAt('/ho-tro/1031')
    await screen.findByText('Kết quả giải quyết · phiên bản 2')
    await user.type(screen.getByLabelText('Phản hồi công khai'), 'Cảm ơn bộ phận hỗ trợ.')
    const t = await supportApi.getTicket(1031)
    await supportApi.acknowledge(1031, { resolutionVersion: 2, expectedVersion: t.version })
    await supportDemoStore.simulateCsClose(1031)
    await user.click(screen.getByRole('button', { name: /Gửi$/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Ticket TK-1031 đã đóng' })
    expect(within(dialog).getByText('Phiên bản 2')).toBeInTheDocument()
  })

  it('không mở được ticket của chủ trại khác', async () => {
    renderAt('/ho-tro/1043')
    expect(await screen.findByText('Bạn không có quyền thực hiện thao tác này.')).toBeInTheDocument()
  })
})
