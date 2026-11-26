import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../../../src/app/routes/AppRoutes'
import { FEED_STOCK_MOCK } from '../../../src/features/feed-stock/data/feedStockMock'
import { listFeedStock } from '../../../src/features/feed-stock/api/feedStockApi'
import { listFeedReceipts, resetFeedReceiptDemoStore } from '../../../src/features/feed-stock/api/feedReceiptApi'
import * as feedReceiptApi from '../../../src/features/feed-stock/api/feedReceiptApi'
import { minimumExpiryDate, todayIso } from '../../../src/features/feed-stock/domain/feedReceiptForm'

function renderApp(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)
}

describe('SCR-79 Feed Receipt form', () => {
  beforeEach(async () => {
    localStorage.clear()
    localStorage.setItem('beefcare:latency', '0')
    await resetFeedReceiptDemoStore()
  })

  afterEach(() => vi.restoreAllMocks())

  it('offers active farm people while preserving free text in the recipient field', async () => {
    const user = userEvent.setup()
    vi.spyOn(feedReceiptApi, 'listFeedReceiptMembers').mockResolvedValue(['Lê Thị Mai'])
    renderApp('/thuc-an/phieu-nhap/moi')
    await screen.findByRole('heading', { name: 'Phiếu nhập kho mới' })

    const recipient = screen.getByLabelText('Người nhận hàng')
    expect(recipient).toHaveAttribute('list', 'feed-receipt-received-by-options')
    await waitFor(() => expect(document.querySelector('#feed-receipt-received-by-options option[value="Lê Thị Mai"]')).toBeInTheDocument())
    fireEvent.change(recipient, { target: { value: 'Lê Thị Mai' } })
    expect(recipient).toHaveValue('Lê Thị Mai')
    await user.clear(recipient)
    await user.type(recipient, 'Người nhận ngoài danh sách')
    expect(recipient).toHaveValue('Người nhận ngoài danh sách')
  })

  it('keeps recipient free text available when farm member listing is denied', async () => {
    const user = userEvent.setup()
    vi.spyOn(feedReceiptApi, 'listFeedReceiptMembers').mockRejectedValue(new Error('forbidden'))
    renderApp('/thuc-an/phieu-nhap/moi')
    await screen.findByRole('heading', { name: 'Phiếu nhập kho mới' })

    const recipient = screen.getByLabelText('Người nhận hàng')
    await user.clear(recipient)
    await user.type(recipient, 'Người nhận dự phòng')
    expect(recipient).toHaveValue('Người nhận dự phòng')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('adjusts quantity by exactly 0.1 and keeps manual three-decimal quantities valid', async () => {
    const user = userEvent.setup()
    renderApp('/thuc-an/phieu-nhap/moi')
    await screen.findByRole('heading', { name: 'Phiếu nhập kho mới' })

    const quantity = screen.getByLabelText('Số lượng dòng 1') as HTMLInputElement
    expect(quantity).toHaveAttribute('step', 'any')
    await user.type(quantity, '10')
    await user.click(screen.getByRole('button', { name: 'Tăng số lượng dòng 1' }))
    expect(quantity).toHaveValue(10.1)
    await user.click(screen.getByRole('button', { name: 'Giảm số lượng dòng 1' }))
    expect(quantity).toHaveValue(10)

    await user.clear(quantity)
    await user.type(quantity, '0.001')
    expect(quantity).toHaveValue(0.001)
    expect(quantity.validity.valid).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Tăng số lượng dòng 1' }))
    expect(quantity).toHaveValue(0.101)
    await user.click(screen.getByRole('button', { name: 'Giảm số lượng dòng 1' }))
    expect(quantity).toHaveValue(0.001)
  })

  it('keeps the selected unit value visible in a practical-width control', async () => {
    const user = userEvent.setup()
    renderApp('/thuc-an/phieu-nhap/moi')
    await screen.findByRole('heading', { name: 'Phiếu nhập kho mới' })
    await user.selectOptions(screen.getByRole('combobox', { name: 'Thức ăn dòng 1' }), '101')

    const unit = screen.getByRole('combobox', { name: 'Đơn vị dòng 1' }) as HTMLSelectElement
    await user.selectOptions(unit, 'kg')
    expect(unit).toHaveValue('kg')
    expect(unit).toHaveStyle({ width: '88px' })
  })

  it('validates a supplier and a complete positive-quantity line before saving', async () => {
    const user = userEvent.setup()
    renderApp('/thuc-an/phieu-nhap/moi')
    await screen.findByRole('heading', { name: 'Phiếu nhập kho mới' })

    await user.click(screen.getByRole('button', { name: 'Lưu & cộng kho' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Chọn nhà cung cấp.')

    await user.selectOptions(screen.getByRole('combobox', { name: 'Nhà cung cấp' }), '201')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Thức ăn dòng 1' }), '101')
    await user.click(screen.getByRole('button', { name: 'Lưu nháp phiếu' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Nhập số lượng lớn hơn 0 cho dòng 1.')
    expect(await listFeedReceipts()).toHaveLength(6)
  })

  it('labels expiry clearly and opens the date picker with the first valid day after receipt', async () => {
    renderApp('/thuc-an/phieu-nhap/moi')
    await screen.findByRole('heading', { name: 'Phiếu nhập kho mới' })

    expect(screen.getByText('Số lô · Hạn sử dụng')).toBeInTheDocument()
    const expiry = screen.getByLabelText('Hạn sử dụng dòng 1')
    expect(expiry).toHaveAttribute('min', minimumExpiryDate(todayIso()))
    expect(minimumExpiryDate('2026-12-31')).toBe('2027-01-01')

    const showPicker = vi.fn()
    Object.defineProperty(expiry, 'showPicker', { configurable: true, value: showPicker })
    fireEvent.click(expiry)
    expect(showPicker).toHaveBeenCalledOnce()
  })

  it('rejects an expiry date that is the same as the receipt date', async () => {
    const user = userEvent.setup()
    renderApp('/thuc-an/phieu-nhap/moi')
    await screen.findByRole('heading', { name: 'Phiếu nhập kho mới' })
    await user.selectOptions(screen.getByRole('combobox', { name: 'Nhà cung cấp' }), '201')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Thức ăn dòng 1' }), '101')
    await user.type(screen.getByLabelText('Số lượng dòng 1'), '1')
    await user.type(screen.getByLabelText('Đơn giá dòng 1'), '100')

    const receiptDate = (screen.getByLabelText('Ngày nhập kho *') as HTMLInputElement).value
    const expiry = screen.getByLabelText('Hạn sử dụng dòng 1')
    fireEvent.change(expiry, { target: { value: receiptDate } })
    expect(screen.getByText('Hạn sử dụng phải sau ngày nhập kho.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Lưu nháp phiếu' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Hạn sử dụng dòng 1 phải sau ngày nhập.')
    expect(await listFeedReceipts()).toHaveLength(6)
  })

  it('rejects an initial payment above the receipt total', async () => {
    const user = userEvent.setup()
    renderApp('/thuc-an/phieu-nhap/moi')
    await screen.findByRole('heading', { name: 'Phiếu nhập kho mới' })
    await user.selectOptions(screen.getByRole('combobox', { name: 'Nhà cung cấp' }), '201')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Thức ăn dòng 1' }), '101')
    await user.type(screen.getByLabelText('Số lượng dòng 1'), '10')
    await user.type(screen.getByLabelText('Đơn giá dòng 1'), '100')
    await user.clear(screen.getByLabelText('Đã thanh toán'))
    await user.type(screen.getByLabelText('Đã thanh toán'), '1001')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Phương thức thanh toán' }), 'CASH')
    await user.click(screen.getByRole('button', { name: 'Lưu nháp phiếu' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Số tiền đã trả không được vượt tổng phải trả.')
    expect(await listFeedReceipts()).toHaveLength(6)
  })

  it('sums multiple lots of the same feed in the projected stock', async () => {
    const user = userEvent.setup()
    renderApp('/thuc-an/phieu-nhap/moi')
    await screen.findByRole('heading', { name: 'Phiếu nhập kho mới' })
    await user.selectOptions(screen.getByRole('combobox', { name: 'Thức ăn dòng 1' }), '101')
    await user.type(screen.getByLabelText('Số lượng dòng 1'), '10')
    await user.click(screen.getByRole('button', { name: 'Thêm mặt hàng' }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Thức ăn dòng 2' }), '101')
    await user.type(screen.getByLabelText('Số lượng dòng 2'), '5')
    expect(screen.getByText('1.850 → 1.865 kg')).toBeInTheDocument()
  })

  it('saves, reopens, updates, and posts a local demo receipt while updating demo stock', async () => {
    const user = userEvent.setup()
    renderApp('/thuc-an/phieu-nhap/moi')
    await screen.findByRole('heading', { name: 'Phiếu nhập kho mới' })

    await user.selectOptions(screen.getByRole('combobox', { name: 'Nhà cung cấp' }), '201')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Thức ăn dòng 1' }), '101')
    await user.type(screen.getByLabelText('Số lượng dòng 1'), '10')
    await user.type(screen.getByLabelText('Đơn giá dòng 1'), '12000')
    await user.clear(screen.getByLabelText('Người nhận hàng'))
    await user.type(screen.getByLabelText('Người nhận hàng'), 'Người nhận ngoài danh sách')
    await user.type(screen.getByLabelText('Ghi chú'), 'Phiếu demo để kiểm tra')
    await user.clear(screen.getByLabelText('Đã thanh toán'))
    await user.type(screen.getByLabelText('Đã thanh toán'), '20000')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Phương thức thanh toán' }), 'CASH')
    await user.click(screen.getByRole('button', { name: 'Lưu nháp phiếu' }))

    expect(await screen.findByRole('heading', { name: 'Phiếu nhập kho' })).toBeInTheDocument()
    const created = (await listFeedReceipts()).find((row) => row.status === 'DRAFT' && row.code.endsWith('0032'))
    expect(created).toBeDefined()
    const reopen = screen.getByRole('button', { name: `Tiếp tục ${created!.code}` })
    await user.click(reopen)

    expect(await screen.findByRole('heading', { name: /Phiếu nhập kho PNK-\d{4}-0032 · Nháp/ })).toBeInTheDocument()
    expect(screen.getByLabelText('Người nhận hàng')).toHaveValue('Người nhận ngoài danh sách')
    expect(screen.getByLabelText('Ghi chú')).toHaveValue('Phiếu demo để kiểm tra')
    await user.clear(screen.getByLabelText('Ghi chú'))
    await user.type(screen.getByLabelText('Ghi chú'), 'Đã mở lại và cập nhật')
    await user.click(screen.getByRole('button', { name: 'Lưu nháp phiếu' }))
    await screen.findByRole('heading', { name: 'Phiếu nhập kho' })

    await user.click(screen.getByRole('button', { name: `Tiếp tục ${created!.code}` }))
    await screen.findByRole('heading', { name: /Phiếu nhập kho PNK-\d{4}-0032 · Nháp/ })
    await user.click(screen.getByRole('button', { name: 'Lưu & cộng kho' }))
    await screen.findByRole('heading', { name: 'Phiếu nhập kho' })

    const posted = (await listFeedReceipts()).find((row) => row.id === created!.id)
    expect(posted?.status).toBe('POSTED')
    expect(posted?.totalPayable).toBe(120_000)
    expect((await listFeedStock()).find((row) => row.feedItemId === 101)?.onHandKg).toBe(FEED_STOCK_MOCK[0].onHandKg + 10)
    await user.click(await screen.findByRole('button', { name: `Xem ${created!.code}` }))
    expect(await screen.findByRole('heading', { name: /Phiếu nhập kho PNK-\d{4}-0032 · Đã ghi/ })).toBeInTheDocument()
    expect(screen.getByLabelText('Người nhận hàng')).toHaveAttribute('readonly')
    expect(document.querySelector('#feed-receipt-received-by-options')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tăng số lượng dòng 1' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Đã thanh toán')).toHaveValue(20_000)
  })
})
