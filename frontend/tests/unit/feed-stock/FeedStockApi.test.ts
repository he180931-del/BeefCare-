import { describe, expect, it, vi } from 'vitest'
import { createFeedStockApi } from '../../../src/features/feed-stock/api/feedStockApi'
import type { BackendTransport } from '../../../src/api/backendTransport'

const makeTransport = (): BackendTransport => ({
  get: vi.fn(async () => []),
  command: vi.fn(),
  farmPath: vi.fn((farmId, suffix = '') => `/api/farms/${farmId}${suffix}`),
})

describe('SCR-77 backend stock adapter', () => {
  it('maps backend stock projections and catalogue metadata by numeric feed ID', async () => {
    const transport = makeTransport()
    vi.mocked(transport.get)
      .mockResolvedValueOnce([{
        feedItemId: 73, code: 'TA-73', name: 'Cám server', group: 'CONCENTRATE', onHandKg: 500,
        minimumStockKg: null, averageDailyUseKg: 12.5, daysOfCover: 40, stockValue: 600000,
        status: 'SUFFICIENT', version: 4, nearestLotNumber: 'LOT-1', nearestLotExpiryDate: '2027-01-01',
      }])
      .mockResolvedValueOnce([{
        id: 73, code: 'TA-73', name: 'Cám server', feedGroup: 'CONCENTRATE', purchaseUnit: 'bao',
        kgPerPurchaseUnit: 25, stockUnit: 'kg', onHandKg: 500, averageUnitCost: 1200,
        minimumStockKg: null, available: true, version: 4,
      }])

    const api = createFeedStockApi({ mode: 'backend', farmId: 32, transport })

    await expect(api.list()).resolves.toEqual([{
      feedItemId: 73, code: 'TA-73', name: 'Cám server', group: 'CONCENTRATE', onHandKg: 500,
      minimumStockKg: null, averageDailyUseKg: 12.5, daysOfCover: 40, stockValue: 600000,
      status: 'SUFFICIENT', version: 4, nearestLotNumber: 'LOT-1', nearestLotExpiryDate: '2027-01-01',
      available: true, purchaseUnit: 'bao', kgPerPurchaseUnit: 25,
    }])
    expect(transport.get).toHaveBeenNthCalledWith(1, '/api/farms/32/feed/stock')
    expect(transport.get).toHaveBeenNthCalledWith(2, '/api/farms/32/feed/catalogue')
    expect(transport.command).not.toHaveBeenCalled()
  })

  it('propagates backend projection failures without substituting a mock inventory', async () => {
    const transport = makeTransport()
    vi.mocked(transport.get).mockRejectedValueOnce(new Error('backend unavailable'))
    const mockRows = [{ feedItemId: 99, code: 'TA-99', name: 'Demo' }] as never[]
    const api = createFeedStockApi({ mode: 'backend', farmId: 1, transport, mockRows })

    await expect(api.list()).rejects.toThrow('backend unavailable')
    expect(transport.get).toHaveBeenCalledTimes(2)
  })
})
