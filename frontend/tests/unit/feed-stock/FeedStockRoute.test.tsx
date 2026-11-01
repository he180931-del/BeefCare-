import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../../../src/App'
import { FEED_STOCK_MOCK } from '../../../src/features/feed-stock/data/feedStockMock'
import { listFeedStock } from '../../../src/features/feed-stock/api/feedStockApi'
import { FEED_RECEIPT_MOCK } from '../../../src/features/feed-stock/data/feedReceiptMock'
import { listFeedReceipts } from '../../../src/features/feed-stock/api/feedReceiptApi'
import userEvent from '@testing-library/user-event'

vi.mock('../../../src/features/feed-stock/api/feedStockApi', () => ({
  listFeedStock: vi.fn(),
}))

vi.mock('../../../src/features/feed-stock/api/feedReceiptApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../../src/features/feed-stock/api/feedReceiptApi')>(),
  listFeedReceipts: vi.fn(),
}))

describe('SCR-77 route', () => {
  beforeEach(() => {
    vi.mocked(listFeedStock).mockReset()
    vi.mocked(listFeedStock).mockResolvedValue(FEED_STOCK_MOCK)
    vi.mocked(listFeedReceipts).mockReset()
    vi.mocked(listFeedReceipts).mockResolvedValue(FEED_RECEIPT_MOCK)
  })

  it('loads the stock page from the existing menu route', async () => {
    render(
      <MemoryRouter initialEntries={['/thuc-an']}>
        <App />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Quản lý thức ăn' })).toBeInTheDocument()
  })

  it('opens the receipt page from the stock tab and returns to stock from its tab', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/thuc-an']}>
        <App />
      </MemoryRouter>,
    )

    await screen.findByRole('heading', { name: 'Quản lý thức ăn' })
    await user.click(screen.getByRole('tab', { name: 'Phiếu nhập kho' }))
    expect(await screen.findByRole('heading', { name: 'Phiếu nhập kho thức ăn' })).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Tồn kho' }))
    expect(await screen.findByRole('heading', { name: 'Quản lý thức ăn' })).toBeInTheDocument()
  })

  it('loads the receipt route directly', async () => {
    render(
      <MemoryRouter initialEntries={['/thuc-an/phieu-nhap']}>
        <App />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Phiếu nhập kho thức ăn' })).toBeInTheDocument()
  })

  it('opens the feed catalogue from the enabled management tab and direct route', async () => {
    const user = userEvent.setup()
    const { unmount } = render(
      <MemoryRouter initialEntries={['/thuc-an']}>
        <App />
      </MemoryRouter>,
    )
    await screen.findByRole('heading', { name: 'Quản lý thức ăn' })
    await user.click(screen.getByRole('tab', { name: /Danh mục/ }))
    expect(await screen.findByRole('heading', { name: 'Danh mục thức ăn & nhà cung cấp' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Danh mục' })).toHaveAttribute('aria-selected', 'true')

    unmount()
    render(<MemoryRouter initialEntries={['/thuc-an/danh-muc']}><App /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'Danh mục thức ăn & nhà cung cấp' })).toBeInTheDocument()
  })

  it('opens new receipts from stock actions and carries the selected feed into the form', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/thuc-an']}>
        <App />
      </MemoryRouter>,
    )

    await screen.findByRole('table')
    await user.click(screen.getByRole('button', { name: 'Nhập kho Bắp ủ chua' }))
    expect(await screen.findByRole('heading', { name: 'Tạo phiếu nhập kho thức ăn' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Thức ăn dòng 1' })).toHaveValue('101')
  })
})
