import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { type AppRole } from '../../../src/features/authorization'
import { SessionContext } from '../../../src/app/session/sessionContext'
import { HealthProfileTab, HealthTechnicianTab } from '../../../src/features/health'
import { healthDemoStore } from '../../../src/features/health/data/healthDemoStore'
import HealthRoutes from '../../../src/features/health/pages/HealthRoutes'

const session = (role: AppRole) => ({ role, fullName: 'Người dùng', email: 'x@example.com', farmId: 1, farmName: 'Trại bò Yên Bài – Ba Vì', logout: async () => undefined })

function renderList(path = '/suc-khoe') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/suc-khoe/*" element={<HealthRoutes />} />
        <Route path="/cattle/:code" element={<p>Hồ sơ bò</p>} />
      </Routes>
    </MemoryRouter>,
  )
}
function renderTab(code: string, query = '', role?: AppRole, tab: ReactNode = <HealthProfileTab cattleCode={code} />) {
  const page = <MemoryRouter initialEntries={[`/cattle/${code}?tab=health${query}`]}><Routes><Route path="/cattle/:code" element={tab} /></Routes></MemoryRouter>
  return render(role ? <SessionContext.Provider value={session(role)}>{page}</SessionContext.Provider> : page)
}

beforeEach(async () => { await healthDemoStore.reset() })

describe('danh sách ca sức khỏe /suc-khoe', () => {
  it('D66: ô chỉ số, 7 ca đang mở, lọc theo mức độ và đổi tab; kỳ chỉ hiện ở tab Đã đóng; nhấn dòng mở hồ sơ bò', async () => {
    const user = userEvent.setup()
    renderList()
    await screen.findByText('HC-0418')
    expect(screen.getAllByRole('row', { name: /^Ca HC-/ })).toHaveLength(7)
    const tiles = screen.getByRole('region', { name: 'Chỉ số sức khỏe' })
    expect(within(tiles).getByText('Ca chưa đóng')).toBeInTheDocument()
    expect(within(tiles).getByRole('img', { name: /^Theo mức độ: Nặng \d+/ })).toBeInTheDocument()
    expect(within(tiles).getByText('Cần chú ý ngay')).toBeInTheDocument()
    expect(screen.queryByText('Ca đóng mở từ')).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Mức độ'), 'SEVERE')
    expect(await screen.findByText('HC-0417')).toBeInTheDocument()
    expect(screen.queryByText('HC-0418')).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Mức độ'), '')
    await user.click(screen.getByText(/Theo dõi dài hạn \(2\)/))
    expect(await screen.findByText('HC-0398')).toBeInTheDocument()
    expect(screen.getByText('Theo dõi dài hạn · từ 20/09/2026')).toBeInTheDocument()
    await user.click(screen.getByText(/^Đã đóng \(/))
    expect(await screen.findByText('Ca đóng mở từ')).toBeInTheDocument()
    await user.click(screen.getAllByRole('row', { name: /^Ca HC-/ })[0])
    expect(await screen.findByText('Hồ sơ bò')).toBeInTheDocument()
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
    expect(await screen.findByText('Ca HC-0412 · Tiêu chảy')).toBeInTheDocument()
    expect(screen.getByText('Đang mở · ngày 8')).toBeInTheDocument()
    expect(screen.getByText('Oxytetracycline 20% LA · 30 ml · tiêm bắp · ngưng 28 ngày')).toBeInTheDocument()
    expect(screen.getAllByText('10/11/2026').length).toBeGreaterThanOrEqual(1)
    // Mốc mẫu 20/10/2026, ngưng đến 10/11/2026 → còn 21 ngày; một dải cảnh báo duy nhất.
    expect(screen.getByText('Ngưng sử dụng thịt đến 10/11/2026 · còn 21 ngày')).toBeInTheDocument()
    expect(screen.getByText('Chưa bán giết mổ trước ngày này.')).toBeInTheDocument()
    expect(screen.getByText('HC-0331')).toBeInTheDocument()
    const closed = screen.getByText('HC-0331').closest('li')!
    expect(closed).toHaveTextContent('Khỏi')
    expect(closed).toHaveTextContent('05/2026')
  })

  it('ca đã đóng có nút Xem: tóm tắt, thuốc đã dùng và toàn bộ diễn biến', async () => {
    const user = userEvent.setup()
    renderTab('BC-000203')
    await user.click(await screen.findByRole('button', { name: 'Xem ca HC-0331' }))
    const dialog = await screen.findByRole('dialog', { name: /Ca HC-0331/ })
    expect(within(dialog).getByText('Thuốc đã dùng')).toBeInTheDocument()
    expect(within(dialog).getByText('Khỏi')).toBeInTheDocument()
    expect(within(dialog).getByText(/Diễn biến & điều trị \(\d+\)/)).toBeInTheDocument()
  })

  it('thẻ ca gọn: chỉ thẻ đầu hiện diễn biến, thẻ khác mở bằng nút; chỉ 3 bản ghi mới nhất, còn lại "Xem thêm"', async () => {
    const user = userEvent.setup()
    renderTab('BC-000203')
    const toggle = await screen.findByRole('button', { name: /Ẩn diễn biến/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await user.click(toggle)
    expect(screen.queryByText('Oxytetracycline 20% LA · 30 ml · tiêm bắp · ngưng 28 ngày')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Diễn biến & điều trị \(\d+\)/ }))
    expect(screen.getByText('Oxytetracycline 20% LA · 30 ml · tiêm bắp · ngưng 28 ngày')).toBeInTheDocument()
  })

  it('D58: thẻ ca chỉ còn "Ghi điều trị" và "Cập nhật ca bệnh"; cập nhật báo lỗi dưới ô, rồi lưu thân nhiệt và diễn biến', async () => {
    const user = userEvent.setup()
    renderTab('BC-000203')
    expect(await screen.findByRole('button', { name: /Ghi điều trị/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Ghi theo dõi|Cập nhật trạng thái/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Cập nhật ca bệnh/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Cập nhật ca bệnh' })
    await user.type(within(dialog).getByRole('textbox', { name: 'Thân nhiệt' }), '38,5')
    await user.type(within(dialog).getByRole('textbox', { name: /Mô tả/ }), 'Ăn uống bình thường')
    await user.click(within(dialog).getByRole('button', { name: 'Lưu cập nhật' }))
    expect(await within(dialog).findByText('Diễn biến là bắt buộc.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Không thực hiện được' })).not.toBeInTheDocument()

    await user.click(within(dialog).getByRole('radio', { name: 'Tốt hơn' }))
    await user.click(within(dialog).getByRole('button', { name: 'Lưu cập nhật' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Đã cập nhật ca HC-0412.')
    expect(await screen.findByText('Ăn uống bình thường · 38,5°C')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('D79: khối Tình trạng sức khỏe có dòng "Từ trước đến nay" – tổng ca, lần điều trị, ca gần nhất', async () => {
    renderTab('BC-000154')
    await screen.findByRole('button', { name: 'Mở lại ca' })
    const label = screen.getByText('Từ trước đến nay')
    const block = label.parentElement as HTMLElement
    expect(within(block).getByText('Tổng số ca')).toBeInTheDocument()
    expect(within(block).getByText('Lần điều trị')).toBeInTheDocument()
    expect(within(block).getByText('Ca gần nhất').nextElementSibling?.textContent).toMatch(/^\d{2}\/\d{4}$/)
  })

  it('D81: ca đã đóng Khỏi vẫn sửa được bản ghi từ "Xem ca"; sửa xong tải lại tab; Kỹ thuật viên chỉ xem', async () => {
    const user = userEvent.setup()
    const { unmount } = renderTab('BC-000154', '', 'MANAGER')
    await user.click(await screen.findByRole('button', { name: 'Xem ca HC-0411' }))
    const view = await screen.findByRole('dialog', { name: /^Ca HC-0411/ })
    await user.click(within(view).getByRole('button', { name: /^Sửa/ }))
    const edit = await screen.findByRole('dialog', { name: /^Sửa bản ghi/ })
    const signs = within(edit).getByRole('textbox', { name: /Dấu hiệu/ })
    await user.clear(signs)
    await user.type(signs, 'Sưng khớp gối trái')
    await user.click(within(edit).getByRole('button', { name: /^Lưu/ }))
    expect(await screen.findByRole('status')).toHaveTextContent(/Đã sửa bản ghi/)
    // Hộp thoại "Xem ca" và khối "Các ca trước" đều đã nhận giá trị mới.
    expect((await screen.findAllByText(/Sưng khớp gối trái/)).length).toBeGreaterThan(0)
    unmount()

    renderTab('BC-000154', '', 'TECHNICIAN')
    await user.click(await screen.findByRole('button', { name: 'Xem ca HC-0411' }))
    const readOnly = await screen.findByRole('dialog', { name: /^Ca HC-0411/ })
    expect(within(readOnly).queryByRole('button', { name: /^Sửa/ })).not.toBeInTheDocument()
  })

  it('D62: mở lại ca đã đóng từ bảng Các ca trước, lý do bắt buộc', async () => {
    const user = userEvent.setup()
    renderTab('BC-000154')
    await user.click(await screen.findByRole('button', { name: 'Mở lại ca' }))
    const dialog = await screen.findByRole('dialog', { name: 'Mở lại ca' })
    await user.click(within(dialog).getByRole('button', { name: 'Mở lại ca' }))
    expect(await within(dialog).findByText('Lý do là bắt buộc.')).toBeInTheDocument()
    await user.type(within(dialog).getByRole('textbox', { name: 'Lý do mở lại' }), 'Sưng khớp tái phát')
    await user.click(within(dialog).getByRole('button', { name: 'Mở lại ca' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Đã mở lại ca HC-0411.')
    expect(screen.queryByRole('button', { name: 'Mở lại ca' })).not.toBeInTheDocument()
  })

  it('D65: Ghi điều trị – liều số + đơn vị điền từ danh mục, đổi đường dùng thì bỏ liều tham chiếu, hiện tổng theo số ngày', async () => {
    const user = userEvent.setup()
    renderTab('BC-000203', '&m=treatment&case=HC-0412')
    const dialog = await screen.findByRole('dialog', { name: 'Ghi điều trị' })
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Thuốc (danh mục trại)' }), 'Oxytetracycline 20% LA')
    const amount = within(dialog).getByRole('textbox', { name: 'Liều mỗi lần' })
    expect(amount).toHaveValue('30')
    expect(within(dialog).getByRole('combobox', { name: 'Đơn vị liều' })).toHaveValue('ml')
    expect(within(dialog).getByText('Ghi chú thuốc: 1 ml / 10 kg')).toBeInTheDocument()
    const course = within(dialog).getByRole('textbox', { name: 'Số ngày dùng (mỗi ngày 1 lần)' })
    await user.clear(course)
    await user.type(course, '3')
    expect(within(dialog).getByText('Tổng: 30 ml × 3 ngày = 90 ml')).toBeInTheDocument()
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Đường dùng' }), 'Uống')
    expect(amount).toHaveValue('')
    expect(within(dialog).getByText(/Liều tham chiếu chỉ áp cho Tiêm bắp/)).toBeInTheDocument()
    await user.type(amount, 'abc')
    await user.click(within(dialog).getByRole('button', { name: 'Lưu điều trị' }))
    expect(await within(dialog).findByText('Liều phải là số lớn hơn 0.')).toBeInTheDocument()
    expect(within(dialog).getByRole('textbox', { name: 'Ghi chú' })).toBeInTheDocument()
  })

  it('mở ca mới qua ?m=open-case', async () => {
    const user = userEvent.setup()
    renderTab('BC-000231', '&m=open-case')
    const dialog = await screen.findByRole('dialog', { name: 'Mở ca sức khỏe' })
    const temp = within(dialog).getByRole('textbox', { name: 'Thân nhiệt' })
    await user.type(temp, '46')
    await user.type(within(dialog).getByRole('textbox', { name: 'Dấu hiệu / mô tả' }), 'Ho, bú kém')
    await user.click(within(dialog).getByRole('radio', { name: 'Nhẹ' }))
    expect(within(dialog).queryByRole('radio', { name: /Nối vào ca/ })).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Mở ca' }))
    expect(await within(dialog).findByText('Thân nhiệt phải trong khoảng 30,0 – 45,0 °C.')).toBeInTheDocument()
    // D61: xóa trống ô thì lỗi đỏ cũ biến mất; 44 °C hỏi xác nhận rồi mới lưu.
    await user.clear(temp)
    expect(within(dialog).queryByText('Thân nhiệt phải trong khoảng 30,0 – 45,0 °C.')).not.toBeInTheDocument()
    await user.type(temp, '44')
    await user.click(within(dialog).getByRole('button', { name: 'Mở ca' }))
    const check = await screen.findByRole('dialog', { name: 'Kiểm tra lại thân nhiệt' })
    await user.click(within(check).getByRole('button', { name: 'Xác nhận lưu' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Đã mở ca sức khỏe HC-0419 cho BC-000231.')
    expect(await screen.findByText('Ca HC-0419 · Ho, bú kém')).toBeInTheDocument()
  })

  it('D58: bò đang có ca thì popup Mở ca nhắc và dẫn sang "Cập nhật ca bệnh" của ca đó', async () => {
    const user = userEvent.setup()
    renderTab('BC-000203', '&m=open-case')
    const dialog = await screen.findByRole('dialog', { name: 'Mở ca sức khỏe' })
    expect(within(dialog).getByText(/Bò đang có ca HC-0412/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Cập nhật ca HC-0412' }))
    expect(await screen.findByRole('dialog', { name: 'Cập nhật ca bệnh' })).toHaveTextContent('HC-0412')
    expect(screen.queryByRole('dialog', { name: 'Mở ca sức khỏe' })).not.toBeInTheDocument()
  })

  it('đóng ca Chết: cảnh báo trước khi lưu, tạo phiếu chờ và khóa ghi mới', async () => {
    const user = userEvent.setup()
    renderTab('BC-000203')
    await user.click(await screen.findByRole('button', { name: /Cập nhật ca bệnh/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Cập nhật ca bệnh' })
    await user.click(within(dialog).getByRole('radio', { name: 'Đóng ca' }))
    await user.click(within(dialog).getByRole('radio', { name: 'Chết' }))
    expect(within(dialog).getByText(/phiếu xuất "Chết \/ mất" chờ Chủ trại xác nhận/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Xác nhận đóng ca' }))

    const info = await screen.findByRole('dialog', { name: 'Đã tạo phiếu xuất chờ xác nhận' })
    expect(info).toHaveTextContent('BC-000203 vẫn ở trạng thái hoạt động')
    await user.click(within(info).getByRole('button', { name: 'Đã hiểu' }))
    expect(await screen.findByText(/Chờ xác nhận chết \/ mất/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Mở ca sức khỏe/ })).not.toBeInTheDocument()
  })

  it('TC-10-27 Giữ đang mở: diễn biến chưa chọn sẵn, bắt buộc cùng mô tả; lưu đúng diễn biến đã chọn', async () => {
    const user = userEvent.setup()
    renderTab('BC-000203')
    await user.click(await screen.findByRole('button', { name: /Cập nhật ca bệnh/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Cập nhật ca bệnh' })
    const kinds = within(dialog).getByRole('radiogroup', { name: 'Diễn biến' })
    expect(within(kinds).getAllByRole('radio').map((r) => (r as HTMLInputElement).checked)).toEqual([false, false, false])
    await user.click(within(dialog).getByRole('button', { name: 'Lưu cập nhật' }))
    expect(await within(dialog).findByText('Mô tả là bắt buộc.')).toBeInTheDocument()
    expect(within(dialog).getByText('Diễn biến là bắt buộc.')).toBeInTheDocument()

    await user.type(within(dialog).getByRole('textbox', { name: /Mô tả/ }), 'Còn tiêu chảy nhẹ')
    within(kinds).getByRole('radio', { name: 'Xấu hơn' }).focus()
    await user.keyboard(' ')
    expect(within(kinds).getByRole('radio', { name: 'Xấu hơn' })).toBeChecked()
    await user.click(within(dialog).getByRole('button', { name: 'Lưu cập nhật' }))
    expect(await screen.findByRole('status')).toBeInTheDocument()
    const row = (await screen.findByText('Còn tiêu chảy nhẹ')).closest('li, tr, div[class*="border"]') as HTMLElement
    expect(within(row).getByText(/Xấu hơn/)).toBeInTheDocument()
  })

  it('TC-10-27 / D58 Đóng ca: phần theo dõi tùy chọn, có nhập mô tả thì cần diễn biến', async () => {
    const user = userEvent.setup()
    renderTab('BC-000203')
    await user.click(await screen.findByRole('button', { name: /Cập nhật ca bệnh/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Cập nhật ca bệnh' })
    await user.click(within(dialog).getByRole('radio', { name: 'Đóng ca' }))
    await user.click(within(dialog).getByRole('radio', { name: 'Khỏi' }))
    expect(within(dialog).getByText('Diễn biến', { selector: 'label, span, legend, div' })).toBeInTheDocument()
    await user.type(within(dialog).getByRole('textbox', { name: /Mô tả/ }), 'Ăn lại bình thường')
    await user.click(within(dialog).getByRole('button', { name: 'Lưu cập nhật' }))
    expect(await within(dialog).findByText('Diễn biến là bắt buộc.')).toBeInTheDocument()

    await user.clear(within(dialog).getByRole('textbox', { name: /Mô tả/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Lưu cập nhật' }))
    expect(await screen.findByRole('status')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('D73 sửa điều trị: hiện ngưng thịt trước và sau, ghi chú không bắt buộc, đánh dấu Đã sửa', async () => {
    const user = userEvent.setup()
    renderTab('BC-000203')
    await user.click(await screen.findByRole('button', { name: 'Sửa bản ghi 13/10/2026 07:30' }))
    const dialog = await screen.findByRole('dialog', { name: 'Sửa bản ghi điều trị' })
    expect(within(dialog).queryByRole('radio')).not.toBeInTheDocument()
    const course = within(dialog).getByRole('textbox', { name: 'Số ngày dùng' })
    await user.clear(course)
    await user.type(course, '5')
    expect(within(dialog).getByText('Ngưng thịt đến: 10/11/2026 → 14/11/2026 (tính lại khi lưu)')).toBeInTheDocument()
    expect(within(dialog).getByRole('textbox', { name: 'Ghi chú' })).toHaveValue('')
    await user.click(within(dialog).getByRole('button', { name: 'Lưu' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Ngưng thịt của BC-000203 đổi từ 10/11/2026 sang 14/11/2026.')
    expect(await screen.findByText('Đã sửa')).toBeInTheDocument()
  })

  it('D73 xóa điều trị: chỉ xác nhận, bản ghi biến khỏi diễn biến; lần ghi mở ca không có nút Xóa', async () => {
    const user = userEvent.setup()
    renderTab('BC-000203')
    await user.click(await screen.findByRole('button', { name: 'Xóa bản ghi 13/10/2026 07:30' }))
    const dialog = await screen.findByRole('dialog', { name: 'Xóa bản ghi điều trị?' })
    expect(within(dialog).queryByRole('textbox', { name: /Ghi chú|Lý do/ })).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Xóa' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Xóa bản ghi 13/10/2026 07:30' })).not.toBeInTheDocument()
    expect(screen.queryByText('Đã hủy')).not.toBeInTheDocument()
  })

  it('D41: Chủ trại ghi như Quản lý, mở được hộp thoại qua URL', async () => {
    renderTab('BC-000203', '&m=update-case', 'OWNER')
    expect(await screen.findByText('Ca HC-0412 · Tiêu chảy')).toBeInTheDocument()
    expect(await screen.findByRole('dialog', { name: 'Cập nhật ca bệnh' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Ghi điều trị|Cập nhật ca bệnh/ }).length).toBeGreaterThan(0)
  })

  it.each<AppRole>(['TECHNICIAN'])('%s chỉ xem: không có nút ghi và không mở hộp thoại qua URL', async (role) => {
    renderTab('BC-000203', '&m=update-case', role)
    expect(await screen.findByText('Ca HC-0412 · Tiêu chảy')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Ghi điều trị|Cập nhật ca bệnh|Mở ca sức khỏe|Sửa/ })).not.toBeInTheDocument()
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
