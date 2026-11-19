import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const mocks = vi.hoisted(() => ({
  listStock: vi.fn(),
  listAdjustments: vi.fn(),
  getAdjustment: vi.fn(),
  listAttachments: vi.fn(),
  saveDraft: vi.fn(),
  post: vi.fn(),
}))

vi.mock('../../../src/shared/config/runtime', async (original) => ({
  ...await original<typeof import('../../../src/shared/config/runtime')>(), backendMode: 'backend',
}))
vi.mock('../../../src/features/feed-stock/api/feedStockApi', () => ({ listFeedStock: mocks.listStock }))
vi.mock('../../../src/features/feed-stock/api/feedStockAdjustmentApi', () => ({
  listFeedStockAdjustments: mocks.listAdjustments,
  getFeedStockAdjustment: mocks.getAdjustment,
  listFeedStockAdjustmentAttachments: mocks.listAttachments,
  saveFeedStockAdjustmentDraft: mocks.saveDraft,
  postFeedStockAdjustment: mocks.post,
}))

import FeedStockAdjustmentPage from '../../../src/features/feed-stock/pages/FeedStockAdjustmentPage'
import FeedStockAdjustmentFormPage from '../../../src/features/feed-stock/pages/FeedStockAdjustmentFormPage'

const stock = [{
  feedItemId: 41, code: 'TA-41', name: 'Cỏ voi', group: 'GREEN_ROUGHAGE' as const, onHandKg: 100,
  minimumStockKg: 10, averageDailyUseKg: 5, daysOfCover: 20, stockValue: 500000, status: 'SUFFICIENT' as const,
  version: 4, nearestLotNumber: null, nearestLotExpiryDate: null, available: true,
}]
const draft = {
  id: 71, code: 'ĐCK-2026-0007', countDate: '2026-11-13', adjustmentType: 'PERIODIC_COUNT', countedBy: 'Linh',
  status: 'DRAFT', totalDifferenceKg: -10, totalValue: -50000, postedAt: null, version: 1,
  lines: [{ feedItemId: 41, feedCode: 'TA-41', feedName: 'Cỏ voi', systemKg: 100, countedKg: 90,
    differenceKg: -10, reason: 'Kiểm kê', unitCost: 5000, differenceValue: -50000 }],
}

function renderRoutes(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/thuc-an" element={<p>Trang tồn kho</p>} />
        <Route path="/thuc-an/kiem-ke/moi" element={<FeedStockAdjustmentFormPage />} />
        <Route path="/thuc-an/kiem-ke/:id" element={<FeedStockAdjustmentFormPage />} />
        <Route path="/thuc-an/kiem-ke" element={<FeedStockAdjustmentPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('SCR-80 backend stock adjustment flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.listStock.mockResolvedValue(stock)
    mocks.listAdjustments.mockResolvedValue([draft])
    mocks.getAdjustment.mockResolvedValue(draft)
    mocks.listAttachments.mockResolvedValue([])
    mocks.saveDraft.mockResolvedValue(draft)
    mocks.post.mockResolvedValue({ ...draft, status: 'POSTED', version: 2 })
  })

  it('uses backend stock, saves a draft, reopens it, updates it, and posts with the current version', async () => {
    const user = userEvent.setup()
    renderRoutes('/thuc-an/kiem-ke/moi')

    expect(await screen.findByText('100 kg')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lưu điều chỉnh' })).toBeEnabled()
    await user.clear(screen.getByLabelText('Số đếm TA-41'))
    await user.type(screen.getByLabelText('Số đếm TA-41'), '90')
    await user.type(screen.getByLabelText('Lý do TA-41'), 'Kiểm kê')
    await user.click(screen.getByRole('button', { name: 'Lưu nháp' }))

    expect(mocks.saveDraft).toHaveBeenCalledWith(expect.objectContaining({
      countDate: expect.any(String), adjustmentType: 'PERIODIC_COUNT',
      lines: [{ feedItemId: 41, countedKg: 90, reason: 'Kiểm kê' }],
    }), expect.objectContaining({ key: expect.any(String) }))
    expect(await screen.findByRole('heading', { name: 'Phiếu kiểm kê / điều chỉnh tồn kho' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Tiếp tục ĐCK-2026-0007' }))
    expect(await screen.findByRole('heading', { name: /Phiếu điều chỉnh kho ĐCK-2026-0007 · Nháp/ })).toBeInTheDocument()
    await user.clear(screen.getByLabelText('Số đếm TA-41'))
    await user.type(screen.getByLabelText('Số đếm TA-41'), '95')
    await user.clear(screen.getByLabelText('Lý do TA-41'))
    await user.type(screen.getByLabelText('Lý do TA-41'), 'Đếm lại')
    await user.click(screen.getByRole('button', { name: 'Lưu nháp' }))
    await screen.findByRole('heading', { name: 'Phiếu kiểm kê / điều chỉnh tồn kho' })

    await user.click(screen.getByRole('button', { name: 'Tiếp tục ĐCK-2026-0007' }))
    await screen.findByRole('heading', { name: /Phiếu điều chỉnh kho ĐCK-2026-0007 · Nháp/ })
    await user.click(screen.getByRole('button', { name: 'Lưu điều chỉnh' }))

    expect(mocks.saveDraft).toHaveBeenLastCalledWith(expect.objectContaining({ id: 71, expectedVersion: 1 }), expect.objectContaining({ key: expect.any(String) }))
    expect(mocks.post).toHaveBeenCalledWith(71, 1, expect.objectContaining({ key: expect.any(String) }))
    expect(await screen.findByText('Trang tồn kho')).toBeInTheDocument()
  })

  it('only creates count lines for active feeds even when stock includes inactive items', async () => {
    const inactive = { ...stock[0], feedItemId: 42, code: 'TA-42', name: 'Cám ngô', available: false }
    mocks.listStock.mockResolvedValue([...stock, inactive])
    const user = userEvent.setup()
    renderRoutes('/thuc-an/kiem-ke/moi')

    expect(await screen.findByLabelText('Số đếm TA-41')).toBeInTheDocument()
    expect(screen.queryByLabelText('Số đếm TA-42')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Lưu nháp' }))

    expect(mocks.saveDraft).toHaveBeenCalledWith(expect.objectContaining({
      lines: [{ feedItemId: 41, countedKg: 100, reason: '' }],
    }), expect.objectContaining({ key: expect.any(String) }))
  })

  it('preserves an inactive line on an existing draft and prevents a lossy update', async () => {
    const inactive = { ...stock[0], feedItemId: 42, code: 'TA-42', name: 'Cám ngô', available: false }
    const draftWithInactiveLine = {
      ...draft,
      lines: [...draft.lines, { feedItemId: 42, feedCode: 'TA-42', feedName: 'Cám ngô', systemKg: 50, countedKg: 45,
        differenceKg: -5, reason: 'Hao hụt', unitCost: 8000, differenceValue: -40000 }],
    }
    mocks.listStock.mockResolvedValue([...stock, inactive])
    mocks.getAdjustment.mockResolvedValue(draftWithInactiveLine)
    renderRoutes('/thuc-an/kiem-ke/71')

    expect(await screen.findByText('Phiếu nháp có mặt hàng đã ngưng hoạt động; dữ liệu được giữ nguyên và phiếu đang ở chế độ chỉ xem.')).toBeInTheDocument()
    expect(screen.getByText('Cám ngô')).toBeInTheDocument()
    expect(screen.queryByLabelText('Số đếm TA-42')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Lưu nháp' })).not.toBeInTheDocument()
    expect(mocks.saveDraft).not.toHaveBeenCalled()
  })
})
