import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import FeedReceiptPage from '../../../src/features/feed-stock/pages/FeedReceiptPage'
import { FEED_RECEIPT_MOCK } from '../../../src/features/feed-stock/data/feedReceiptMock'
import { listFeedReceipts } from '../../../src/features/feed-stock/api/feedReceiptApi'

vi.mock('../../../src/features/feed-stock/api/feedReceiptApi', () => ({
  listFeedReceipts: vi.fn(),
}))

const listReceiptsMock = vi.mocked(listFeedReceipts)

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/thuc-an/phieu-nhap']}>
      <FeedReceiptPage />
    </MemoryRouter>,
  )
}

describe('SCR-78 Feed Receipts page', () => {
  beforeEach(() => {
    listReceiptsMock.mockReset()
    listReceiptsMock.mockResolvedValue(FEED_RECEIPT_MOCK)
  })

  it('renders the receipt tiles from the loaded rows and marks unavailable values explicitly', async () => {
    renderPage()

    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Phiếu nhập kho' })).toBeInTheDocument()
    expect(screen.getByText('Nhập kho 30 ngày qua')).toBeInTheDocument()
    expect(screen.getByText('16.400 kg')).toBeInTheDocument()
    expect(screen.getByText('3 phiếu · 27.100.000 đ')).toBeInTheDocument()
    expect(screen.getByText('Còn nợ nhà cung cấp')).toBeInTheDocument()
    expect(screen.getByText('2.500.000 đ')).toBeInTheDocument()
    expect(screen.getByText('1 phiếu · PNK-2026-0029')).toBeInTheDocument()
    expect(screen.getByText('Nhà cung cấp đang giao dịch')).toBeInTheDocument()
    expect(await screen.findByText('Hưng Thịnh · HTX cỏ Ba Vì · TMR Việt Phát · …')).toBeInTheDocument()
    expect(screen.getByRole('row', { name: new RegExp(FEED_RECEIPT_MOCK[0].code) })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Còn nợ (đ)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Tạo phiếu nhập kho/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: new RegExp(`Tiếp tục ${FEED_RECEIPT_MOCK[0].code}`) })).toBeEnabled()
    expect(screen.getByRole('button', { name: new RegExp(`Xem ${FEED_RECEIPT_MOCK[1].code}`) })).toBeEnabled()
    // A voided receipt shows its reason, a draft shows "nháp" instead of a debt.
    expect(screen.getByText('Hủy: nhập trùng PNK-0026')).toBeInTheDocument()
    expect(screen.getByText('Hiển thị 6 / 6 phiếu')).toBeInTheDocument()
  })

  it('filters the loaded list by status, date range, and supplier', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('table')

    fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: `${new Date().getFullYear() - 1}-01-01` } })
    fireEvent.change(screen.getByLabelText('Đến ngày'), { target: { value: `${new Date().getFullYear() + 1}-12-31` } })

    await user.click(screen.getByRole('button', { name: /Đã nhập/ }))
    expect(screen.queryByRole('row', { name: new RegExp(FEED_RECEIPT_MOCK[0].code) })).not.toBeInTheDocument()
    expect(screen.getByRole('row', { name: new RegExp(FEED_RECEIPT_MOCK[1].code) })).toBeInTheDocument()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Nhà cung cấp' }), '203')
    expect(screen.queryByRole('row', { name: new RegExp(FEED_RECEIPT_MOCK[1].code) })).not.toBeInTheDocument()
    expect(screen.getByRole('row', { name: new RegExp(FEED_RECEIPT_MOCK[2].code) })).toBeInTheDocument()

    const nextDay = new Date(`${FEED_RECEIPT_MOCK[2].receiptDate}T12:00:00`)
    nextDay.setDate(nextDay.getDate() + 1)
    const nextDayIso = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`
    fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: nextDayIso } })
    expect(screen.queryByRole('row', { name: new RegExp(FEED_RECEIPT_MOCK[2].code) })).not.toBeInTheDocument()
  })

  it('shows loading and empty states without substituting local fixture rows', async () => {
    let resolveReceipts: ((rows: typeof FEED_RECEIPT_MOCK) => void) | undefined
    listReceiptsMock.mockImplementationOnce(() => new Promise((resolve) => { resolveReceipts = resolve }))
    renderPage()

    expect(screen.getByRole('status')).toHaveTextContent('Đang tải phiếu nhập kho…')
    expect(screen.queryByRole('row', { name: new RegExp(FEED_RECEIPT_MOCK[0].code) })).not.toBeInTheDocument()
    resolveReceipts?.([])
    expect(await screen.findByText('Chưa có phiếu nhập kho.')).toBeInTheDocument()
  })

  it('shows retryable errors and does not fall back to mock data', async () => {
    const user = userEvent.setup()
    listReceiptsMock.mockRejectedValueOnce(new Error('Không thể kết nối máy chủ.'))
    listReceiptsMock.mockResolvedValueOnce(FEED_RECEIPT_MOCK)
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể kết nối máy chủ.')
    expect(screen.queryByRole('row', { name: new RegExp(FEED_RECEIPT_MOCK[0].code) })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Thử tải lại' }))
    expect(await screen.findByRole('row', { name: new RegExp(FEED_RECEIPT_MOCK[0].code) })).toBeInTheDocument()
    await waitFor(() => expect(listReceiptsMock).toHaveBeenCalledTimes(2))
  })

  it('keeps unknown backend status labels visible without crashing', async () => {
    listReceiptsMock.mockResolvedValueOnce([
      { ...FEED_RECEIPT_MOCK[0], status: 'RECONCILED_LATER' },
    ])
    renderPage()

    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.getByText('RECONCILED_LATER')).toBeInTheDocument()
  })
})
