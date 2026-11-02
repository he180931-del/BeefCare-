import { describe, expect, it, vi } from 'vitest'
import {
  createFeedRationApi,
  listFeedRations,
  resetFeedRationDemoStore,
  saveFeedRationDemoVersion,
} from '../../../src/features/feed-stock/api/feedRationApi'
import { listFeedStock } from '../../../src/features/feed-stock/api/feedStockApi'
import { feedRationDemoStore } from '../../../src/features/feed-stock/data/feedRationDemoStore'
import { FEED_STOCK_MOCK } from '../../../src/features/feed-stock/data/feedStockMock'
import { FEED_RATION_MOCK } from '../../../src/features/feed-stock/data/feedRationMock'
import type { BackendTransport } from '../../../src/api/backendTransport'
import type { FeedRationDemoStore, SaveFeedRationInput } from '../../../src/features/feed-stock/types/feedRation'

const makeTransport = (): BackendTransport => ({
  get: vi.fn(async () => FEED_RATION_MOCK),
  command: vi.fn(),
  farmPath: vi.fn((farmId, suffix = '') => `/api/farms/${farmId}${suffix}`),
})

function input(overrides: Partial<SaveFeedRationInput> = {}): SaveFeedRationInput {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return {
    name: 'Khẩu phần kiểm thử',
    herdGroup: 'FATTENING',
    basis: 'Theo dõi demo',
    effectiveFrom: `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`,
    sessionsPerDay: 2,
    sessionTimes: ['06:30', '16:30'],
    penIds: [4],
    components: [{ feedItemId: 101, session1Kg: 0.5, session2Kg: 0.4, session3Kg: 0 }],
    ...overrides,
  }
}

describe('SCR-81/82 ration API boundary and demo store', () => {
  it('reads backend rations and never falls back to local demo after a failure', async () => {
    const transport = makeTransport()
    vi.mocked(transport.get).mockRejectedValueOnce(new Error('backend unavailable'))
    const demoStore: FeedRationDemoStore = {
      list: vi.fn(async () => []), get: vi.fn(), saveVersion: vi.fn(), cancelVersion: vi.fn(), stop: vi.fn(), reset: vi.fn(),
    }
    const api = createFeedRationApi({ mode: 'backend', farmId: 32, transport, demoStore })

    await expect(api.list()).rejects.toThrow('backend unavailable')
    expect(transport.farmPath).toHaveBeenCalledWith(32, '/feed/rations')
    expect(transport.get).toHaveBeenCalledWith('/api/farms/32/feed/rations')
    expect(demoStore.list).not.toHaveBeenCalled()
  })

  it('keeps save-version actions local-only in backend mode', async () => {
    const transport = makeTransport()
    const getFeedStock = vi.fn(async () => FEED_STOCK_MOCK)
    const demoStore: FeedRationDemoStore = {
      list: vi.fn(async () => []), get: vi.fn(), saveVersion: vi.fn(), cancelVersion: vi.fn(), stop: vi.fn(), reset: vi.fn(),
    }
    const api = createFeedRationApi({ mode: 'backend', farmId: 32, transport, demoStore, getFeedStock })

    await expect(api.saveVersion(input())).rejects.toThrow(/bản demo/i)
    expect(demoStore.saveVersion).not.toHaveBeenCalled()
    expect(getFeedStock).not.toHaveBeenCalled()
    expect(transport.command).not.toHaveBeenCalled()
  })

  it('validates future effective date, selected pen, session count and positive component quantity', async () => {
    localStorage.clear()
    localStorage.setItem('beefcare:latency', '0')
    await resetFeedRationDemoStore()

    const today = new Date()
    const todayText = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    await expect(saveFeedRationDemoVersion(input({ effectiveFrom: todayText }))).rejects.toThrow('Ngày áp dụng phải từ ngày mai trở đi.')
    await expect(saveFeedRationDemoVersion(input({ sessionTimes: ['06:30'] }))).rejects.toThrow('Số cữ và thời gian chưa khớp.')
    await expect(saveFeedRationDemoVersion(input({ components: [{ feedItemId: 101, session1Kg: 0, session2Kg: 0, session3Kg: 0 }] })))
      .rejects.toThrow('Mỗi thức ăn cần có ít nhất một cữ lớn hơn 0.')
    await expect(saveFeedRationDemoVersion(input({ penIds: [] }))).rejects.toThrow('Chọn ít nhất một chuồng.')
  })

  it('creates a new immutable version and leaves feed stock unchanged', async () => {
    localStorage.clear()
    localStorage.setItem('beefcare:latency', '0')
    await resetFeedRationDemoStore()
    const beforeStock = await listFeedStock()
    const beforeRows = await listFeedRations()
    const prior = beforeRows.find((row) => row.rationCode === 'KP-01')!
    const next = await saveFeedRationDemoVersion(input({
      rationCode: prior.rationCode,
      name: `${prior.name} – bản mới`,
      penIds: prior.penIds,
      components: [{ feedItemId: 102, session1Kg: 0.5, session2Kg: 0.6, session3Kg: 0 }],
    }))

    expect(next.rationCode).toBe(prior.rationCode)
    expect(next.versionNo).toBe(prior.versionNo + 1)
    expect((await listFeedRations()).find((row) => row.id === prior.id)?.versionNo).toBe(prior.versionNo)
    expect((await listFeedStock()).map((row) => row.onHandKg)).toEqual(beforeStock.map((row) => row.onHandKg))
  })

  it('rejects a partial pen replacement when it would end a shared ration', async () => {
    localStorage.clear()
    localStorage.setItem('beefcare:latency', '0')
    await resetFeedRationDemoStore()
    const prior = (await listFeedRations()).find((row) => row.rationCode === 'KP-01')!

    await expect(saveFeedRationDemoVersion(input({
      rationCode: prior.rationCode,
      penIds: [prior.penIds[0]],
    }))).rejects.toThrow('đang áp dụng cho nhiều chuồng')

    const unchanged = (await listFeedRations()).find((row) => row.id === prior.id)!
    expect(unchanged.effectiveTo).toBeNull()
    expect(unchanged.penIds).toEqual(prior.penIds)
  })

  it('uses the current local stock valuation when saving a ration', async () => {
    localStorage.clear()
    localStorage.setItem('beefcare:latency', '0')
    await resetFeedRationDemoStore()
    const currentStock = FEED_STOCK_MOCK.map((row) => row.feedItemId === 101
      ? { ...row, onHandKg: 100, stockValue: 300_000 }
      : row)
    const getFeedStock = vi.fn(async () => currentStock)
    const api = createFeedRationApi({
      mode: 'local',
      farmId: 32,
      transport: makeTransport(),
      demoStore: feedRationDemoStore,
      getFeedStock,
    })

    const saved = await api.saveVersion(input({
      components: [{ feedItemId: 101, session1Kg: 0.5, session2Kg: 0.4, session3Kg: 0 }],
    }))

    expect(getFeedStock).toHaveBeenCalledOnce()
    expect(saved.components[0].estimatedDailyCost).toBe(2_700)
  })
})
