import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../../../src/App'
import { FEED_STOCK_MOCK } from '../../../src/features/feed-stock/data/feedStockMock'
import { listFeedStock } from '../../../src/features/feed-stock/api/feedStockApi'
import {
  listFeedStockAdjustments,
  resetFeedStockAdjustmentDemoStore,
} from '../../../src/features/feed-stock/api/feedStockAdjustmentApi'

function renderApp(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)
}

describe('SCR-80 stock adjustment', () => {
  beforeEach(async () => {
    localStorage.clear()
    localStorage.setItem('beefcare:latency', '0')
    await resetFeedStockAdjustmentDemoStore()
  })

  it('opens a count form from the stock action and keeps the inventory tab available', async () => {
    const user = userEvent.setup()
    renderApp('/thuc-an')

    await screen.findByRole('table')
    await user.click(screen.getByRole('button', { name: 'Kiểm kê / điều chỉnh' }))
    expect(await screen.findByRole('heading', { name: 'Tạo phiếu kiểm kê / điều chỉnh' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quay lại tồn kho' })).toBeInTheDocument()
  })

  it('opens the saved adjustment list from the feed navigation tab', async () => {
    const user = userEvent.setup()
    renderApp('/thuc-an')
    await screen.findByRole('heading', { name: 'Quản lý thức ăn' })

    await user.click(screen.getByRole('tab', { name: 'Kiểm kê' }))
    expect(await screen.findByRole('heading', { name: 'Phiếu kiểm kê / điều chỉnh tồn kho' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Tạo phiếu kiểm kê' }))
    expect(await screen.findByRole('heading', { name: 'Tạo phiếu kiểm kê / điều chỉnh' })).toBeInTheDocument()
  })

  it('requires a non-negative count and a reason when a feed differs from system stock', async () => {
    const user = userEvent.setup()
    renderApp('/thuc-an/kiem-ke/moi')
    await screen.findByRole('table')

    await user.clear(screen.getByLabelText('Số đếm TA-01'))
    await user.type(screen.getByLabelText('Số đếm TA-01'), '-1')
    await user.click(screen.getByRole('button', { name: 'Lưu nháp' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Số đếm của TA-01 phải là số không âm.')

    await user.clear(screen.getByLabelText('Số đếm TA-01'))
    await user.type(screen.getByLabelText('Số đếm TA-01'), '1850')
    await user.click(screen.getByRole('button', { name: 'Lưu nháp' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Nhập lý do chênh lệch cho TA-01.')
    expect(await listFeedStockAdjustments()).toHaveLength(0)
  })

  it('saves a draft, reopens it, posts increase and decrease once, and updates demo stock atomically', async () => {
    const user = userEvent.setup()
    renderApp('/thuc-an/kiem-ke/moi')
    await screen.findByRole('table')

    await user.clear(screen.getByLabelText('Số đếm TA-01'))
    await user.type(screen.getByLabelText('Số đếm TA-01'), '1850')
    await user.type(screen.getByLabelText('Lý do TA-01'), 'Đếm thực tế')
    await user.clear(screen.getByLabelText('Số đếm TA-02'))
    await user.type(screen.getByLabelText('Số đếm TA-02'), '240')
    await user.type(screen.getByLabelText('Lý do TA-02'), 'Hao hụt')
    await user.click(screen.getByRole('button', { name: 'Lưu nháp' }))

    expect(await screen.findByRole('heading', { name: 'Phiếu kiểm kê / điều chỉnh tồn kho' })).toBeInTheDocument()
    const draft = (await listFeedStockAdjustments()).find((row) => row.status === 'DRAFT')!
    expect(draft.lines.find((line) => line.feedItemId === 101)?.differenceKg).toBe(10)
    expect(draft.lines.find((line) => line.feedItemId === 102)?.differenceKg).toBe(-20)
    await user.click(screen.getByRole('button', { name: `Tiếp tục ${draft.code}` }))
    expect(await screen.findByRole('heading', { name: 'Sửa phiếu kiểm kê / điều chỉnh' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Ghi nhận điều chỉnh' }))
    expect(await screen.findByRole('heading', { name: 'Quản lý thức ăn' })).toBeInTheDocument()
    expect((await listFeedStock()).find((row) => row.feedItemId === 101)?.onHandKg).toBe(FEED_STOCK_MOCK[0].onHandKg + 10)
    expect((await listFeedStock()).find((row) => row.feedItemId === 102)?.onHandKg).toBe(FEED_STOCK_MOCK[1].onHandKg - 20)
    expect((await listFeedStockAdjustments()).find((row) => row.id === draft.id)?.status).toBe('POSTED')

    await expect(import('../../../src/features/feed-stock/api/feedStockAdjustmentApi').then(({ postFeedStockAdjustmentDemo }) => postFeedStockAdjustmentDemo(draft.id)))
      .rejects.toThrow('Chỉ có thể ghi nhận phiếu nháp.')
    expect((await listFeedStock()).find((row) => row.feedItemId === 101)?.onHandKg).toBe(FEED_STOCK_MOCK[0].onHandKg + 10)
  })
})
