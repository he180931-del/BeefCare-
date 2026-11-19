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
import { localRationDate, rationCodeDisplay } from '../../../src/features/feed-stock/domain/feedRationForm'
import type { BackendTransport } from '../../../src/api/backendTransport'
import type { FeedRationDemoStore, SaveFeedRationInput } from '../../../src/features/feed-stock/types/feedRation'

const makeTransport = (): BackendTransport => ({
  get: vi.fn(async () => FEED_RATION_MOCK),
  command: vi.fn(),
  farmPath: vi.fn((farmId, suffix = '') => `/api/farms/${farmId}${suffix}`),
})

function input(overrides: Partial<SaveFeedRationInput> = {}): SaveFeedRationInput {
  // Day after tomorrow: tomorrow is already taken by the scheduled KP-02 v2 on pen B1.
  return {
    name: 'Khẩu phần kiểm thử',
    herdGroup: 'FATTENING',
    basis: 'Theo dõi demo',
    effectiveFrom: localRationDate(2),
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

  it('maps server ration fields and saves a version with baseVersion and an idempotency key', async () => {
    const transport = makeTransport()
    const getFeedStock = vi.fn(async () => FEED_STOCK_MOCK)
    const demoStore: FeedRationDemoStore = {
      list: vi.fn(async () => []), get: vi.fn(), saveVersion: vi.fn(), cancelVersion: vi.fn(), stop: vi.fn(), reset: vi.fn(),
    }
    const api = createFeedRationApi({ mode: 'backend', farmId: 32, transport, demoStore, getFeedStock })

    const savedRow = {
      id: 77, rationCode: 'KP-01', version: 0, versionNo: 3, name: 'Khẩu phần mới', herdGroup: 'FATTENING', basis: 'Theo dõi',
      effectiveFrom: input().effectiveFrom, effectiveTo: null, status: 'SCHEDULED', sessionsPerDay: 2, sessionTimes: ['06:30', '16:30'],
      penIds: [4], components: [{ feedItemId: 101, feedCode: 'TA-01', feedName: 'Cỏ', session1Kg: 0.5, session2Kg: 0.4, session3Kg: 0, dailyKg: 0.9, estimatedDailyCost: 1200, outOfStock: false }],
    }
    vi.mocked(transport.command).mockResolvedValueOnce(savedRow)
    const saved = await api.saveVersion(input({ rationCode: 'KP-01', baseVersion: 2 }), { key: 'ration-save-key' })

    expect(saved.sessionTimes).toEqual(['06:30', '16:30'])
    expect(saved.components[0].outOfStock).toBe(false)
    expect(transport.command).toHaveBeenCalledWith('/api/farms/32/feed/rations', expect.objectContaining({
      rationCode: 'KP-01', name: 'Khẩu phần kiểm thử', effectiveFrom: input().effectiveFrom, baseVersion: 2,
      components: input().components,
    }), { key: 'ration-save-key' })
    expect(demoStore.saveVersion).not.toHaveBeenCalled()
    expect(getFeedStock).not.toHaveBeenCalled()
  })

  it('lets the backend assign new ration codes and avoids showing a guessed code', async () => {
    const transport = makeTransport()
    const api = createFeedRationApi({ mode: 'backend', farmId: 32, transport })
    vi.mocked(transport.command).mockResolvedValueOnce({
      id: 78, rationCode: 'KP-03', version: 0, versionNo: 1, name: 'Khẩu phần mới', herdGroup: 'FATTENING', basis: 'Theo dõi',
      effectiveFrom: input().effectiveFrom, effectiveTo: null, status: 'SCHEDULED', sessionsPerDay: 2, sessionTimes: ['06:30', '16:30'],
      penIds: [4], components: [],
    })

    await api.saveVersion(input(), { key: 'ration-create-key' })

    expect(transport.command).toHaveBeenCalledWith('/api/farms/32/feed/rations', expect.objectContaining({ rationCode: null }), { key: 'ration-create-key' })
    expect(rationCodeDisplay(undefined, FEED_RATION_MOCK, true)).toBe('Tự cấp mã khi lưu')
    expect(rationCodeDisplay(undefined, FEED_RATION_MOCK, false)).toBe('KP-07')
  })

  it('sends lifecycle commands with the persisted version token and idempotency key', async () => {
    const transport = makeTransport()
    const api = createFeedRationApi({ mode: 'backend', farmId: 32, transport })
    const result = {
      id: 77, rationCode: 'KP-01', version: 6, versionNo: 3, name: 'Khẩu phần', herdGroup: 'FATTENING', basis: '',
      effectiveFrom: '2027-01-01', effectiveTo: '2027-01-10', status: 'CANCELLED', sessionsPerDay: 1,
      sessionTimes: ['06:30'], penIds: [4], components: [],
    }
    vi.mocked(transport.command).mockResolvedValueOnce(result).mockResolvedValueOnce({ ...result, status: 'EFFECTIVE', effectiveTo: '2026-12-01' })

    await api.cancelVersion(77, 3, 5, { key: 'cancel-key' })
    await api.stop(77, '2026-12-01', 6, { key: 'stop-key' })

    expect(transport.command).toHaveBeenNthCalledWith(1, '/api/farms/32/feed/rations/77/versions/3/cancel', { version: 5 }, { key: 'cancel-key' })
    expect(transport.command).toHaveBeenNthCalledWith(2, '/api/farms/32/feed/rations/77/stop', { endDate: '2026-12-01', version: 6 }, { key: 'stop-key' })
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

  it('cancels only a scheduled version and gives the previous version its open end back (GBR-101)', async () => {
    localStorage.clear()
    localStorage.setItem('beefcare:latency', '0')
    await resetFeedRationDemoStore()
    const api = createFeedRationApi({ mode: 'local', farmId: 1, transport: makeTransport() })
    const rows = await api.list()
    const v1 = rows.find((row) => row.rationCode === 'KP-02' && row.versionNo === 1)!
    const v2 = rows.find((row) => row.rationCode === 'KP-02' && row.versionNo === 2)!
    expect(v1.effectiveTo).not.toBeNull()

    await expect(api.cancelVersion(v1.id, v1.versionNo, v1.version)).rejects.toThrow('chưa có hiệu lực')
    await api.cancelVersion(v2.id, v2.versionNo, v2.version)
    const after = await api.list()
    expect(after.find((row) => row.id === v2.id)).toMatchObject({ status: 'CANCELLED', version: v2.version + 1 })
    expect(after.find((row) => row.id === v1.id)).toMatchObject({ effectiveTo: null, status: 'EFFECTIVE' })
  })

  it('stops an effective ration from tomorrow or later and not before the next version starts', async () => {
    localStorage.clear()
    localStorage.setItem('beefcare:latency', '0')
    await resetFeedRationDemoStore()
    const api = createFeedRationApi({ mode: 'local', farmId: 1, transport: makeTransport() })
    const rows = await api.list()
    const kp03 = rows.find((row) => row.rationCode === 'KP-03')!
    const day = (offset: number) => { const date = new Date(); date.setDate(date.getDate() + offset); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` }

    await expect(api.stop(kp03.id, day(0), kp03.version)).rejects.toThrow('từ ngày mai')
    await expect(api.stop(rows.find((row) => row.rationCode === 'KP-06')!.id, day(5), rows.find((row) => row.rationCode === 'KP-06')!.version)).rejects.toThrow('đang áp dụng')
    const stopped = await api.stop(kp03.id, day(3), kp03.version)
    expect(stopped).toMatchObject({ effectiveTo: day(3), status: 'EFFECTIVE', version: kp03.version + 1 })
    await expect(api.stop(kp03.id, day(4), kp03.version)).rejects.toThrow('đã thay đổi')
  })

  it('replaces a scheduled version in one step and keeps the version number', async () => {
    localStorage.clear()
    localStorage.setItem('beefcare:latency', '0')
    await resetFeedRationDemoStore()
    const rows = await feedRationDemoStore.list()
    const v2 = rows.find((row) => row.rationCode === 'KP-02' && row.versionNo === 2)!
    const saved = await saveFeedRationDemoVersion(input({
      rationCode: 'KP-02', replacesId: v2.id, effectiveFrom: v2.effectiveFrom, penIds: v2.penIds,
      components: [{ feedItemId: 104, session1Kg: 5, session2Kg: 5, session3Kg: 0 }],
    }))
    expect(saved.versionNo).toBe(3)
    const after = await listFeedRations()
    expect(after.filter((row) => row.rationCode === 'KP-02')).toHaveLength(3)
    expect(after.find((row) => row.id === v2.id)).toMatchObject({ status: 'CANCELLED' })
    expect(after.some((row) => row.rationCode === 'KP-02' && row.versionNo === 3)).toBe(true)
    expect(after.find((row) => row.rationCode === 'KP-02' && row.versionNo === 1)?.effectiveTo).toBe(
      (() => { const d = new Date(`${v2.effectiveFrom}T00:00:00`); d.setDate(d.getDate() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })(),
    )
  })

  it('never touches the demo store when a backend lifecycle command fails', async () => {
    const demoStore = { cancelVersion: vi.fn(), stop: vi.fn() } as unknown as FeedRationDemoStore
    const transport = makeTransport()
    vi.mocked(transport.command).mockRejectedValue(new Error('backend unavailable'))
    const api = createFeedRationApi({ mode: 'backend', farmId: 32, transport, demoStore })
    await expect(api.cancelVersion(1, 1, 0)).rejects.toThrow('backend unavailable')
    await expect(api.stop(1, '2030-01-01', 0)).rejects.toThrow('backend unavailable')
    expect(demoStore.cancelVersion).not.toHaveBeenCalled()
    expect(demoStore.stop).not.toHaveBeenCalled()
    expect(transport.command).toHaveBeenCalledTimes(2)
  })
})
