import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import FeedFeedingPage from '../../../src/features/feed-stock/pages/FeedFeedingPage'
import FeedTodayRationsPage from '../../../src/features/feed-stock/pages/FeedTodayRationsPage'
import type { FeedRation } from '../../../src/features/feed-stock/types/feedRation'
import type { FeedFeedingRecord } from '../../../src/features/feed-stock/types/feedFeeding'
import type { FeedStockRow } from '../../../src/features/feed-stock/types'

const api = vi.hoisted(() => ({
  listFeedFeedingRecords: vi.fn(),
  listFeedRationPens: vi.fn(),
  listFeedRationFeeds: vi.fn(),
  listFeedRations: vi.fn(),
  listFeedStock: vi.fn(),
}))

vi.mock('../../../src/features/feed-stock/api/feedFeedingApi', () => ({ listFeedFeedingRecords: api.listFeedFeedingRecords }))
vi.mock('../../../src/features/feed-stock/api/feedRationApi', () => ({
  listFeedRationFeeds: api.listFeedRationFeeds,
  listFeedRationPens: api.listFeedRationPens,
  listFeedRations: api.listFeedRations,
}))
vi.mock('../../../src/features/feed-stock/api/feedStockApi', () => ({ listFeedStock: api.listFeedStock }))

const dateToday = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const ration = (penId: number, code: string, session1Kg: number, session2Kg: number): FeedRation => ({
  id: penId,
  rationCode: code,
  versionNo: 2,
  name: `${code} khẩu phần`,
  herdGroup: 'BREEDING_FEMALES',
  basis: 'Mock test',
  effectiveFrom: dateToday(),
  effectiveTo: null,
  status: 'EFFECTIVE',
  sessionsPerDay: 2,
  sessionTimes: ['06:30', '16:30'],
  penIds: [penId],
  components: [
    { feedItemId: 101, feedCode: 'TA-01', feedName: 'Cỏ voi', session1Kg, session2Kg, session3Kg: 0, dailyKg: session1Kg + session2Kg, estimatedDailyCost: null },
    { feedItemId: 102, feedCode: 'TA-02', feedName: 'Cám hỗn hợp', session1Kg: 0.1, session2Kg: 0.2, session3Kg: 0, dailyKg: 0.3, estimatedDailyCost: null },
  ],
})

const record: FeedFeedingRecord = {
  id: 44,
  penId: 1,
  penCode: 'A1',
  penName: 'Bò cái',
  feedingDate: dateToday(),
  sessionNo: 1,
  time: '06:38',
  headCount: 12,
  rationVersionId: 1,
  rationCode: 'KP-01',
  rationVersion: 2,
  status: 'VALID',
  version: 1,
  fedBy: 'Nhân viên demo',
  recordedAt: null,
  leftoverKg: null,
  note: null,
  plannedTotalKg: 4.2,
  actualTotalKg: 4.1,
  lines: [],
  revisions: [],
}

const stock = (feedItemId: number, status: FeedStockRow['status'], onHandKg: number): FeedStockRow => ({
  feedItemId,
  code: `TA-${String(feedItemId - 99).padStart(2, '0')}`,
  name: feedItemId === 101 ? 'Cỏ voi' : 'Cám hỗn hợp',
  group: 'GREEN_ROUGHAGE',
  onHandKg,
  minimumStockKg: 5,
  averageDailyUseKg: 10,
  daysOfCover: 1,
  stockValue: 0,
  status,
  version: 1,
  nearestLotNumber: null,
  nearestLotExpiryDate: null,
})

function renderPage() {
  return render(<MemoryRouter><FeedTodayRationsPage /></MemoryRouter>)
}

describe('SCR-86 technician today’s rations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.listFeedRationPens.mockResolvedValue([
      { id: 1, code: 'A1', name: 'Bò cái', headcount: 12, status: 'ACTIVE' },
      { id: 2, code: 'A2', name: 'Bò cái', headcount: 10, status: 'ACTIVE' },
      { id: 3, code: 'A3', name: 'Chuồng trống', headcount: 0, status: 'ACTIVE' },
    ])
    api.listFeedRations.mockResolvedValue([ration(1, 'KP-01', 0.25, 0.15), ration(2, 'KP-02', 0.2, 0.1)])
    api.listFeedFeedingRecords.mockResolvedValue([record])
    api.listFeedRationFeeds.mockResolvedValue([stock(101, 'SUFFICIENT', 70), stock(102, 'OUT_OF_STOCK', 0)])
    api.listFeedStock.mockResolvedValue([stock(101, 'SUFFICIENT', 70), stock(102, 'OUT_OF_STOCK', 0)])
  })

  it('shows today, per-pen planned quantities, stock shortage, and recorded time as read-only', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Khẩu phần hôm nay' })).toBeInTheDocument()
    expect(screen.getAllByText('2 chuồng')).toHaveLength(2)
    expect(screen.getByText('A1 · Bò cái')).toBeInTheDocument()
    expect(screen.getByText(/KP-01 v2/)).toBeInTheDocument()
    expect(screen.getByText('Đã ghi 06:38')).toBeInTheDocument()
    const firstPen = screen.getAllByRole('article')[0]
    expect(within(firstPen).getByText('3 kg')).toBeInTheDocument()
    expect(within(firstPen).getByText('4,2 kg')).toBeInTheDocument()
    expect(screen.getAllByText('Hết kho')).toHaveLength(2)
    expect(screen.getByText(/Quản lý ghi nhận cữ cho ăn/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ghi cữ cho ăn' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ghi cữ' })).not.toBeInTheDocument()

    const logLink = screen.getByRole('link', { name: /Nhật ký cho ăn/ })
    expect(logLink).toHaveAttribute('href', `/thuc-an/nhat-ky?date=${dateToday()}&readOnly=1`)
  })

  it('switches session and recalculates the plan from the selected session quantities', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Khẩu phần hôm nay' })
    fireEvent.click(screen.getByRole('tab', { name: /Cữ chiều/ }))

    expect(screen.getByRole('tab', { name: /Cữ chiều/ })).toHaveAttribute('aria-selected', 'true')
    const [firstPen, secondPen] = screen.getAllByRole('article')
    expect(within(firstPen).getByText('1,8 kg')).toBeInTheDocument()
    expect(within(firstPen).getByText('4,2 kg')).toBeInTheDocument()
    expect(within(secondPen).getByText('2 kg')).toBeInTheDocument()
    expect(within(secondPen).getByText('3 kg')).toBeInTheDocument()
  })

  it('opens SCR-83 with the linked date in technician read-only mode', async () => {
    render(<MemoryRouter initialEntries={[`/thuc-an/nhat-ky?date=${dateToday()}&readOnly=1`]}><FeedFeedingPage /></MemoryRouter>)

    expect(await screen.findByRole('tabpanel', { name: 'Nhật ký cho ăn' })).toBeInTheDocument()
    expect(screen.getByLabelText('Ngày')).toHaveValue(dateToday())
    expect(screen.getByText(/Chế độ chỉ xem dành cho Kỹ thuật viên/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ghi cữ cho ăn' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ghi cữ' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sửa cữ' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Hủy cữ' })).not.toBeInTheDocument()
  })
})
