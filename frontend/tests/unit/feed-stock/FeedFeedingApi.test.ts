import { describe, expect, it, vi } from 'vitest'
import {
  createFeedFeedingApi,
  listFeedFeedingRecords,
  recordFeedSessionDemo,
  correctFeedSessionDemo,
  voidFeedSessionDemo,
} from '../../../src/features/feed-stock/api/feedFeedingApi'
import { listFeedStock } from '../../../src/features/feed-stock/api/feedStockApi'
import { resetFeedReceiptDemoStore } from '../../../src/features/feed-stock/api/feedReceiptApi'
import type { BackendTransport } from '../../../src/shared/api/backendTransport'
import type { FeedFeedingDemoStore, FeedFeedingDraftInput } from '../../../src/features/feed-stock/types/feedFeeding'

const makeTransport = (): BackendTransport => ({
  get: vi.fn(async () => []),
  command: vi.fn(),
  farmPath: vi.fn((farmId, suffix = '') => `/api/farms/${farmId}${suffix}`),
})

const today = () => {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function input(overrides: Partial<FeedFeedingDraftInput> = {}): FeedFeedingDraftInput {
  return {
    // C1 has no seeded session today; A1 to B2 already have their morning feeding.
    penId: 6,
    feedingDate: today(),
    sessionNo: 1,
    time: '06:30',
    fedBy: 'Nhân viên demo',
    leftoverKg: null,
    note: '',
    rationCode: null,
    rationVersion: null,
    lines: [{ feedItemId: 101, plannedKg: 5, actualKg: 2, inRation: true }],
    ...overrides,
  }
}

describe('SCR-83 feeding API boundary and local demo store', () => {
  it('reads the backend interval and never falls back to demo after a failure', async () => {
    const transport = makeTransport()
    vi.mocked(transport.get).mockRejectedValueOnce(new Error('backend unavailable'))
    const date = today()
    const demoStore: FeedFeedingDemoStore = {
      list: vi.fn(async () => []), record: vi.fn(), correct: vi.fn(), voidRecord: vi.fn(), reset: vi.fn(),
    }
    const api = createFeedFeedingApi({ mode: 'backend', farmId: 32, transport, demoStore })

    await expect(api.list({ from: date, to: date })).rejects.toThrow('backend unavailable')
    expect(transport.get).toHaveBeenCalledWith(`/api/farms/32/feed/feeding-records?from=${date}&to=${date}`)
    expect(demoStore.list).not.toHaveBeenCalled()
  })

  it('reads the server plan, then posts, corrects and voids through versioned idempotent commands', async () => {
    const transport = makeTransport()
    const result = {
      id: 77, penId: 6, penCode: 'C1', penName: 'Chuồng C1', feedingDate: today(), sessionNo: 1,
      time: '06:30:00', headCount: 12, status: 'VALID', version: 0, rationVersionId: 5, rationCode: 'KP-01', rationVersion: 2,
      fedBy: 'Nhân viên demo', recordedBy: 'Quản lý', recordedAt: '2026-11-15T01:00:00Z', leftoverKg: 1, note: 'Ghi chú', voidReason: null,
      plannedTotalKg: 6, actualTotalKg: 5, lines: [{ feedItemId: 101, feedCode: 'TA-01', feedName: 'Cỏ', plannedKg: 6, actualKg: 5, inRation: true, unitCost: 2, totalCost: 10 }], revisions: [],
    }
    vi.mocked(transport.get).mockResolvedValueOnce({
      penId: 6, penCode: 'C1', feedingDate: today(), sessionNo: 1, feedingTime: '06:30:00',
      ration: { id: 5, rationCode: 'KP-01', versionNo: 2, name: 'Tăng trọng', sessionsPerDay: 2 }, headCount: 12,
      lines: [{ feedItemId: 101, feedCode: 'TA-01', feedName: 'Cỏ', kgPerHead: 0.5, plannedKg: 6, stockKg: 40, available: true }], existingRecordId: null,
    })
    vi.mocked(transport.command).mockResolvedValue(result)
    const demoStore: FeedFeedingDemoStore = {
      list: vi.fn(async () => []), record: vi.fn(), correct: vi.fn(), voidRecord: vi.fn(), reset: vi.fn(),
    }
    const api = createFeedFeedingApi({ mode: 'backend', farmId: 32, transport, demoStore })

    const plan = await api.plan({ penId: 6, date: today(), sessionNo: 1 })
    expect(plan.lines[0]).toMatchObject({ feedItemId: 101, plannedKg: 6, stockKg: 40 })
    expect(transport.get).toHaveBeenCalledWith(`/api/farms/32/feed/feeding-records/plan?penId=6&date=${today()}&session=1`)

    await api.record(input(), { key: 'create-key' })
    await api.correct(77, { expectedVersion: 0, reason: 'Đã cân lại lượng thức ăn', lines: input().lines }, { key: 'correct-key' })
    await api.voidRecord(77, 'Ghi nhầm cữ', 1, { key: 'void-key' })
    await api.record(input({ note: '  Hết cỏ khô, chờ nhập hàng  ' }), { key: 'stock-note-key' })

    expect(transport.command).toHaveBeenNthCalledWith(1, '/api/farms/32/feed/feeding-records', {
      penId: 6, feedingDate: today(), sessionNo: 1, feedingTime: '06:30', fedBy: 'Nhân viên demo', leftoverKg: null, note: null,
      lines: [{ feedItemId: 101, actualKg: 2 }],
    }, { key: 'create-key' })
    expect(transport.command).toHaveBeenNthCalledWith(2, '/api/farms/32/feed/feeding-records/77/correct', {
      expectedVersion: 0, reason: 'Đã cân lại lượng thức ăn', fedBy: null, lines: [{ feedItemId: 101, actualKg: 2 }],
    }, { key: 'correct-key' })
    expect(transport.command).toHaveBeenNthCalledWith(3, '/api/farms/32/feed/feeding-records/77/void', { reason: 'Ghi nhầm cữ', expectedVersion: 1 }, { key: 'void-key' })
    expect(transport.command).toHaveBeenNthCalledWith(4, '/api/farms/32/feed/feeding-records', {
      penId: 6, feedingDate: today(), sessionNo: 1, feedingTime: '06:30', fedBy: 'Nhân viên demo', leftoverKg: null,
      note: 'Hết cỏ khô, chờ nhập hàng', lines: [{ feedItemId: 101, actualKg: 2 }],
    }, { key: 'stock-note-key' })
    expect(demoStore.record).not.toHaveBeenCalled()
    expect(demoStore.correct).not.toHaveBeenCalled()
    expect(demoStore.voidRecord).not.toHaveBeenCalled()
  })

  it('records, corrects and voids a session with one stock adjustment per action', async () => {
    localStorage.clear()
    localStorage.setItem('beefcare:latency', '0')
    await resetFeedReceiptDemoStore()
    const before = (await listFeedStock()).find((row) => row.feedItemId === 101)!.onHandKg

    const record = await recordFeedSessionDemo(input())
    expect((await listFeedStock()).find((row) => row.feedItemId === 101)!.onHandKg).toBe(before - 2)
    const corrected = await correctFeedSessionDemo(record.id, {
      reason: 'Đã cân lại lượng thức ăn',
      lines: [{ feedItemId: 101, plannedKg: 5, actualKg: 3, inRation: true }],
    })
    expect(corrected.status).toBe('VALID')
    expect(corrected.revisions).toHaveLength(1)
    expect((await listFeedStock()).find((row) => row.feedItemId === 101)!.onHandKg).toBe(before - 3)

    const voided = await voidFeedSessionDemo(record.id, 'Chọn nhầm chuồng')
    expect(voided.status).toBe('VOIDED')
    expect(voided.revisions).toHaveLength(2)
    expect((await listFeedStock()).find((row) => row.feedItemId === 101)!.onHandKg).toBe(before)
    await expect(voidFeedSessionDemo(record.id, 'Hủy lần nữa')).rejects.toThrow()
    expect((await listFeedStock()).find((row) => row.feedItemId === 101)!.onHandKg).toBe(before)
  })

  it('serializes duplicate submits so only one valid session deducts stock', async () => {
    localStorage.clear()
    localStorage.setItem('beefcare:latency', '0')
    await resetFeedReceiptDemoStore()
    const before = (await listFeedStock()).find((row) => row.feedItemId === 101)!.onHandKg

    const outcomes = await Promise.allSettled([recordFeedSessionDemo(input()), recordFeedSessionDemo(input())])

    expect(outcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect((await listFeedFeedingRecords({ from: today(), to: today() })).filter((record) => record.penId === 6)).toHaveLength(1)
    expect((await listFeedStock()).find((row) => row.feedItemId === 101)!.onHandKg).toBe(before - 2)
  })

  it('does not save a record or change stock when validation fails', async () => {
    localStorage.clear()
    localStorage.setItem('beefcare:latency', '0')
    await resetFeedReceiptDemoStore()
    const before = (await listFeedStock()).find((row) => row.feedItemId === 101)!.onHandKg

    await expect(recordFeedSessionDemo(input({ lines: [{ feedItemId: 101, plannedKg: 0, actualKg: before + 1, inRation: false }] })))
      .rejects.toThrow(/không đủ tồn kho/i)
    await expect(recordFeedSessionDemo(input({ lines: [{ feedItemId: 101, plannedKg: 0, actualKg: -1, inRation: false }] })))
      .rejects.toThrow('không âm')

    expect((await listFeedFeedingRecords({ from: today(), to: today() })).filter((record) => record.penId === 6)).toHaveLength(0)
    expect((await listFeedStock()).find((row) => row.feedItemId === 101)!.onHandKg).toBe(before)
  })
})
