import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFeedMovementApi } from '../../../src/features/feed-stock/api/feedMovementApi'
import { listFeedStock } from '../../../src/features/feed-stock/api/feedStockApi'
import { recordFeedSessionDemo } from '../../../src/features/feed-stock/api/feedFeedingApi'
import { postFeedStockAdjustmentDemo, saveFeedStockAdjustmentDemoDraft } from '../../../src/features/feed-stock/api/feedStockAdjustmentApi'
import { resetFeedReceiptDemoStore } from '../../../src/features/feed-stock/api/feedReceiptApi'
import type { BackendTransport } from '../../../src/api/backendTransport'

const makeTransport = (): BackendTransport => ({
  get: vi.fn(async () => []),
  command: vi.fn(),
  farmPath: vi.fn((farmId, suffix = '') => `/api/farms/${farmId}${suffix}`),
})
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

describe('SCR-77 stock movement history', () => {
  beforeEach(async () => {
    localStorage.clear()
    localStorage.setItem('beefcare:latency', '0')
    await resetFeedReceiptDemoStore()
  })

  it('reads GET /feed/stock/{feedId}/movements in backend mode, newest first, and never uses the demo seed', async () => {
    const transport = makeTransport()
    vi.mocked(transport.get).mockResolvedValueOnce([
      { id: 1, feedItemId: 7, feedCode: 'TA-07', movementType: 'RECEIPT', quantityKg: 50, unitCost: 39000, balanceAfterKg: 68, sourceType: 'RECEIPT', sourceId: 31, occurredAt: '2026-10-22T08:00:00' },
      { id: 2, feedItemId: 7, feedCode: 'TA-07', movementType: 'FEEDING', quantityKg: -2, unitCost: null, balanceAfterKg: 66, sourceType: 'FEEDING', sourceId: null, occurredAt: '2026-10-23T08:00:00' },
    ])
    const api = createFeedMovementApi({ mode: 'backend', farmId: 32, transport })

    const rows = await api.list(7)
    expect(transport.get).toHaveBeenCalledWith('/api/farms/32/feed/stock/7/movements')
    expect(rows.map((row) => row.id)).toEqual([2, 1])
    expect(rows[0]).toMatchObject({ unitCost: null, sourceId: null, balanceAfterKg: 66 })
    expect(await api.updatedAt()).toBeNull()
  })

  it('propagates a backend failure instead of showing demo movements', async () => {
    const transport = makeTransport()
    vi.mocked(transport.get).mockRejectedValueOnce(new Error('backend unavailable'))
    await expect(createFeedMovementApi({ mode: 'backend', farmId: 1, transport }).list(1)).rejects.toThrow('backend unavailable')
  })

  it('seeds every feed with a history that ends exactly at its stock and never goes negative', async () => {
    const api = createFeedMovementApi({ mode: 'local', farmId: 1, transport: makeTransport() })
    for (const stock of await listFeedStock()) {
      const rows = await api.list(stock.feedItemId)
      expect(rows.length).toBeGreaterThan(0)
      expect(rows[0].balanceAfterKg).toBe(stock.onHandKg)
      // Walking back from the newest row, each balance is the previous balance minus the movement.
      for (let index = 0; index < rows.length - 1; index += 1) {
        expect(Math.round((rows[index].balanceAfterKg - rows[index].quantityKg) * 1000) / 1000).toBe(rows[index + 1].balanceAfterKg)
        expect(rows[index + 1].balanceAfterKg).toBeGreaterThanOrEqual(0)
      }
    }
    expect(await api.updatedAt()).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('adds one movement for a feeding session and one for a posted adjustment', async () => {
    const api = createFeedMovementApi({ mode: 'local', farmId: 1, transport: makeTransport() })
    const before = (await api.list(101)).length
    await recordFeedSessionDemo({
      penId: 6, feedingDate: today(), sessionNo: 1, time: '06:30', fedBy: 'Thử', leftoverKg: null, note: '', rationCode: null, rationVersion: null,
      lines: [{ feedItemId: 101, plannedKg: 0, actualKg: 10, inRation: false }],
    })
    let rows = await api.list(101)
    expect(rows).toHaveLength(before + 1)
    expect(rows[0]).toMatchObject({ movementType: 'FEEDING', quantityKg: -10, balanceAfterKg: 1840, sourceType: 'FEEDING' })

    const draft = await saveFeedStockAdjustmentDemoDraft({
      countDate: today(), adjustmentType: 'PERIODIC_COUNT', countedBy: 'Thử',
      lines: (await listFeedStock()).map((row) => ({ feedItemId: row.feedItemId, countedKg: row.feedItemId === 101 ? 1800 : row.onHandKg, reason: 'Hao hụt' })),
    })
    await postFeedStockAdjustmentDemo(draft.id)
    rows = await api.list(101)
    expect(rows[0]).toMatchObject({ movementType: 'ADJUSTMENT', quantityKg: -40, balanceAfterKg: 1800 })
    // Only feeds with a difference get a movement.
    expect((await api.list(102))[0].movementType).not.toBe('ADJUSTMENT')
  })
})
