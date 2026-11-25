import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionContext, type Session } from '../../../src/app/session/sessionContext'
import { platformAdminApi } from '../../../src/features/platform-admin/api/platformAdminApi'
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

    expect(await screen.findByText('Tài khoản tai.hv@gmail.com hiện là Đang hoạt động.')).toBeInTheDocument() // MSG-FE03-16
    expect(await screen.findByRole('button', { name: /Tạm ngưng tài khoản/ })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('màn hẹp hơn 1280px: chọn một dòng thì cuộn tới khung chi tiết nằm dưới danh sách (UI review B3)', async () => {
    const scrolled: Element[] = []
    const original = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = function scrollIntoView(this: Element) { scrolled.push(this) }
    try {
      const user = userEvent.setup()
      renderAt('/nen-tang/tai-khoan')
      await screen.findByRole('button', { name: /Hồ Văn Tài/ })
      expect(scrolled).toHaveLength(0) // the first row shown by default is not a choice of the SA
      await user.click(screen.getByRole('button', { name: /Hồ Văn Tài/ }))
      await waitFor(() => expect(scrolled.some((el) => el.textContent?.includes('tai.hv@gmail.com · '))).toBe(true))
    } finally { Element.prototype.scrollIntoView = original }
  })

  it('tài khoản của chính SA không có lý do / nút Tạm ngưng (D32)', async () => {
    renderAt('/nen-tang/tai-khoan/4')
    expect(await screen.findByText('Bạn không thể tạm ngưng tài khoản của chính mình.')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/Nhập lý do/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Tạm ngưng tài khoản/ })).not.toBeInTheDocument()
  })

  it('lý do dưới 5 ký tự bị chặn; xác nhận MSG-FE03-14; lỗi nghiệp vụ đóng hộp thoại, hiện lý do và tải lại, giữ lý do', async () => {
    const user = userEvent.setup()
    renderAt('/nen-tang/tai-khoan/1')
    const reason = await screen.findByPlaceholderText(/Nhập lý do tạm ngưng/)
    await user.type(reason, 'a b c')
    await user.click(screen.getByRole('button', { name: /Tạm ngưng tài khoản/ }))
    expect(screen.getByText(/Lý do cần từ 5 đến 500 ký tự/)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.clear(reason)
    await user.type(reason, 'Nghi ngờ lộ mật khẩu')
    await user.click(screen.getByRole('button', { name: /Tạm ngưng tài khoản/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Tạm ngưng tài khoản' })
    expect(within(dialog).getByText(/Người dùng sẽ không đăng nhập được\./)).toBeInTheDocument()
    // Một SA khác vừa tạm ngưng tài khoản này ở phiên khác
    const account = await platformAdminDemoStore.getAccount(1)
    await platformAdminDemoStore.suspendAccount(1, { reason: 'Phiên khác tạm ngưng', expectedVersion: account.version })
    await user.click(within(dialog).getByRole('button', { name: 'Tạm ngưng tài khoản' }))

    expect(await screen.findByText(`Không có thay đổi: ${account.email} đã ở trạng thái này.`)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /Khôi phục tài khoản/ })).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Nhập lý do khôi phục/)).toHaveValue('Nghi ngờ lộ mật khẩu')
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
    expect(userRows().some((row) => row.includes('Vũ Hoàng Nam'))).toBe(false)

    await user.type(screen.getByRole('searchbox', { name: /Tìm tài khoản/ }), 'không ai')
    expect(await screen.findByText('Không có bản ghi phù hợp với bộ lọc.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }))
    await waitFor(() => expect(userRows().some((row) => row.includes('Vũ Hoàng Nam'))).toBe(true))
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
    expect(userRows().some((row) => row.includes('Vũ Hoàng Nam'))).toBe(true)
  })

  it('vai trò khác SA chỉ thấy thông báo không có quyền', async () => {
    renderAt('/nen-tang/tai-khoan', 'CS')
    expect(await screen.findByText('Bạn không có quyền thực hiện thao tác này.')).toBeInTheDocument()
    expect(screen.queryByText('Hồ Văn Tài')).not.toBeInTheDocument()
  })
})

