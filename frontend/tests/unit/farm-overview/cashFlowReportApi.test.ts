import { describe, expect, it, vi } from 'vitest'
import type { BackendTransport } from '../../../src/shared/api/backendTransport'
import { createCashFlowReportApi } from '../../../src/features/farm-overview/api/cashFlowReportApi'

describe('farm cash flow API adapter', () => {
  it('uses the selected farm and sends only applied filters to the dedicated GET endpoint', async () => {
    const transport = {
      farmPath: vi.fn((_farmId: number | string | null, suffix: string) => `/api/farms/7${suffix}`),
      get: vi.fn().mockResolvedValue({
        generatedAt: '2026-11-26T05:00:00Z', totalIncome: 8000, totalExpense: 1000, netCashFlow: 7000, totalElements: 0, items: [],
      }),
    } as unknown as BackendTransport
    const api = createCashFlowReportApi({ farmId: 7, transport })

    const result = await api.getReport({ from: '2026-11-01', to: '2026-11-26', source: 'FEED_RECEIPT', direction: 'OUT', page: 2, size: 20 })

    expect(transport.farmPath).toHaveBeenCalledWith(7, expect.stringContaining('/dashboard/cash-flow?'))
    const requestPath = (transport.farmPath as ReturnType<typeof vi.fn>).mock.calls[0][1]
    expect(requestPath).toContain('from=2026-11-01')
    expect(requestPath).toContain('to=2026-11-26')
    expect(requestPath).toContain('source=FEED_RECEIPT')
    expect(requestPath).toContain('direction=OUT')
    expect(requestPath).toContain('page=2')
    expect(requestPath).toContain('size=20')
    expect(transport.get).toHaveBeenCalledWith('/api/farms/7/dashboard/cash-flow?from=2026-11-01&to=2026-11-26&source=FEED_RECEIPT&direction=OUT&page=2&size=20')
    expect(result.totalIncome).toBe(8000)
  })
})
