import { describe, expect, it, vi } from 'vitest'
import {
  createFeedStockAdjustmentApi,
  postFeedStockAdjustmentDemo,
  resetFeedStockAdjustmentDemoStore,
  saveFeedStockAdjustmentDemoDraft,
} from '../../../src/features/feed-stock/api/feedStockAdjustmentApi'
import { listFeedStock } from '../../../src/features/feed-stock/api/feedStockApi'
import { FEED_STOCK_MOCK } from '../../../src/features/feed-stock/data/feedStockMock'
import type { BackendTransport } from '../../../src/api/backendTransport'
import type { FeedStockAdjustmentDemoStore, FeedStockAdjustmentDraftInput } from '../../../src/features/feed-stock/types/feedStockAdjustment'

const makeTransport = (): BackendTransport => ({
  get: vi.fn(async () => []),
  command: vi.fn(),
  farmPath: vi.fn((farmId, suffix = '') => `/api/farms/${farmId}${suffix}`),
})

function input(overrides: Partial<FeedStockAdjustmentDraftInput> = {}): FeedStockAdjustmentDraftInput {
  return {
    countDate: new Date().toISOString().slice(0, 10),
    adjustmentType: 'PERIODIC_COUNT',
    countedBy: 'Nhân viên kho',
    lines: [
      { feedItemId: 101, countedKg: 1860, reason: 'Đếm thực tế' },
      { feedItemId: 106, countedKg: 10, reason: 'Hao hụt' },
      { feedItemId: 108, countedKg: 0, reason: '' },
    ],
    ...overrides,
  }
}

describe('SCR-80 stock adjustment data boundary', () => {
  it('keeps local draft and post actions out of backend mode', async () => {
    const transport = makeTransport()
    const demoStore: FeedStockAdjustmentDemoStore = {
      list: vi.fn(async () => []),
      get: vi.fn(),
      saveDraft: vi.fn(),
      post: vi.fn(),
      reset: vi.fn(),
    }
    const api = createFeedStockAdjustmentApi({ mode: 'backend', farmId: 32, transport, demoStore })

    await expect(api.saveDraft(input())).rejects.toThrow(/bản demo/i)
    await expect(api.post(1)).rejects.toThrow(/bản demo/i)
    expect(demoStore.saveDraft).not.toHaveBeenCalled()
    expect(demoStore.post).not.toHaveBeenCalled()
    expect(transport.command).not.toHaveBeenCalled()
  })

  it('reads backend adjustments without silently falling back to local records', async () => {
    const transport = makeTransport()
    vi.mocked(transport.get).mockRejectedValueOnce(new Error('backend unavailable'))
    const demoStore: FeedStockAdjustmentDemoStore = {
      list: vi.fn(async () => []), get: vi.fn(), saveDraft: vi.fn(), post: vi.fn(), reset: vi.fn(),
    }
    const api = createFeedStockAdjustmentApi({ mode: 'backend', farmId: 32, transport, demoStore })

    await expect(api.list()).rejects.toThrow('backend unavailable')
    expect(transport.farmPath).toHaveBeenCalledWith(32, '/feed/adjustments')
    expect(transport.get).toHaveBeenCalledWith('/api/farms/32/feed/adjustments')
    expect(demoStore.list).not.toHaveBeenCalled()
  })

  it('validates dates, non-negative counts and conditional reasons before creating local drafts', async () => {
    await resetFeedStockAdjustmentDemoStore()
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const futureDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`
    await expect(saveFeedStockAdjustmentDemoDraft(input({ countDate: futureDate }))).rejects.toThrow('Ngày kiểm kê không được ở tương lai.')
    const invalidCount = input({ lines: [{ feedItemId: 101, countedKg: -1, reason: 'Sai số' }] })
    await expect(saveFeedStockAdjustmentDemoDraft(invalidCount)).rejects.toThrow('Số đếm của TA-01 phải là số không âm.')
    const missingReason = input({ lines: [{ feedItemId: 101, countedKg: 1860, reason: '' }] })
    await expect(saveFeedStockAdjustmentDemoDraft(missingReason)).rejects.toThrow('Nhập lý do chênh lệch cho TA-01.')
    expect((await createFeedStockAdjustmentApi({ mode: 'local', farmId: 1, transport: makeTransport() }).list())).toHaveLength(0)
  })

  it('persists local draft then posts one increase and one decrease exactly once', async () => {
    await resetFeedStockAdjustmentDemoStore()
    const before = await listFeedStock()
    const draft = await saveFeedStockAdjustmentDemoDraft(input())
    expect((await listFeedStock()).map(({ onHandKg }) => onHandKg)).toEqual(before.map(({ onHandKg }) => onHandKg))

    const outcomes = await Promise.allSettled([
      postFeedStockAdjustmentDemo(draft.id),
      postFeedStockAdjustmentDemo(draft.id),
    ])
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1)
    const after = await listFeedStock()
    expect(after.find((row) => row.feedItemId === 101)?.onHandKg).toBe(FEED_STOCK_MOCK[0].onHandKg + 10)
    expect(after.find((row) => row.feedItemId === 106)?.onHandKg).toBe(FEED_STOCK_MOCK[5].onHandKg - 20)
  })
})
