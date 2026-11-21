import { describe, expect, it, vi } from 'vitest'
import { createFeedConsumptionApi } from '../../../src/features/feed-stock/api/feedConsumptionApi'
import type { FeedConsumptionSupportingData } from '../../../src/features/feed-stock/types/feedConsumption'
import type { BackendTransport } from '../../../src/shared/api/backendTransport'

const range = { from: '2026-06-01', to: '2026-06-30' }
const reportPayload = {
  from: range.from, to: range.to, groupBy: 'HERD_GROUP',
  tiles: { kg: 0, cost: 0, averageKgPerHeadDay: 0, averageCostPerHeadDay: 0, days: 0, headDays: 0, receivedKg: 0, receiptCount: 0, receivedAmount: 0 },
  rows: [], total: { kg: 0, cost: 0, kgPerHeadDay: 0, costPerHeadDay: 0, days: 0, headDays: 0 }, costByFeed: [],
  adjustmentLosses: { kg: 0, value: 0 }, rawRows: [], adjustmentLossKg: 0, adjustmentLossValue: 0, generatedAt: '2026-06-30T00:00:00Z',
}
const emptyData: FeedConsumptionSupportingData = {
  feedings: [], receipts: [], adjustments: [], catalogue: [], rations: [],
}

function transport(overrides: Partial<BackendTransport> = {}): BackendTransport {
  return {
    get: vi.fn(async () => []),
    command: vi.fn(async () => reportPayload),
    farmPath: vi.fn((farmId: string | number, suffix = '') => `/api/farms/${farmId}${suffix}`),
    ...overrides,
  }
}

describe('SCR-85 consumption report API boundary', () => {
  it('loads the local demo projection without requesting the backend report', async () => {
    const http = transport()
    const loadDemoData = vi.fn(async () => emptyData)
    const loadBackendData = vi.fn(async () => emptyData)
    const api = createFeedConsumptionApi({ mode: 'local', farmId: 8, transport: http, loadDemoData, loadBackendData })

    const result = await api.load(range)

    expect(result.source).toBe('demo')
    expect(result.backendReport).toBeNull()
    expect(loadDemoData).toHaveBeenCalledOnce()
    expect(loadBackendData).not.toHaveBeenCalled()
    expect(http.command).not.toHaveBeenCalled()
  })

  it('uses the backend report and backend reads without falling back to demo data', async () => {
    const http = transport()
    const loadDemoData = vi.fn(async () => emptyData)
    const loadBackendData = vi.fn(async () => emptyData)
    const api = createFeedConsumptionApi({ mode: 'backend', farmId: 32, transport: http, loadDemoData, loadBackendData })

    const result = await api.load(range)

    expect(result.source).toBe('backend')
    expect(http.command).toHaveBeenCalledWith('/api/farms/32/feed/reports/consumption', { ...range, groupBy: 'HERD_GROUP' }, { method: 'POST' })
    expect(loadBackendData).toHaveBeenCalledOnce()
    expect(loadDemoData).not.toHaveBeenCalled()
  })

  it('keeps backend report errors visible instead of replacing them with local data', async () => {
    const http = transport({ command: vi.fn(async () => { throw new Error('report unavailable') }) })
    const loadDemoData = vi.fn(async () => emptyData)
    const api = createFeedConsumptionApi({ mode: 'backend', farmId: 32, transport: http, loadDemoData, loadBackendData: async () => emptyData })

    await expect(api.load(range)).rejects.toThrow('report unavailable')
    expect(loadDemoData).not.toHaveBeenCalled()
  })
})