describe('Quyền nhân viên nền tảng trên SCR-16 (UC9, D33)', () => {
  it('nút Quyền nền tảng mở popup trên SCR-16; cấp quyền CS có lý do 5–500 và hiện MSG-FE03-19', async () => {
    const user = userEvent.setup()
    renderAt('/nen-tang/tai-khoan/7')
    await user.click(await screen.findByRole('button', { name: /Quyền nền tảng/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Quyền nhân viên nền tảng' })
    expect(within(dialog).getByText(/khang\.nm@beefcare\.vn · chưa có vai trò/)).toBeInTheDocument()
    expect(within(dialog).getByText(/không thể thu hồi hay đổi vai trò của System Admin đang hoạt động cuối cùng/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Cấp quyền CS' }))
    expect(await within(dialog).findByText('Lý do là bắt buộc.')).toBeInTheDocument()
    await user.type(within(dialog).getByPlaceholderText(/Nhập lý do/), 'abc')
    await user.click(within(dialog).getByRole('button', { name: 'Cấp quyền CS' }))
    expect(await within(dialog).findByText(/Lý do cần từ 5 đến 500 ký tự/)).toBeInTheDocument()
    await user.clear(within(dialog).getByPlaceholderText(/Nhập lý do/))
    await user.type(within(dialog).getByPlaceholderText(/Nhập lý do/), 'Bổ sung nhân sự hỗ trợ ca chiều')
    await user.click(within(dialog).getByRole('button', { name: 'Cấp quyền CS' }))

    expect(await screen.findByText('Quyền CS của khang.nm@beefcare.vn đã được cấp.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('link cũ /nen-tang/quyen/{id} mở popup trên SCR-16; thu hồi CS, lịch sử vai trò hiện người làm và lý do', async () => {
    const user = userEvent.setup()
    renderAt('/nen-tang/quyen/2?m=access')
    const dialog = await screen.findByRole('dialog', { name: 'Quyền nhân viên nền tảng' })
    expect(await within(dialog).findByText(/Quay lại làm việc · Vũ Hoàng Nam/)).toBeInTheDocument()
    await user.click(within(dialog).getByLabelText('Thu hồi quyền'))
    await user.type(within(dialog).getByPlaceholderText(/Nhập lý do/), 'Chuyển bộ phận')
    await user.click(within(dialog).getByRole('button', { name: 'Thu hồi quyền CS' }))
    expect(await screen.findByText('Quyền CS của ha.pt@beefcare.vn đã được thu hồi.')).toBeInTheDocument()
  })

  it('tài khoản chưa xác minh / của chính mình chỉ xem lịch sử; hủy khi đã nhập lý do hỏi lại (MSG-COM-14)', async () => {
    const user = userEvent.setup()
    const first = renderAt('/nen-tang/tai-khoan/9?m=access')
    let dialog = await screen.findByRole('dialog', { name: 'Quyền nhân viên nền tảng' })
    expect(within(dialog).getByText(/Chưa có tài khoản BeefCare cho email này/)).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: /Cấp quyền/ })).not.toBeInTheDocument()
    first.unmount()

    const second = renderAt('/nen-tang/tai-khoan/4?m=access')
    dialog = await screen.findByRole('dialog', { name: 'Quyền nhân viên nền tảng' })
    expect(within(dialog).getByText('Bạn không thể thay đổi quyền nền tảng của chính mình.')).toBeInTheDocument()
    expect(await within(dialog).findByText(/Quản trị viên đầu tiên khi triển khai · Hệ thống/)).toBeInTheDocument()
    second.unmount()

    renderAt('/nen-tang/tai-khoan/3?m=access')
    dialog = await screen.findByRole('dialog', { name: 'Quyền nhân viên nền tảng' })
    await user.type(within(dialog).getByPlaceholderText(/Nhập lý do/), 'Đổi nhóm')
    await user.click(within(dialog).getByRole('button', { name: 'Hủy' }))
    expect(within(dialog).getByText('Bỏ thông tin đã nhập?')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Tiếp tục nhập' }))
    expect(within(dialog).getByPlaceholderText(/Nhập lý do/)).toHaveValue('Đổi nhóm')
    await user.click(within(dialog).getByRole('button', { name: 'Hủy' }))
    await user.click(within(dialog).getByRole('button', { name: 'Bỏ' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('Lịch sử audit nền tảng (SCR-51, D34)', () => {
  it('mặc định 7 ngày, chọn dòng xem trước / sau, đảo chiều thời gian và lọc theo hành động', async () => {
    const user = userEvent.setup()
    renderAt('/nen-tang/audit')
    expect(await screen.findByText('Hiển thị 1–5 trong 5 mục')).toBeInTheDocument()
    expect(screen.getByText('Tối đa 12 tháng')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Xuất CSV/ })).not.toBeInTheDocument()
    expect(await screen.findByText('req-7f21-aa90')).toBeInTheDocument()
    const detail = screen.getByText('Chi tiết mục audit').closest('div')!.parentElement!
    expect(within(detail).getAllByText('Vai trò')).toHaveLength(2)
    expect(within(detail).getAllByText('—').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: '17/10/2026 10:12' }))
    expect(await screen.findByText('req-9a10-c3e1')).toBeInTheDocument()
    expect(screen.getByText('SUSPENDED')).toBeInTheDocument()

    const times = () => screen.getAllByRole('button', { name: /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/ }).map((b) => b.textContent)
    expect(times()[0]).toBe('18/10/2026 08:02')
    await user.click(screen.getByRole('button', { name: /Thời gian/ }))
    await waitFor(() => expect(times()[0]).toBe('16/10/2026 14:05'))

    // The action filter is typed into: accents optional, then pick the suggestion.
    const actionFilter = screen.getByRole('combobox', { name: 'Lọc theo hành động' })
    await user.type(actionFilter, 'xac nhan thanh')
    await user.click(await screen.findByRole('option', { name: /Xác nhận thanh toán/ }))
    expect(actionFilter).toHaveValue('Xác nhận thanh toán')
    expect(await screen.findByText('Hiển thị 1–1 trong 1 mục')).toBeInTheDocument()
  })

  it('ô người thực hiện tìm theo tên hoặc "Hệ thống"; không có kết quả thì hiện MSG-COM-04 và Xóa bộ lọc', async () => {
    const user = userEvent.setup()
    renderAt('/nen-tang/audit')
    expect(await screen.findByText('Hiển thị 1–5 trong 5 mục')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Tìm người thực hiện'), 'Hệ thống')
    expect(await screen.findByText('Hiển thị 1–1 trong 1 mục')).toBeInTheDocument()
    await user.clear(screen.getByLabelText('Tìm người thực hiện'))
    await user.type(screen.getByLabelText('Tìm người thực hiện'), 'không có ai')
    expect(await screen.findByText('Không có bản ghi phù hợp.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }))
    expect(await screen.findByText('Hiển thị 1–5 trong 5 mục')).toBeInTheDocument()
  })

  it('mở trực tiếp một mục ngoài khoảng đang xem; không bao giờ hiển thị nội dung ngoài danh sách cho phép', async () => {
    renderAt('/nen-tang/audit/8')
    expect(await screen.findByText('CLOSED')).toBeInTheDocument()
    expect(screen.getByText('RESOLVED')).toBeInTheDocument()
    expect(screen.queryByText(/Nội dung ticket/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sao chép mã truy vết' })).not.toBeInTheDocument()
  })

  it('hai ô ngày có tên riêng; khoảng ngày sai thì hai ô viền đỏ', async () => {
    renderAt('/nen-tang/audit')
    expect(await screen.findByText('Hiển thị 1–5 trong 5 mục')).toBeInTheDocument()
    const from = screen.getByLabelText('Từ ngày')
    const to = screen.getByLabelText('Đến ngày')
    expect(screen.queryByLabelText('Chọn ngày')).not.toBeInTheDocument()
    fireEvent.change(from, { target: { value: '2026-12-31' } })
    expect(await screen.findByRole('alert')).toHaveTextContent('Ngày bắt đầu không được sau ngày kết thúc.')
    for (const input of [from, to]) expect(input.parentElement!.className).toContain('border-err-fg')
  })

  it('không tải được danh sách hành động thì báo ngay dưới ô lọc và cho thử lại', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(platformAdminApi, 'listAuditActions').mockRejectedValueOnce(new Error('network'))
    renderAt('/nen-tang/audit')
    expect(await screen.findByText('Không tải được danh sách hành động.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Thử lại' }))
    await waitFor(() => expect(screen.queryByText('Không tải được danh sách hành động.')).not.toBeInTheDocument())
    expect(spy).toHaveBeenCalledTimes(2)
    spy.mockRestore()
  })

  it('báo lỗi tải audit (MSG-COM-03) có Thử lại', async () => {
    renderAt('/nen-tang/audit?demo=load-error')
    expect(await screen.findByText('Không thể tải dữ liệu.')).toBeInTheDocument()
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
