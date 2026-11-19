import { addCalendarDays, businessDate } from '../../../src/shared/lib/date/farmTime'
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
  it('sends backend draft and post commands without touching the demo store', async () => {
    const transport = makeTransport()
    const demoStore: FeedStockAdjustmentDemoStore = {
      list: vi.fn(async () => []),
      get: vi.fn(),
      saveDraft: vi.fn(),
      post: vi.fn(),
      reset: vi.fn(),
    }
    const dto = {
      id: 7, code: 'ĐCK-2026-0007', countDate: '2026-11-13', adjustmentType: 'PERIODIC_COUNT', countedBy: 'Linh',
      status: 'DRAFT', totalDifferenceKg: 0, totalValue: 0, postedAt: null, version: 2, lines: [],
    }
    vi.mocked(transport.command).mockResolvedValue(dto)
    const api = createFeedStockAdjustmentApi({ mode: 'backend', farmId: 32, transport, demoStore })

    await expect(api.saveDraft(input(), { key: 'backend-draft' })).resolves.toMatchObject({ id: 7, status: 'DRAFT' })
    await expect(api.post(7, 2, { key: 'backend-post' })).resolves.toMatchObject({ id: 7, status: 'DRAFT' })
    expect(demoStore.saveDraft).not.toHaveBeenCalled()
    expect(demoStore.post).not.toHaveBeenCalled()
    expect(transport.command).toHaveBeenNthCalledWith(1, '/api/farms/32/feed/adjustments', expect.objectContaining({ postNow: false }), { key: 'backend-draft' })
    expect(transport.command).toHaveBeenNthCalledWith(2, '/api/farms/32/feed/adjustments/7/post', { expectedVersion: 2 }, { key: 'backend-post' })
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

  it('maps the adjustment DTO and sends create, draft update, and post commands with their contract fields', async () => {
    const transport = makeTransport()
    const demoStore: FeedStockAdjustmentDemoStore = {
      list: vi.fn(async () => []), get: vi.fn(), saveDraft: vi.fn(), post: vi.fn(), reset: vi.fn(),
    }
    const dto = {
      id: 7, code: 'ĐCK-2026-0007', countDate: '2026-11-13', adjustmentType: 'PERIODIC_COUNT', countedBy: 'Linh',
      status: 'DRAFT', totalDifferenceKg: -10, totalValue: -120000, postedAt: null, version: 2,
      lines: [{ feedItemId: 101, feedCode: 'TA-01', feedName: 'Cỏ voi', systemKg: 200, countedKg: 190,
        differenceKg: -10, reason: 'Kiểm kê', unitCost: 12000, differenceValue: -120000 }],
    }
    vi.mocked(transport.get).mockResolvedValue([dto])
    vi.mocked(transport.command).mockResolvedValue(dto)
    const api = createFeedStockAdjustmentApi({ mode: 'backend', farmId: 32, transport, demoStore })

    const [listed] = await api.list()
    expect(listed).toMatchObject({
      id: 7, code: 'ĐCK-2026-0007', totalDifferenceKg: -10, version: 2,
      lines: [{ feedItemId: 101, differenceKg: -10, differenceValue: -120000, reason: 'Kiểm kê' }],
    })
    await api.saveDraft(input({ lines: [{ feedItemId: 101, countedKg: 190, reason: 'Kiểm kê' }] }), { key: 'create-adjustment' })
    expect(transport.command).toHaveBeenNthCalledWith(1, '/api/farms/32/feed/adjustments', {
      countDate: input().countDate, adjustmentType: 'PERIODIC_COUNT', countedBy: 'Nhân viên kho', postNow: false,
      lines: [{ feedItemId: 101, countedKg: 190, reason: 'Kiểm kê' }],
    }, { key: 'create-adjustment' })

    await api.saveDraft(input({ id: 7, expectedVersion: 2, lines: [{ feedItemId: 101, countedKg: 190, reason: 'Kiểm kê' }] }), { key: 'update-adjustment' })
    expect(transport.command).toHaveBeenNthCalledWith(2, '/api/farms/32/feed/adjustments/7/draft', {
      expectedVersion: 2, countDate: input().countDate, adjustmentType: 'PERIODIC_COUNT', countedBy: 'Nhân viên kho',
      lines: [{ feedItemId: 101, countedKg: 190, reason: 'Kiểm kê' }],
    }, { method: 'PUT', key: 'update-adjustment' })

    await api.post(7, 3, { key: 'post-adjustment' })
    expect(transport.command).toHaveBeenNthCalledWith(3, '/api/farms/32/feed/adjustments/7/post', { expectedVersion: 3 }, { key: 'post-adjustment' })
    expect(demoStore.saveDraft).not.toHaveBeenCalled()
    expect(demoStore.post).not.toHaveBeenCalled()
  })

  it('retries draft updates and posting with the same idempotency key and version', async () => {
    const transport = makeTransport()
    const draftDto = {
      id: 7, code: 'ĐCK-2026-0007', countDate: '2026-11-13', adjustmentType: 'PERIODIC_COUNT', countedBy: 'Linh',
      status: 'DRAFT', totalDifferenceKg: -10, totalValue: -120000, postedAt: null, version: 3, lines: [],
    }
    const postedDto = { ...draftDto, status: 'POSTED', version: 4, postedAt: '2026-11-13T08:05:00Z' }
    vi.mocked(transport.command)
      .mockRejectedValueOnce(new Error('network timeout'))
      .mockResolvedValueOnce(draftDto)
      .mockRejectedValueOnce(new Error('network timeout'))
      .mockResolvedValueOnce(postedDto)
    const api = createFeedStockAdjustmentApi({ mode: 'backend', farmId: 32, transport })
    const update = input({ id: 7, expectedVersion: 2, lines: [{ feedItemId: 101, countedKg: 190, reason: 'Kiểm kê' }] })

    await expect(api.saveDraft(update, { key: 'retry-update' })).rejects.toThrow('network timeout')
    await expect(api.saveDraft(update, { key: 'retry-update' })).resolves.toMatchObject({ status: 'DRAFT', version: 3 })
    await expect(api.post(7, 3, { key: 'retry-post' })).rejects.toThrow('network timeout')
    await expect(api.post(7, 3, { key: 'retry-post' })).resolves.toMatchObject({ status: 'POSTED', version: 4 })

    expect(transport.command).toHaveBeenNthCalledWith(1, '/api/farms/32/feed/adjustments/7/draft', expect.objectContaining({ expectedVersion: 2 }), { method: 'PUT', key: 'retry-update' })
    expect(transport.command).toHaveBeenNthCalledWith(2, '/api/farms/32/feed/adjustments/7/draft', expect.objectContaining({ expectedVersion: 2 }), { method: 'PUT', key: 'retry-update' })
    expect(transport.command).toHaveBeenNthCalledWith(3, '/api/farms/32/feed/adjustments/7/post', { expectedVersion: 3 }, { key: 'retry-post' })
    expect(transport.command).toHaveBeenNthCalledWith(4, '/api/farms/32/feed/adjustments/7/post', { expectedVersion: 3 }, { key: 'retry-post' })
  })

  it('uses the adjustment attachment routes and preserves the supplied upload retry key', async () => {
    const transport = makeTransport()
    const attachment = { id: 9, contentType: 'application/pdf', fileSize: 5, originalFilename: 'count.pdf', createdAt: '2026-11-13T09:00:00Z' }
    vi.mocked(transport.get).mockResolvedValueOnce([attachment]).mockResolvedValueOnce(new Blob(['%PDF-1.4']))
    vi.mocked(transport.command).mockResolvedValue(attachment)
    const api = createFeedStockAdjustmentApi({ mode: 'backend', farmId: 32, transport })

    expect(await api.attachments(71)).toEqual([attachment])
    const file = new File(['%PDF-1.4'], 'count.pdf', { type: 'application/pdf' })
    expect(await api.uploadAttachment(71, file, { key: 'upload-count' })).toEqual(attachment)
    expect(transport.command).toHaveBeenNthCalledWith(1, '/api/farms/32/feed/adjustments/71/attachments', expect.any(FormData), { key: 'upload-count' })
    expect(await api.removeAttachment(71, 9, { key: 'remove-count' })).toEqual(attachment)
    expect(transport.command).toHaveBeenNthCalledWith(2, '/api/farms/32/feed/adjustments/71/attachments/9', undefined, { method: 'DELETE', key: 'remove-count' })
    expect(await api.downloadAttachment(71, 9)).toBeInstanceOf(Blob)
    expect(transport.get).toHaveBeenLastCalledWith('/api/farms/32/feed/adjustments/71/attachments/9')
  })

  it('keeps an automatically generated upload key through a failed request but gives a later upload a new key', async () => {
    const transport = makeTransport()
    const attachment = { id: 9, contentType: 'application/pdf', fileSize: 5, originalFilename: 'count.pdf', createdAt: '2026-11-13T09:00:00Z' }
    vi.mocked(transport.command).mockRejectedValueOnce(new Error('network timeout')).mockResolvedValue(attachment)
    const api = createFeedStockAdjustmentApi({ mode: 'backend', farmId: 32, transport })
    const file = new File(['%PDF-1.4'], 'count.pdf', { type: 'application/pdf' })

    await expect(api.uploadAttachment(71, file)).rejects.toThrow('network timeout')
    const firstKey = vi.mocked(transport.command).mock.calls[0]?.[2]?.key
    await expect(api.uploadAttachment(71, file)).resolves.toEqual(attachment)
    const retryKey = vi.mocked(transport.command).mock.calls[1]?.[2]?.key
    expect(retryKey).toBe(firstKey)

    await expect(api.uploadAttachment(71, file)).resolves.toEqual(attachment)
    const laterIntentKey = vi.mocked(transport.command).mock.calls[2]?.[2]?.key
    expect(laterIntentKey).toEqual(expect.any(String))
    expect(laterIntentKey).not.toBe(firstKey)
  })

  it('validates dates, non-negative counts and conditional reasons before creating local drafts', async () => {
    await resetFeedStockAdjustmentDemoStore()
    const futureDate = addCalendarDays(businessDate(), 1)
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
