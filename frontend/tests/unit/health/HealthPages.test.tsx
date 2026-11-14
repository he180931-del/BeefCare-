import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { SessionContext, type AppRole } from '../../../src/features/authorization/sessionContext'
import { HealthProfileTab, HealthTechnicianTab } from '../../../src/features/health'
import { healthDemoStore } from '../../../src/features/health/data/healthDemoStore'
import HealthRoutes from '../../../src/features/health/pages/HealthRoutes'

const session = (role: AppRole) => ({ role, fullName: 'Người dùng', email: 'x@example.com', farmId: 1, farmName: 'Trại bò Yên Bài – Ba Vì', logout: async () => undefined })

function renderList(path = '/suc-khoe') {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/suc-khoe/*" element={<HealthRoutes />} /></Routes></MemoryRouter>)
}
function renderTab(code: string, query = '', role?: AppRole, tab: ReactNode = <HealthProfileTab cattleCode={code} />) {
  const page = <MemoryRouter initialEntries={[`/cattle/${code}?tab=health${query}`]}><Routes><Route path="/cattle/:code" element={tab} /></Routes></MemoryRouter>
  return render(role ? <SessionContext.Provider value={session(role)}>{page}</SessionContext.Provider> : page)
}

beforeEach(async () => { await healthDemoStore.reset() })

describe('danh sách ca sức khỏe /suc-khoe', () => {
  it('hiện 7 ca đang mở, lọc theo mức độ và đổi tab; mã ca dẫn tới tab Sức khỏe của bò', async () => {
    const user = userEvent.setup()
    renderList()
    await screen.findByText('HC-0418')
    expect(screen.getAllByRole('link', { name: /^HC-/ })).toHaveLength(7)
    expect(screen.getByRole('link', { name: 'HC-0412' })).toHaveAttribute('href', '/cattle/BC-000203?tab=health')

    await user.selectOptions(screen.getByLabelText('Mức độ'), 'SEVERE')
    expect(await screen.findByText('HC-0417')).toBeInTheDocument()
    expect(screen.queryByText('HC-0418')).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Mức độ'), '')
    await user.click(screen.getByText(/Mạn tính \(2\)/))
    expect(await screen.findByText('HC-0398')).toBeInTheDocument()
    expect(screen.getByText('CHRONIC · từ 20/09/2026')).toBeInTheDocument()
  })

  it('báo khi không có ca phù hợp và khi tải lỗi', async () => {
    const user = userEvent.setup()
    const { unmount } = renderList()
    await screen.findByText('HC-0418')
    await user.type(screen.getByLabelText('Tìm mã bò, mã ca'), 'zzz')
    expect(await screen.findByText('Không có ca sức khỏe phù hợp')).toBeInTheDocument()
    unmount()
    renderList('/suc-khoe?demo=load-error')
    expect(await screen.findByRole('alert')).toHaveTextContent('Không tải được danh sách ca sức khỏe.')
  })
})

describe('tab Sức khỏe trong hồ sơ bò', () => {
  it('hiện ca đang mở, diễn biến, ngưng thịt và các ca trước', async () => {
    renderTab('BC-000203')
    expect(await screen.findByText('Ca HC-0412 · Tiêu chảy, bỏ ăn một phần')).toBeInTheDocument()
    expect(screen.getByText('OPEN · ngày 8')).toBeInTheDocument()
    expect(screen.getByText('Oxytetracycline 20% LA · 30 ml · tiêm bắp · ngưng 28 ngày')).toBeInTheDocument()
    expect(screen.getAllByText('10/11/2026').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('Không xuất bán trước ngày hết ngưng sử dụng thịt.')).toBeInTheDocument()
    expect(screen.getByText('HC-0331')).toBeInTheDocument()
    expect(screen.getByText('Khỏi · 05/2026')).toBeInTheDocument()
  })

  it('ghi theo dõi: báo lỗi thiếu diễn biến, rồi lưu và thêm vào dòng thời gian', async () => {
    const user = userEvent.setup()
    renderTab('BC-000203')
    await user.click(await screen.findByRole('button', { name: /Ghi theo dõi/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Ghi theo dõi' })
    await user.type(within(dialog).getByRole('textbox', { name: 'Mô tả' }), 'Ăn uống bình thường')
    await user.click(within(dialog).getByRole('button', { name: 'Lưu theo dõi' }))
    expect(await within(dialog).findByText('Diễn biến là bắt buộc.')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('radio', { name: 'Tốt hơn' }))
    await user.click(within(dialog).getByRole('button', { name: 'Lưu theo dõi' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Đã ghi theo dõi cho ca HC-0412.')
    expect(await screen.findByText('Ăn uống bình thường')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('mở ca mới qua ?m=open-case', async () => {
    const user = userEvent.setup()
    renderTab('BC-000231', '&m=open-case')
    const dialog = await screen.findByRole('dialog', { name: 'Mở ca sức khỏe' })
    await user.type(within(dialog).getByRole('textbox', { name: 'Thân nhiệt' }), '44')
    await user.type(within(dialog).getByRole('textbox', { name: 'Dấu hiệu / mô tả' }), 'Ho, bú kém')
    await user.click(within(dialog).getByRole('radio', { name: 'Nhẹ' }))
    await user.click(within(dialog).getByRole('button', { name: 'Lưu ghi nhận' }))
    expect(await within(dialog).findByText('Thân nhiệt phải trong khoảng 35,0 – 43,0 °C.')).toBeInTheDocument()

    await user.clear(within(dialog).getByRole('textbox', { name: 'Thân nhiệt' }))
    await user.type(within(dialog).getByRole('textbox', { name: 'Thân nhiệt' }), '39,6')
    await user.click(within(dialog).getByRole('button', { name: 'Lưu ghi nhận' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Đã mở ca sức khỏe HC-0419 cho BC-000231.')
    expect(await screen.findByText('Ca HC-0419 · Ho, bú kém')).toBeInTheDocument()
  })

  it('đóng ca Chết: cảnh báo trước khi lưu, tạo phiếu chờ và khóa ghi mới', async () => {
    const user = userEvent.setup()
    renderTab('BC-000203')
    await user.click(await screen.findByRole('button', { name: /Cập nhật trạng thái/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Cập nhật ca HC-0412' })
    await user.click(within(dialog).getByRole('radio', { name: 'Đóng ca' }))
    await user.click(within(dialog).getByRole('radio', { name: 'Chết' }))
    expect(within(dialog).getByText(/Thao tác này không hoàn tác được/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Xác nhận đóng ca' }))

    const info = await screen.findByRole('dialog', { name: 'Đã tạo phiếu xuất chờ xác nhận' })
    expect(info).toHaveTextContent('BC-000203 vẫn ở trạng thái hoạt động')
    await user.click(within(info).getByRole('button', { name: 'Đã hiểu' }))
    expect(await screen.findByText(/Chờ xác nhận chết \/ mất/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Mở ca sức khỏe/ })).not.toBeInTheDocument()
  })

  it('TC-10-27 Giữ OPEN: diễn biến chưa chọn sẵn, bắt buộc cùng ô chữ; lưu đúng diễn biến đã chọn', async () => {
    const user = userEvent.setup()
    renderTab('BC-000203')
    await user.click(await screen.findByRole('button', { name: /Cập nhật trạng thái/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Cập nhật ca HC-0412' })
    const kinds = within(dialog).getByRole('radiogroup', { name: 'Diễn biến' })
    expect(within(kinds).getAllByRole('radio').map((r) => (r as HTMLInputElement).checked)).toEqual([false, false, false])
    await user.click(within(dialog).getByRole('button', { name: 'Lưu cập nhật' }))
    expect(await within(dialog).findByText('Diễn biến mới là bắt buộc.')).toBeInTheDocument()
    expect(within(dialog).getByText('Diễn biến là bắt buộc.')).toBeInTheDocument()

    await user.type(within(dialog).getByRole('textbox', { name: /Diễn biến mới/ }), 'Còn tiêu chảy nhẹ')
    within(kinds).getByRole('radio', { name: 'Xấu hơn' }).focus()
    await user.keyboard(' ')
    expect(within(kinds).getByRole('radio', { name: 'Xấu hơn' })).toBeChecked()
    await user.click(within(dialog).getByRole('button', { name: 'Lưu cập nhật' }))
    expect(await screen.findByRole('status')).toBeInTheDocument()
    const row = (await screen.findByText('Còn tiêu chảy nhẹ')).closest('li, tr, div[class*="border"]') as HTMLElement
    expect(within(row).getByText(/Xấu hơn/)).toBeInTheDocument()
  })

  it('TC-10-27 Đóng ca / đổi trạng thái: diễn biến chỉ bắt buộc khi ô chữ có nội dung', async () => {
    const user = userEvent.setup()
    renderTab('BC-000203')
    await user.click(await screen.findByRole('button', { name: /Cập nhật trạng thái/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Cập nhật ca HC-0412' })
    await user.click(within(dialog).getByRole('radio', { name: 'Đóng ca' }))
    await user.click(within(dialog).getByRole('radio', { name: 'Khỏi' }))
    expect(within(dialog).getByText('Chỉ cần khi có diễn biến mới')).toBeInTheDocument()
    await user.type(within(dialog).getByRole('textbox', { name: /Diễn biến mới/ }), 'Ăn lại bình thường')
    await user.click(within(dialog).getByRole('button', { name: 'Lưu cập nhật' }))
    expect(await within(dialog).findByText('Diễn biến là bắt buộc.')).toBeInTheDocument()

    await user.clear(within(dialog).getByRole('textbox', { name: /Diễn biến mới/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Lưu cập nhật' }))
    expect(await screen.findByRole('status')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('sửa điều trị: hiện ngưng thịt trước và sau, bắt buộc lý do, đánh dấu Đã sửa', async () => {
    const user = userEvent.setup()
    renderTab('BC-000203')
    await user.click(await screen.findByRole('button', { name: 'Sửa · Hủy bản ghi 13/10/2026 07:30' }))
    const dialog = await screen.findByRole('dialog', { name: 'Sửa / hủy bản ghi điều trị' })
    const course = within(dialog).getByRole('textbox', { name: 'Liệu trình (ngày)' })
    await user.clear(course)
    await user.type(course, '5')
    expect(within(dialog).getByText('Ngưng thịt đến: 10/11/2026 → 14/11/2026 (tính lại khi lưu)')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Lưu' }))
    expect(await within(dialog).findByText('Lý do là bắt buộc.')).toBeInTheDocument()

    await user.type(within(dialog).getByRole('textbox', { name: 'Lý do' }), 'Liệu trình thực tế 5 ngày')
    await user.click(within(dialog).getByRole('button', { name: 'Lưu' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Ngưng thịt của BC-000203 đổi từ 10/11/2026 sang 14/11/2026.')
    expect(await screen.findByText('Đã sửa')).toBeInTheDocument()
  })

  it.each<AppRole>(['OWNER', 'TECHNICIAN'])('%s chỉ xem: không có nút ghi và không mở hộp thoại qua URL', async (role) => {
    renderTab('BC-000203', '&m=follow-up', role)
    expect(await screen.findByText('Ca HC-0412 · Tiêu chảy, bỏ ăn một phần')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Ghi theo dõi|Ghi điều trị|Cập nhật trạng thái|Mở ca sức khỏe|Sửa/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('báo lỗi tải với nút thử lại', async () => {
    renderTab('BC-000203', '&demo=load-error')
    expect(await screen.findByRole('alert')).toHaveTextContent('Không tải được dữ liệu sức khỏe.')
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument()
  })
})

describe('tab Sức khỏe bản điện thoại Kỹ thuật viên', () => {
  it('chỉ đọc: ca đang mở và các bản ghi, không có nút', async () => {
    renderTab('BC-000203', '', 'TECHNICIAN', <HealthTechnicianTab cattleCode="BC-000203" />)
    expect(await screen.findByText('Ca HC-0412 · Tiêu chảy')).toBeInTheDocument()
    expect(screen.getByText('Oxytetracycline 20% LA · 30 ml · tiêm bắp')).toBeInTheDocument()
    expect(screen.getByText(/Tốt hơn · ăn lại bình thường/)).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
