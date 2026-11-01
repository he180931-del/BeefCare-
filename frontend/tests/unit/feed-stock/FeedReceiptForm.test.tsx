import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../../../src/App'
import { FEED_STOCK_MOCK } from '../../../src/features/feed-stock/data/feedStockMock'
import { listFeedStock } from '../../../src/features/feed-stock/api/feedStockApi'
import { listFeedReceipts, resetFeedReceiptDemoStore } from '../../../src/features/feed-stock/api/feedReceiptApi'

function renderApp(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)
}

describe('SCR-79 Feed Receipt form', () => {
  beforeEach(async () => {
    localStorage.clear()
    localStorage.setItem('beefcare:latency', '0')
    await resetFeedReceiptDemoStore()
  })

  it('validates a supplier and a complete positive-quantity line before saving', async () => {
    const user = userEvent.setup()
    renderApp('/thuc-an/phieu-nhap/moi')
    await screen.findByRole('heading', { name: 'Tạo phiếu nhập kho thức ăn' })

    await user.click(screen.getByRole('button', { name: 'Ghi nhận & thêm vào kho' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Chọn nhà cung cấp.')

    await user.selectOptions(screen.getByRole('combobox', { name: 'Nhà cung cấp' }), '201')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Thức ăn dòng 1' }), '101')
    await user.click(screen.getByRole('button', { name: 'Lưu nháp' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Nhập số lượng lớn hơn 0 cho dòng 1.')
    expect(await listFeedReceipts()).toHaveLength(3)
  })

  it('rejects an initial payment above the receipt total', async () => {
    const user = userEvent.setup()
    renderApp('/thuc-an/phieu-nhap/moi')
    await screen.findByRole('heading', { name: 'Tạo phiếu nhập kho thức ăn' })
    await user.selectOptions(screen.getByRole('combobox', { name: 'Nhà cung cấp' }), '201')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Thức ăn dòng 1' }), '101')
    await user.type(screen.getByLabelText('Số lượng dòng 1'), '10')
    await user.type(screen.getByLabelText('Đơn giá dòng 1'), '100')
    await user.clear(screen.getByLabelText('Đã thanh toán'))
    await user.type(screen.getByLabelText('Đã thanh toán'), '1001')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Hình thức thanh toán' }), 'CASH')
    const today = new Date()
    fireEvent.change(screen.getByLabelText('Ngày thanh toán'), { target: { value: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}` } })
    await user.click(screen.getByRole('button', { name: 'Lưu nháp' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Số tiền đã trả không được vượt tổng phải trả.')
    expect(await listFeedReceipts()).toHaveLength(3)
  })

  it('saves, reopens, updates, and posts a local demo receipt while updating demo stock', async () => {
    const user = userEvent.setup()
    renderApp('/thuc-an/phieu-nhap/moi')
    await screen.findByRole('heading', { name: 'Tạo phiếu nhập kho thức ăn' })

    await user.selectOptions(screen.getByRole('combobox', { name: 'Nhà cung cấp' }), '201')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Thức ăn dòng 1' }), '101')
    await user.type(screen.getByLabelText('Số lượng dòng 1'), '10')
    await user.type(screen.getByLabelText('Đơn giá dòng 1'), '12000')
    await user.type(screen.getByLabelText('Ghi chú'), 'Phiếu demo để kiểm tra')
    await user.clear(screen.getByLabelText('Đã thanh toán'))
    await user.type(screen.getByLabelText('Đã thanh toán'), '20000')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Hình thức thanh toán' }), 'CASH')
    const today = new Date()
    fireEvent.change(screen.getByLabelText('Ngày thanh toán'), { target: { value: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}` } })
    await user.click(screen.getByRole('button', { name: 'Lưu nháp' }))

    expect(await screen.findByRole('heading', { name: 'Phiếu nhập kho thức ăn' })).toBeInTheDocument()
    const created = (await listFeedReceipts()).find((row) => row.status === 'DRAFT' && row.code.endsWith('0004'))
    expect(created).toBeDefined()
    const reopen = screen.getByRole('button', { name: `Tiếp tục ${created!.code}` })
    await user.click(reopen)

    expect(await screen.findByRole('heading', { name: 'Sửa phiếu nhập kho thức ăn' })).toBeInTheDocument()
    expect(screen.getByLabelText('Ghi chú')).toHaveValue('Phiếu demo để kiểm tra')
    await user.clear(screen.getByLabelText('Ghi chú'))
    await user.type(screen.getByLabelText('Ghi chú'), 'Đã mở lại và cập nhật')
    await user.click(screen.getByRole('button', { name: 'Lưu nháp' }))
    await screen.findByRole('heading', { name: 'Phiếu nhập kho thức ăn' })

    await user.click(screen.getByRole('button', { name: `Tiếp tục ${created!.code}` }))
    await screen.findByRole('heading', { name: 'Sửa phiếu nhập kho thức ăn' })
    await user.click(screen.getByRole('button', { name: 'Ghi nhận & thêm vào kho' }))
    await screen.findByRole('heading', { name: 'Phiếu nhập kho thức ăn' })

    const posted = (await listFeedReceipts()).find((row) => row.id === created!.id)
    expect(posted?.status).toBe('POSTED')
    expect(posted?.totalPayable).toBe(120_000)
    expect((await listFeedStock()).find((row) => row.feedItemId === 101)?.onHandKg).toBe(FEED_STOCK_MOCK[0].onHandKg + 10)
    await user.click(await screen.findByRole('button', { name: `Xem ${created!.code}` }))
    expect(await screen.findByRole('heading', { name: 'Chi tiết phiếu nhập kho thức ăn' })).toBeInTheDocument()
    expect(screen.getByLabelText('Đã thanh toán')).toHaveValue(20_000)
  })
})
