import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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

beforeEach(async () => { await platformAdminDemoStore.reset(); sessionStorage.clear() })

const userRows = () => screen.getAllByRole('button', { name: /@/ }).map((button) => button.textContent ?? '')

describe('Tài khoản người dùng', () => {
  it('đọc ?q= làm tìm kiếm ban đầu và khôi phục tài khoản sau khi nhập lý do', async () => {
    const user = userEvent.setup()
    renderAt('/nen-tang/tai-khoan?q=Hồ Văn')
    expect(await screen.findByRole('button', { name: /Hồ Văn Tài/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Nguyễn Văn Hùng/ })).not.toBeInTheDocument()

    await user.click(await screen.findByRole('button', { name: /Khôi phục tài khoản/ }))
    expect(screen.getByText('Lý do là bắt buộc.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.type(screen.getByPlaceholderText(/Nhập lý do/), 'Đã xác minh danh tính qua ticket TK-1102')
    await user.click(screen.getByRole('button', { name: /Khôi phục tài khoản/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Khôi phục tài khoản' })
    await user.click(within(dialog).getByRole('button', { name: 'Khôi phục tài khoản' }))

    expect(await screen.findByText(/Tài khoản tai\.hv@gmail\.com đã chuyển sang trạng thái Đang hoạt động/)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /Tạm ngưng tài khoản/ })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('không cho tạm ngưng chính mình hoặc SA cuối cùng', async () => {
    const user = userEvent.setup()
    renderAt('/nen-tang/tai-khoan/4')
    await user.type(await screen.findByPlaceholderText(/Nhập lý do/), 'Thử tạm ngưng')
    await user.click(screen.getByRole('button', { name: /Tạm ngưng tài khoản/ }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Tạm ngưng tài khoản' }))
    expect(await within(dialog).findByText(/Phải còn ít nhất một Quản trị hệ thống/)).toBeInTheDocument()
  })

  it('báo lỗi tải và cho thử lại', async () => {
    renderAt('/nen-tang/tai-khoan?demo=load-error')
    expect(await screen.findByText('Không tải được danh sách tài khoản.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /thử lại/i })).toBeInTheDocument()
  })

  it('xếp theo tên tiếng Việt, bấm cột Người dùng để đảo; vai trò đã thu hồi hiện "Không có"; trại tham gia theo vai trò', async () => {
    const user = userEvent.setup()
    renderAt('/nen-tang/tai-khoan')
    await screen.findByRole('button', { name: /Vũ Hoàng Nam/ })
    expect(userRows()[0]).toMatch(/Đỗ Minh Quân/)
    expect(userRows().at(-1)).toMatch(/Vũ Hoàng Nam/)
    const loc = screen.getByRole('button', { name: /Trịnh Văn Lộc/ }).closest('tr') as HTMLElement
    expect(within(loc).getByText('Không có')).toBeInTheDocument()
    expect(within(loc).getByText('CS đã thu hồi')).toBeInTheDocument()
    const hung = screen.getByRole('button', { name: /Nguyễn Văn Hùng/ }).closest('tr') as HTMLElement
    expect(within(hung).getByText('3 (Chủ trại)')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Người dùng/ }))
    await waitFor(() => expect(userRows()[0]).toMatch(/Vũ Hoàng Nam/))
    expect(screen.getByRole('columnheader', { name: /Người dùng/ })).toHaveAttribute('aria-sort', 'descending')
  })

  it('tải 20 dòng mỗi trang, giữ bộ lọc và chiều sắp xếp trong phiên, có Xóa bộ lọc khi rỗng', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(platformAdminDemoStore, 'listAccounts')
    const first = renderAt('/nen-tang/tai-khoan')
    await screen.findByRole('button', { name: /Vũ Hoàng Nam/ })
    expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, size: 20, dir: 'asc' }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Lọc theo trạng thái' }), 'SUSPENDED')
    await user.click(screen.getByRole('button', { name: /^Người dùng/ }))
    await waitFor(() => expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'SUSPENDED', dir: 'desc', page: 1 })))
    first.unmount()

    renderAt('/nen-tang/tai-khoan')
    expect(await screen.findByRole('button', { name: /Hồ Văn Tài/ })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Lọc theo trạng thái' })).toHaveValue('SUSPENDED')
    expect(screen.queryByRole('button', { name: /Vũ Hoàng Nam/ })).not.toBeInTheDocument()

    await user.type(screen.getByRole('searchbox', { name: /Tìm tài khoản/ }), 'không ai')
    expect(await screen.findByText('Không có bản ghi phù hợp với bộ lọc.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }))
    expect(await screen.findByRole('button', { name: /Vũ Hoàng Nam/ })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Lọc theo trạng thái' })).toHaveValue('')
    spy.mockRestore()
  })

  it('mở link tới tài khoản ngoài trang đang lọc vẫn hiện đúng tài khoản đó, giờ Asia/Ho_Chi_Minh', async () => {
    renderAt('/nen-tang/tai-khoan/1?q=bao.lq')
    expect(await screen.findByRole('button', { name: /Lý Quốc Bảo/ })).toBeInTheDocument()
    // Chi tiết đọc theo id trên URL (A10), không lấy dòng đầu của trang.
    expect(await screen.findByText(/hung\.nv@gmail\.com · Đã xác minh \(Google\)/)).toBeInTheDocument()
    expect(screen.getByText('12/03/2024 09:20')).toBeInTheDocument()
    expect(screen.getByText('Có (12/03/2024)')).toBeInTheDocument()
    expect(screen.getByText('Trại bò Yên Bài – Ba Vì, Trại Tản Lĩnh, Trại Suối Hai')).toBeInTheDocument()
    expect(screen.getByText('18/10/2026 07:12')).toBeInTheDocument()
  })

  it('tài khoản chưa xác minh và chưa đăng nhập; id không còn tồn tại báo lỗi', async () => {
    const first = renderAt('/nen-tang/tai-khoan/9')
    expect(await screen.findByText(/bao\.lq@gmail\.com · Chưa xác minh/)).toBeInTheDocument()
    expect(screen.getByText('Chưa đăng nhập')).toBeInTheDocument()
    expect(screen.queryByText(/0912345678/)).not.toBeInTheDocument()
    first.unmount()

    renderAt('/nen-tang/tai-khoan/999')
    // 404 / MSG-COM-08 dùng câu chung của ứng dụng (userFacingError), có Thử lại; danh sách vẫn dùng được.
    expect(await screen.findByText(/Không tìm thấy dữ liệu cần thao tác/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Vũ Hoàng Nam/ })).toBeInTheDocument()
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
    expect(await screen.findByText('Không tải được lịch sử kiểm toán.')).toBeInTheDocument()
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
