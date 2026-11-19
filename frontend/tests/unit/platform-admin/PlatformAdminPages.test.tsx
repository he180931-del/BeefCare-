import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { SessionContext, type Session } from '../../../src/features/authorization/sessionContext'
import { platformAdminDemoStore } from '../../../src/features/platform-admin/data/platformAdminDemoStore'
import AdminNoticePage from '../../../src/features/platform-admin/pages/AdminNoticePage'
import AuditRoutes from '../../../src/features/platform-admin/pages/AuditRoutes'
import StaffAccessRoutes from '../../../src/features/platform-admin/pages/StaffAccessRoutes'
import UserAccountRoutes from '../../../src/features/platform-admin/pages/UserAccountRoutes'

const session = (role: Session['role']): Session => ({ role, fullName: 'Vũ Hoàng Nam', email: 'nam.vh@beefcare.vn', farmId: null, farmName: null, logout: async () => {} })

function renderAt(path: string, role: Session['role'] = 'SA') {
  return render(
    <SessionContext.Provider value={session(role)}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/nen-tang/tai-khoan/*" element={<UserAccountRoutes />} />
          <Route path="/nen-tang/quyen/*" element={<StaffAccessRoutes />} />
          <Route path="/nen-tang/audit/*" element={<AuditRoutes />} />
          <Route path="/nen-tang/thong-bao" element={<AdminNoticePage />} />
          <Route path="/nen-tang/yeu-cau/*" element={<p>Trang yêu cầu nội bộ</p>} />
        </Routes>
      </MemoryRouter>
    </SessionContext.Provider>,
  )
}

beforeEach(async () => { await platformAdminDemoStore.reset() })

describe('Tài khoản người dùng', () => {
  it('đọc ?q= làm tìm kiếm ban đầu và mở khóa tài khoản sau khi nhập lý do', async () => {
    const user = userEvent.setup()
    renderAt('/nen-tang/tai-khoan?q=ho van')
    expect(await screen.findByRole('button', { name: /Hồ Văn Tài/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Nguyễn Văn Hùng/ })).not.toBeInTheDocument()

    await user.click(await screen.findByRole('button', { name: /Mở khóa tài khoản/ }))
    expect(screen.getByText('Lý do là bắt buộc.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.type(screen.getByPlaceholderText(/Nhập lý do/), 'Đã xác minh danh tính qua ticket TK-1102')
    await user.click(screen.getByRole('button', { name: /Mở khóa tài khoản/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Mở khóa tài khoản' })
    await user.click(within(dialog).getByRole('button', { name: 'Mở khóa tài khoản' }))

    expect(await screen.findByText(/Tài khoản tai\.hv@gmail\.com đã chuyển sang trạng thái Đang hoạt động/)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /Tạm khóa tài khoản/ })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('không cho tạm khóa chính mình hoặc SA cuối cùng', async () => {
    const user = userEvent.setup()
    renderAt('/nen-tang/tai-khoan/4')
    await user.type(await screen.findByPlaceholderText(/Nhập lý do/), 'Thử tạm khóa')
    await user.click(screen.getByRole('button', { name: /Tạm khóa tài khoản/ }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Tạm khóa tài khoản' }))
    expect(await within(dialog).findByText(/Phải còn ít nhất một System Admin/)).toBeInTheDocument()
  })

  it('báo lỗi tải và cho thử lại', async () => {
    renderAt('/nen-tang/tai-khoan?demo=load-error')
    expect(await screen.findByText('Không tải được danh sách tài khoản.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /thử lại/i })).toBeInTheDocument()
  })

  it('vai trò khác SA chỉ thấy thông báo không có quyền', async () => {
    renderAt('/nen-tang/tai-khoan', 'CS')
    expect(await screen.findByText('Bạn không có quyền thực hiện thao tác này.')).toBeInTheDocument()
    expect(screen.queryByText('Hồ Văn Tài')).not.toBeInTheDocument()
  })
})

describe('Quyền nhân sự nền tảng', () => {
  it('liệt kê nhân sự và cấp quyền CS cho người chưa có vai trò', async () => {
    const user = userEvent.setup()
    renderAt('/nen-tang/quyen')
    expect(await screen.findByText('Phạm Thu Hà')).toBeInTheDocument()
    expect(screen.queryByText('Ngô Minh Khang')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Cấp quyền nền tảng/ }))
    const pick = await screen.findByRole('dialog')
    await user.selectOptions(await within(pick).findByRole('combobox'), '7')
    await user.click(within(pick).getByRole('button', { name: 'Tiếp tục' }))

    await screen.findByText(/khang\.nm@beefcare\.vn · chưa có vai trò/)
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Cấp quyền CS' }))
    expect(await within(dialog).findByText('Lý do là bắt buộc.')).toBeInTheDocument()
    await user.type(within(dialog).getByPlaceholderText(/Nhập lý do/), 'Bổ sung nhân sự hỗ trợ ca chiều')
    await user.click(within(dialog).getByRole('button', { name: 'Cấp quyền CS' }))

    expect(await screen.findByText('Quyền CS của khang.nm@beefcare.vn đã được cấp.')).toBeInTheDocument()
    expect(await screen.findByText('Ngô Minh Khang')).toBeInTheDocument()
  })

  it('thu hồi quyền CS và hiển thị trạng thái đã thu hồi', async () => {
    const user = userEvent.setup()
    renderAt('/nen-tang/quyen/2?m=access')
    const dialog = await screen.findByRole('dialog', { name: 'Cấp quyền nền tảng' })
    await user.click(await within(dialog).findByLabelText('Thu hồi quyền'))
    await user.type(within(dialog).getByPlaceholderText(/Nhập lý do/), 'Chuyển bộ phận')
    await user.click(within(dialog).getByRole('button', { name: 'Thu hồi quyền CS' }))
    expect(await screen.findByText('Quyền CS của ha.pt@beefcare.vn đã được thu hồi.')).toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByText('Đã thu hồi')).toHaveLength(2))
  })

  it('email chưa xác minh không nhận được quyền nền tảng', async () => {
    renderAt('/nen-tang/quyen/9?m=access')
    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findAllByText(/chưa được xác minh/)).not.toHaveLength(0)
    expect(within(dialog).getByRole('button', { name: 'Cấp quyền CS' })).toBeDisabled()
  })
})

describe('Lịch sử audit nền tảng', () => {
  it('mặc định 7 ngày, chọn dòng xem trước/sau và lọc theo hành động', async () => {
    const user = userEvent.setup()
    renderAt('/nen-tang/audit')
    expect(await screen.findByText('5 sự kiện trong khoảng đã chọn')).toBeInTheDocument()
    expect(screen.getByText('req-7f21-aa90')).toBeInTheDocument()
    expect(screen.getByText('role: CS · đang hoạt động')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '17/10 10:12' }))
    expect(await screen.findByText('req-9a10-c3e1')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Lọc theo hành động'), 'PAYMENT_CONFIRMED')
    expect(await screen.findByText('1 sự kiện trong khoảng đã chọn')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Xuất CSV/ }))
    expect(await screen.findByText('Đã xuất 1 sự kiện theo bộ lọc đang xem.')).toBeInTheDocument()
  })

  it('không bao giờ hiển thị nội dung ngoài danh sách cho phép', async () => {
    renderAt('/nen-tang/audit/8')
    expect(await screen.findByText('1 sự kiện trong khoảng đã chọn').catch(() => null)).toBeNull()
    expect(screen.queryByText(/Nội dung ticket/)).not.toBeInTheDocument()
  })

  it('báo lỗi tải audit', async () => {
    renderAt('/nen-tang/audit?demo=load-error')
    expect(await screen.findByText('Không tải được lịch sử audit.')).toBeInTheDocument()
  })
})

describe('Thông báo của SA', () => {
  it('lọc chưa đọc, đánh dấu tất cả đã đọc và mở yêu cầu', async () => {
    const user = userEvent.setup()
    renderAt('/nen-tang/thong-bao')
    expect(await screen.findByText('CS Phạm Thu Hà giao yêu cầu nội bộ IR-081 cho bạn')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Chưa đọc 2' }))
    expect(screen.queryByText('IR-076 đã được CS hủy – không cần xử lý')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Đánh dấu đã đọc tất cả' }))
    expect(await screen.findByText('Tất cả thông báo đã được đánh dấu là đã đọc.')).toBeInTheDocument()
    expect(await screen.findByText('Không còn thông báo chưa đọc')).toBeInTheDocument()
  })

  it('mở thông báo kiểm tra lại giao việc', async () => {
    const user = userEvent.setup()
    renderAt('/nen-tang/thong-bao')
    const cancelled = (await screen.findByText(/IR-076 đã được CS hủy/)).closest('li')!
    await user.click(within(cancelled).getByRole('button', { name: 'Xem' }))
    expect(await screen.findByText('Yêu cầu này không còn được giao cho bạn.')).toBeInTheDocument()

    const assigned = screen.getByText(/giao yêu cầu nội bộ IR-081 cho bạn/).closest('li')!
    await user.click(within(assigned).getByRole('button', { name: 'Mở yêu cầu' }))
    expect(await screen.findByText('Trang yêu cầu nội bộ')).toBeInTheDocument()
  })
})
