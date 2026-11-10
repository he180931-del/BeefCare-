import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { catalogueApi } from '../../../src/features/farm-catalogue/api/catalogueApi'
import { catalogueDemoStore } from '../../../src/features/farm-catalogue/data/catalogueDemoStore'
import CatalogueRoutes from '../../../src/features/farm-catalogue/pages/CatalogueRoutes'
import { SessionContext, type AppRole, type Session } from '../../../src/features/authorization/sessionContext'

const sessionFor = (role: AppRole): Session => ({
  role, fullName: 'Nguyễn Văn Hùng', email: 'x@beefcare.local', farmId: 1, farmName: 'Trại bò Yên Bài – Ba Vì', logout: async () => undefined,
})
function renderAt(path: string, role: AppRole = 'OWNER') {
  return render(
    <SessionContext.Provider value={sessionFor(role)}>
      <MemoryRouter initialEntries={[path]}>
        <Routes><Route path="/danh-muc/*" element={<CatalogueRoutes />} /></Routes>
      </MemoryRouter>
    </SessionContext.Provider>,
  )
}

beforeEach(async () => { await catalogueDemoStore.reset() })

describe('breeds tab', () => {
  it('opens on breeds, edits a selected row beside the list and saves it', async () => {
    const user = userEvent.setup()
    renderAt('/danh-muc')
    expect(await screen.findByText('Sửa giống: Zebu đỏ')).toBeInTheDocument()
    await user.click(await screen.findByText('Lai Sind'))
    expect(await screen.findByText('Sửa giống: Lai Sind')).toBeInTheDocument()
    expect(screen.getByLabelText('Mã giống *')).toHaveAttribute('readonly')
    const name = screen.getByLabelText('Tên giống *')
    await user.clear(name)
    await user.type(name, 'Lai Sind F1')
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    expect(await screen.findByText('Đã lưu Lai Sind F1.')).toBeInTheDocument()
    expect(await screen.findByText('Lai Sind F1')).toBeInTheDocument()
  })

  it('adds a breed and shows a duplicate code under the field', async () => {
    const user = userEvent.setup()
    renderAt('/danh-muc/giong')
    await user.click(await screen.findByRole('button', { name: 'Thêm giống' }))
    await user.type(screen.getByLabelText('Mã giống *'), 'zeb-do')
    await user.type(screen.getByLabelText('Tên giống *'), 'Giống mới')
    await user.click(screen.getByRole('button', { name: 'Lưu' }))
    expect(await screen.findByText('Mã ZEB-DO đã tồn tại trong danh mục này.')).toBeInTheDocument()
    await user.clear(screen.getByLabelText('Mã giống *'))
    await user.type(screen.getByLabelText('Mã giống *'), 'NEW-1')
    await user.click(screen.getByRole('button', { name: 'Lưu' }))
    expect(await screen.findByText('Đã lưu Giống mới.')).toBeInTheDocument()
  })

  it('asks for confirmation before deactivating a referenced breed', async () => {
    const user = userEvent.setup()
    renderAt('/danh-muc/giong')
    await screen.findByText('Sửa giống: Zebu đỏ')
    await user.click(screen.getByRole('radio', { name: 'Ngừng dùng' }))
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    expect(await screen.findByText(/đang được dùng bởi 142 bản ghi/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ngừng dùng' }))
    expect(await screen.findByText('Đã lưu Zebu đỏ.')).toBeInTheDocument()
    expect((await catalogueApi.listBreeds({ q: 'ZEB-DO' }))[0]?.available).toBe(false)
  })

  it('shows the empty state for a search with no result and an error state when loading fails', async () => {
    const user = userEvent.setup()
    renderAt('/danh-muc/giong')
    await user.type(await screen.findByLabelText('Tìm mã, tên'), 'zzzz')
    expect(await screen.findByText('Không có giống nào phù hợp')).toBeInTheDocument()
  })

  it('shows an error block when the list cannot be loaded', async () => {
    vi.spyOn(catalogueApi, 'listBreeds').mockRejectedValue(new Error('network'))
    renderAt('/danh-muc/giong')
    expect(await screen.findByText(/Không tải được danh mục giống bò|network/)).toBeInTheDocument()
  })
})

describe('vaccines, medicines and purposes', () => {
  it('flags a vaccine without dose and route, and refuses to delete a used one', async () => {
    const user = userEvent.setup()
    renderAt('/danh-muc/vac-xin')
    expect(await screen.findByText('Bổ sung theo nhãn')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Xóa' }))
    expect(await screen.findByText('Vắc-xin này đã được dùng nên không xóa được. Hãy ngừng dùng thay vì xóa.')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Xóa' })).toHaveLength(1)
  })

  it('deletes a vaccine that was never used after confirmation', async () => {
    const user = userEvent.setup()
    renderAt('/danh-muc/vac-xin')
    await user.click(await screen.findByText('Vắc-xin nhiệt thán'))
    await user.click(screen.getByRole('button', { name: 'Xóa' }))
    expect(await screen.findByText('Xóa vắc-xin Vắc-xin nhiệt thán? Vắc-xin này chưa từng được dùng.')).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: 'Xóa' }).at(-1)!)
    await waitFor(() => expect(screen.queryByText('Vắc-xin nhiệt thán')).toBeNull())
  })

  it('validates the meat withdrawal range of a medicine under the field', async () => {
    const user = userEvent.setup()
    renderAt('/danh-muc/thuoc')
    await screen.findByText('Sửa thuốc: Oxytetracycline 20% LA')
    const days = screen.getByLabelText('Ngưng sử dụng thịt *')
    await user.clear(days)
    await user.type(days, '400')
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    expect(await screen.findByText('Ngưng sử dụng thịt phải nằm trong khoảng 0 đến 365.')).toBeInTheDocument()
  })

  it('locks the purpose type of a referenced purpose only', async () => {
    const user = userEvent.setup()
    renderAt('/danh-muc/muc-dich')
    await screen.findByText('Sửa mục đích: Sinh sản')
    expect(screen.getByLabelText('Loại mục đích *')).toBeDisabled()
    await user.click(screen.getByText('Nuôi bán giống'))
    expect(await screen.findByText('Sửa mục đích: Nuôi bán giống')).toBeInTheDocument()
    expect(screen.getByLabelText('Loại mục đích *')).toBeEnabled()
  })
})

describe('parameters tab', () => {
  it('shows ranges under the field, then saves a new version and lists it in the history', async () => {
    const user = userEvent.setup()
    renderAt('/danh-muc/tham-so')
    expect(await screen.findByText('v3 · đang áp dụng')).toBeInTheDocument()
    const weaning = screen.getByLabelText('Tuổi cai sữa *')
    await user.clear(weaning)
    await user.type(weaning, '20')
    await user.click(screen.getAllByRole('button', { name: 'Lưu phiên bản mới' }).at(-1)!)
    expect(await screen.findByText('Tuổi cai sữa phải nằm trong khoảng 3 đến 12.')).toBeInTheDocument()
    expect(screen.getByText('Ghi chú nguồn là bắt buộc.')).toBeInTheDocument()

    await user.clear(weaning)
    await user.type(weaning, '7')
    await user.type(screen.getByLabelText('Ghi chú nguồn *'), 'Phỏng vấn chủ trại 20/10/2026')
    await user.click(screen.getAllByRole('button', { name: 'Lưu phiên bản mới' }).at(-1)!)
    expect(await screen.findByText(/Đã lưu phiên bản tham số v4, áp dụng từ/)).toBeInTheDocument()
    expect(await screen.findByText('v4 · đang áp dụng')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Lịch sử phiên bản' }))
    expect(await screen.findByText('Tuổi cai sữa 6 → 7 tháng')).toBeInTheDocument()
    expect(screen.getByText('Cân tối thiểu phối 220 → 230 kg')).toBeInTheDocument()
    expect(screen.getByText('Tham số trạng thái & nhắc việc · 4 phiên bản')).toBeInTheDocument()
  })

  it('opens the history dialog straight from its route', async () => {
    renderAt('/danh-muc/tham-so/lich-su')
    expect(await screen.findByText('Tham số trạng thái & nhắc việc · 3 phiên bản')).toBeInTheDocument()
    expect(screen.getByText('Cân xuất mục tiêu 450 → 380 kg')).toBeInTheDocument()
    expect(screen.getByText('v3 · hiện tại')).toBeInTheDocument()
  })

  it('keeps scheduled values out of the active form and can save again', async () => {
    const user = userEvent.setup()
    renderAt('/danh-muc/tham-so')
    await screen.findByText('v3 · đang áp dụng')
    const weaning = screen.getByLabelText('Tuổi cai sữa *')
    await user.clear(weaning)
    await user.type(weaning, '7')
    const date = screen.getByLabelText('Áp dụng từ *')
    fireEvent.change(date, { target: { value: '2099-01-01' } })
    const source = screen.getByLabelText('Ghi chú nguồn *')
    await user.type(source, 'Điều chỉnh lên lịch')
    const save = screen.getAllByRole('button', { name: 'Lưu phiên bản mới' }).at(-1)!
    await user.click(save)
    expect(await screen.findByText(/Đã lên lịch phiên bản v4/)).toBeInTheDocument()
    expect(weaning).toHaveValue('6')
    await user.type(source, 'Điều chỉnh hôm nay')
    await user.click(save)
    expect(await screen.findByText('v5 · đang áp dụng')).toBeInTheDocument()
  })
})

describe('roles', () => {
  it('lets the manager add and the technician only read', async () => {
    const manager = renderAt('/danh-muc/giong', 'MANAGER')
    expect(await screen.findByRole('button', { name: 'Thêm giống' })).toBeInTheDocument()
    manager.unmount()

    renderAt('/danh-muc/giong', 'TECHNICIAN')
    expect(await screen.findByText('Giống: Zebu đỏ')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Thêm giống' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Lưu thay đổi' })).toBeNull()
    expect(screen.getByLabelText('Tên giống *')).toHaveAttribute('readonly')
  })

  it('hides saving of parameters for a read-only role but keeps the history', async () => {
    renderAt('/danh-muc/tham-so', 'TECHNICIAN')
    expect(await screen.findByText('v3 · đang áp dụng')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Lưu phiên bản mới' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Lịch sử phiên bản' })).toBeInTheDocument()
    expect(screen.getByLabelText('Tuổi cai sữa *')).toHaveAttribute('readonly')
  })
})
