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
import type { BackendTransport } from '../../../src/api/backendTransport'
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
    penId: 1,
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

describe('SCR-83 feeding log boundary and local demo store', () => {
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

  it('keeps every feeding mutation out of backend mode', async () => {
    const transport = makeTransport()
    const demoStore: FeedFeedingDemoStore = {
      list: vi.fn(async () => []), record: vi.fn(), correct: vi.fn(), voidRecord: vi.fn(), reset: vi.fn(),
    }
    const api = createFeedFeedingApi({ mode: 'backend', farmId: 32, transport, demoStore })

    await expect(api.record(input())).rejects.toThrow('bản demo')
    await expect(api.correct(1, { reason: 'Điều chỉnh số đã cân', lines: input().lines })).rejects.toThrow('bản demo')
    await expect(api.voidRecord(1, 'Ghi nhầm cữ')).rejects.toThrow('bản demo')
    expect(demoStore.record).not.toHaveBeenCalled()
    expect(demoStore.correct).not.toHaveBeenCalled()
    expect(demoStore.voidRecord).not.toHaveBeenCalled()
    expect(transport.command).not.toHaveBeenCalled()
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
    expect(await listFeedFeedingRecords({ from: today(), to: today() })).toHaveLength(1)
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

    expect(await listFeedFeedingRecords({ from: today(), to: today() })).toHaveLength(0)
    expect((await listFeedStock()).find((row) => row.feedItemId === 101)!.onHandKg).toBe(before)
  })
})
