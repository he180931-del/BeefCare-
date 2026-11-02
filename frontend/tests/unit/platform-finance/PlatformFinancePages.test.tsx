import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { SessionContext } from '../../../src/features/authorization/sessionContext'
import { financeDemoStore } from '../../../src/features/platform-finance/data/financeDemoStore'
import ReceiptRoutes from '../../../src/features/platform-finance/pages/ReceiptRoutes'
import ManualFinanceRoutes from '../../../src/features/platform-finance/pages/ManualFinanceRoutes'
import CashReportRoutes from '../../../src/features/platform-finance/pages/CashReportRoutes'
import ReconciliationNoticePage from '../../../src/features/platform-finance/pages/ReconciliationNoticePage'
import PmSupportNoticePage from '../../../src/features/platform-finance/pages/PmSupportNoticePage'

const pm = { role: 'PM' as const, fullName: 'Đỗ Minh Quân', email: 'quan@beefcare.vn', farmId: 0, farmName: '', logout: async () => {} }
const renderAt = (path: string) =>
  render(
    <SessionContext.Provider value={pm}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/nen-tang/bien-nhan/*" element={<ReceiptRoutes />} />
          <Route path="/nen-tang/thu-chi/*" element={<ManualFinanceRoutes />} />
          <Route path="/nen-tang/bao-cao-dong-tien/*" element={<CashReportRoutes />} />
          <Route path="/nen-tang/thong-bao-doi-soat" element={<ReconciliationNoticePage />} />
          <Route path="/nen-tang/thong-bao-ho-tro" element={<PmSupportNoticePage />} />
          <Route path="/nen-tang/thanh-toan/*" element={<div>Màn thanh toán</div>} />
        </Routes>
      </MemoryRouter>
    </SessionContext.Provider>,
  )

beforeEach(async () => { await financeDemoStore.reset() })

describe('SCR-70 biên nhận gói', () => {
  it('hiện số liệu tháng, chọn dòng đổi chi tiết, mở hộp thoại chỉ đọc', async () => {
    const user = userEvent.setup()
    renderAt('/nen-tang/bien-nhan')
    expect(await screen.findByText('98.640.000 đ')).toBeInTheDocument()
    expect(screen.getByText('Hiển thị 5 / 37 biên nhận')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Trại Vân Hòa' }))
    expect(screen.getAllByText('BCA9X2M1').length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: 'RC-26-0412' }))
    expect((await screen.findAllByText('Biên nhận RC-26-0412 · Chỉ đọc')).length).toBeGreaterThan(0)
    expect(screen.getByDisplayValue('15/11/2026 – 14/11/2027')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /sửa|xóa|hủy bỏ/i })).toBeNull()
  })
  it('tìm không thấy thì hiện trạng thái rỗng và xóa bộ lọc', async () => {
    const user = userEvent.setup()
    renderAt('/nen-tang/bien-nhan')
    await user.type(await screen.findByLabelText('Tìm biên nhận'), 'KHONGCO')
    expect(await screen.findByText('Không có biên nhận phù hợp')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Xóa bộ lọc/ }))
    expect(await screen.findByText('Hiển thị 5 / 37 biên nhận')).toBeInTheDocument()
  })
})

describe('SCR-71/72 thu chi khác', () => {
  it('tab đếm đúng và lọc theo trạng thái', async () => {
    const user = userEvent.setup()
    renderAt('/nen-tang/thu-chi')
    expect(await screen.findByRole('button', { name: 'Tất cả 24' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Nháp 2' }))
    expect(await screen.findByText('FR-0108')).toBeInTheDocument()
    expect(screen.queryByText('FR-0104')).toBeNull()
  })
  it('lọc ra rỗng thì báo không có kết quả và xóa bộ lọc khôi phục danh sách', async () => {
    const user = userEvent.setup()
    renderAt('/nen-tang/thu-chi')
    await user.selectOptions(await screen.findByLabelText('Loại'), 'INCOME')
    await user.selectOptions(screen.getByLabelText('Phạm vi'), '1')
    expect(await screen.findByText('Không có kết quả phù hợp')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Xóa bộ lọc/ }))
    expect(await screen.findByText('FR-0104')).toBeInTheDocument()
  })
  it('khoản đã ghi sổ mở hộp thoại chỉ đọc rồi hủy bỏ bắt buộc có lý do', async () => {
    const user = userEvent.setup()
    renderAt('/nen-tang/thu-chi')
    await user.click(await screen.findByRole('button', { name: 'FR-0104' }))
    expect((await screen.findAllByText('Khoản FR-0104 đã ghi sổ')).length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: 'Hủy bỏ khoản đã ghi sổ' }))
    await user.click(await screen.findByRole('button', { name: 'Xác nhận Hủy bỏ' }))
    expect(await screen.findByText('Lý do Hủy bỏ là bắt buộc.')).toBeInTheDocument()
    await user.type(document.getElementById('void-reason') as HTMLTextAreaElement, 'Ghi nhầm')
    await user.click(screen.getByRole('button', { name: 'Xác nhận Hủy bỏ' }))
    expect(await screen.findByText('Khoản thu chi FR-0104 đã được hủy bỏ.')).toBeInTheDocument()
    expect((await financeDemoStore.getRecord('FR-0104')).record.state).toBe('VOID')
  })
  it('tạo khoản mới: báo lỗi số tiền, rồi lưu nháp', async () => {
    const user = userEvent.setup()
    renderAt('/nen-tang/thu-chi/moi')
    await user.click(await screen.findByRole('button', { name: 'Lưu nháp' }))
    expect(await screen.findByText('Số tiền phải là số nguyên đồng lớn hơn 0.')).toBeInTheDocument()
    await user.selectOptions(document.getElementById('fr-cat') as HTMLSelectElement, 'Phí nhắn tin SMS')
    await user.type(document.getElementById('fr-amount') as HTMLInputElement, '500000')
    await user.click(screen.getByRole('button', { name: 'Lưu nháp' }))
    expect(await screen.findByText(/đã được lưu ở trạng thái nháp/)).toBeInTheDocument()
    expect((await financeDemoStore.listRecords({})).total).toBe(25)
  })
  it('ghi sổ nháp FR-0108 qua hộp thoại xác nhận; khoản ghi sổ chỉ đọc', async () => {
    const user = userEvent.setup()
    renderAt('/nen-tang/thu-chi/FR-0108')
    await user.click(await screen.findByRole('button', { name: /Ghi sổ/ }))
    expect((await screen.findAllByText('Xem lại trước khi ghi sổ')).length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: 'Xác nhận ghi sổ' }))
    expect((await screen.findAllByText('Khoản FR-0108 đã ghi sổ')).length).toBeGreaterThan(0)
    expect((await financeDemoStore.getRecord('FR-0108')).record.state).toBe('POSTED')
  })
  it('khoản đã ghi sổ mở trang chỉ đọc, không có Lưu nháp', async () => {
    renderAt('/nen-tang/thu-chi/FR-0104')
    expect(await screen.findByRole('button', { name: 'Hủy bỏ khoản đã ghi sổ' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Lưu nháp' })).toBeNull()
    expect(document.getElementById('fr-amount')).toHaveAttribute('readonly')
  })
})

describe('SCR-73 báo cáo dòng tiền', () => {
  it('hiện tổng khớp bản chốt và chạy lại tạo bản chốt mới', async () => {
    const user = userEvent.setup()
    renderAt('/nen-tang/bao-cao-dong-tien')
    expect(await screen.findByText('100.140.000 đ')).toBeInTheDocument()
    expect(screen.getByText(/SNAP-20261019-001/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Chạy \/ làm mới báo cáo/ }))
    expect((await screen.findAllByText('Đã làm mới báo cáo')).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/SNAP-20261019-002/).length).toBeGreaterThan(0)
  })
  it('xuất XLSX đúng bản chốt đang xem', async () => {
    const user = userEvent.setup()
    renderAt('/nen-tang/bao-cao-dong-tien')
    await user.click(await screen.findByRole('button', { name: /Xuất XLSX/ }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /Xuất XLSX/ }))
    expect(await screen.findByText(/dong-tien-nen-tang-SNAP-20261019-001\.xlsx/)).toBeInTheDocument()
  })
  it('bản chốt hết hạn: xuất báo hộp thoại không còn khả dụng', async () => {
    const user = userEvent.setup()
    financeDemoStore.expireReport(financeDemoStore.currentReport().id)
    renderAt('/nen-tang/bao-cao-dong-tien?m=xuat')
    expect(await screen.findByText(/đã hết hạn/)).toBeInTheDocument()
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /Xuất XLSX/ }))
    expect((await screen.findAllByText('Kết quả báo cáo không còn khả dụng')).length).toBeGreaterThan(0)
  })
})

describe('thông báo của PM', () => {
  it('đối soát: đếm chưa đọc, mở thông báo đánh dấu đã đọc và chuyển trang', async () => {
    const user = userEvent.setup()
    renderAt('/nen-tang/thong-bao-doi-soat')
    expect(await screen.findByRole('button', { name: 'Chưa đọc 3' })).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: 'Xem xét' })[0])
    expect(await screen.findByText('Màn thanh toán')).toBeInTheDocument()
    expect((await financeDemoStore.listNotices('RECON')).filter((n) => !n.readTime)).toHaveLength(2)
  })
  it('hỗ trợ: đánh dấu đã đọc tất cả', async () => {
    const user = userEvent.setup()
    renderAt('/nen-tang/thong-bao-ho-tro')
    await user.click(await screen.findByRole('button', { name: /Đánh dấu đã đọc tất cả/ }))
    expect(await screen.findByText('Tất cả thông báo đã được đánh dấu là đã đọc.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Chưa đọc 0' })).toBeInTheDocument()
  })
})
