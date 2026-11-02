import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import FeedStockPage from '../../../src/features/feed-stock/pages/FeedStockPage'
import FeedStockAdjustmentFormPage from '../../../src/features/feed-stock/pages/FeedStockAdjustmentFormPage'
import { FEED_STOCK_MOCK } from '../../../src/features/feed-stock/data/feedStockMock'
import { listFeedStock } from '../../../src/features/feed-stock/api/feedStockApi'
import FeedStockTable from '../../../src/features/feed-stock/components/FeedStockTable'
import type { FeedStockRow } from '../../../src/features/feed-stock/types'

vi.mock('../../../src/features/feed-stock/api/feedStockApi', () => ({
  listFeedStock: vi.fn(),
}))

const listFeedStockMock = vi.mocked(listFeedStock)

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/thuc-an']}>
      <Routes>
        <Route path="/thuc-an" element={<FeedStockPage />} />
        <Route path="/thuc-an/kiem-ke/moi" element={<FeedStockAdjustmentFormPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('SCR-77 Feed Stock page', () => {
  beforeEach(() => {
    listFeedStockMock.mockReset()
    listFeedStockMock.mockResolvedValue(FEED_STOCK_MOCK)
  })

  it('renders stock data and opens the implemented stock adjustment screen', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Quản lý thức ăn' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Tồn kho' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getAllByRole('tab')).toHaveLength(7)
    expect(screen.getByRole('tab', { name: 'Phiếu nhập kho' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Kiểm kê / điều chỉnh' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Tạo phiếu nhập kho' })).toBeEnabled()

    expect(await screen.findByRole('table')).toBeInTheDocument()
    expect(screen.getByText('Thức ăn đang dùng')).toBeInTheDocument()
    expect(screen.getByText('Sắp hết / hết')).toBeInTheDocument()
    expect(screen.getByText('Giá trị tồn kho')).toBeInTheDocument()
    expect(screen.getByText('Tiêu thụ TB 7 ngày')).toBeInTheDocument()
    // Value and daily use are summed from the rows (Σ stock × Giá BQ), not typed in.
    expect(screen.getByText('28.247.000 đ')).toBeInTheDocument()
    expect(screen.getByText('1.213 kg/ngày')).toBeInTheDocument()
    expect(screen.getByText('Thô 3 · Tinh 2 · TMR 1 · Khoáng 1 · Sữa 1')).toBeInTheDocument()
    expect(screen.getByText('Cỏ voi · Cám ngô · Sữa thay thế')).toBeInTheDocument()
    expect(screen.queryByText('38.450.000 đ')).not.toBeInTheDocument()

    expect(screen.getByRole('searchbox', { name: /Tìm mã, tên thức ăn/i })).toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Đủ dùng' })).toBeInTheDocument()
    expect(screen.getByRole('row', { name: /TA-01 Cỏ voi/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nhập kho Cỏ voi' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Xem biến động Cỏ voi' })).toBeEnabled()
    // Only low or empty feeds offer a quick receipt action, as in the frame.
    expect(screen.queryByRole('button', { name: 'Nhập kho Rơm khô' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Kiểm kê / điều chỉnh' }))
    expect(await screen.findByRole('heading', { name: 'Tạo phiếu kiểm kê / điều chỉnh' })).toBeInTheDocument()
  })

  it('combines text, group, and status filters', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('table')

    await user.type(screen.getByRole('searchbox', { name: /Tìm mã, tên thức ăn/i }), 'TA-06')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Nhóm thức ăn' }), 'CONCENTRATE')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Trạng thái tồn kho' }), 'LOW')

    expect(screen.getByRole('row', { name: /TA-06 Cám ngô/i })).toBeInTheDocument()
    expect(screen.queryByRole('row', { name: /TA-01/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('row', { name: /TA-05/i })).not.toBeInTheDocument()
  })

  it('opens the stock movement history of a feed from the Xem action and closes it', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('table')

    await user.click(screen.getByRole('button', { name: 'Xem biến động Cỏ voi' }))
    const dialog = await screen.findByRole('dialog', { name: /Biến động tồn kho TA-01/ })
    expect(await within(dialog).findByRole('columnheader', { name: 'Tồn sau' })).toBeInTheDocument()
    // The newest movement ends at the stock shown in the list.
    expect((await within(dialog).findAllByRole('row'))[1]).toHaveTextContent('1.850 kg')
    await user.click(within(dialog).getAllByRole('button', { name: 'Đóng' })[1])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows a distinct empty inventory and no-results state', async () => {
    listFeedStockMock.mockResolvedValueOnce([])
    const { unmount } = renderPage()
    expect(await screen.findByText('Chưa có dữ liệu tồn kho.')).toBeInTheDocument()

    listFeedStockMock.mockResolvedValueOnce(FEED_STOCK_MOCK)
    const user = userEvent.setup()
    unmount()
    renderPage()
    await screen.findByRole('table')
    await user.type(screen.getByRole('searchbox', { name: /Tìm mã, tên thức ăn/i }), 'không có mặt hàng này')
    expect(screen.getByText('Không tìm thấy thức ăn phù hợp với bộ lọc.')).toBeInTheDocument()
  })

  it('shows loading and retryable error states without substituting fixture rows', async () => {
    let resolveStock: ((rows: typeof FEED_STOCK_MOCK) => void) | undefined
    listFeedStockMock.mockImplementationOnce(() => new Promise((resolve) => { resolveStock = resolve }))
    renderPage()

    expect(screen.getByRole('status')).toHaveTextContent('Đang tải tồn kho…')
    expect(screen.queryByRole('row', { name: /TA-01/i })).not.toBeInTheDocument()
    expect(screen.getByText('Giá trị tồn kho')).toBeInTheDocument()
    expect(screen.getAllByText('Chưa tải được dữ liệu')).toHaveLength(2)

    resolveStock?.(FEED_STOCK_MOCK)
    expect(await screen.findByRole('row', { name: /TA-01/i })).toBeInTheDocument()
  })

  it('offers retry after backend error and shows recovered rows only after retry succeeds', async () => {
    const user = userEvent.setup()
    listFeedStockMock.mockRejectedValueOnce(new Error('Không thể kết nối máy chủ.'))
    listFeedStockMock.mockResolvedValueOnce(FEED_STOCK_MOCK)
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể kết nối máy chủ.')
    expect(screen.queryByRole('row', { name: /TA-01/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Thử tải lại' }))
    expect(await screen.findByRole('row', { name: /TA-01/i })).toBeInTheDocument()
    await waitFor(() => expect(listFeedStockMock).toHaveBeenCalledTimes(2))
  })

  it('shows unknown backend group and status codes without crashing or translating them', () => {
    const row = {
      ...FEED_STOCK_MOCK[0],
      group: 'NEW_GROUP',
      status: 'FUTURE_STATUS',
    } as unknown as FeedStockRow

    render(<MemoryRouter><FeedStockTable rows={[row]} /></MemoryRouter>)

    expect(screen.getByText('NEW_GROUP')).toBeInTheDocument()
    expect(screen.getByText('FUTURE_STATUS')).toBeInTheDocument()
  })
})
