import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import FeedConsumptionReportPage from '../../../src/features/feed-stock/pages/FeedConsumptionReportPage'
import { SessionContext, type Session } from '../../../src/app/session/sessionContext'
import { useFeedConsumptionReport } from '../../../src/features/feed-stock/hooks/useFeedConsumptionReport'
import type { FeedConsumptionBackendReport, FeedConsumptionServerRow } from '../../../src/features/feed-stock/types/feedConsumption'

vi.mock('../../../src/features/feed-stock/hooks/useFeedConsumptionReport', () => ({ useFeedConsumptionReport: vi.fn() }))

const useReportMock = vi.mocked(useFeedConsumptionReport)
const session: Session = { role: 'MANAGER', fullName: 'Quản lý', email: 'manager@example.test', farmId: 1, farmName: 'Trại kiểm thử', logout: async () => undefined }

const report: FeedConsumptionBackendReport = {
  from: '2026-11-01', to: '2026-11-15', groupBy: 'FEED',
  tiles: { kg: 123, cost: 456000, averageKgPerHeadDay: 1.2, averageCostPerHeadDay: 4560, days: 15, headDays: 100, receivedKg: 200, receiptCount: 2, receivedAmount: 5000000 },
  rows: [{ group: 'TA-01', avgHead: 8, kg: 20, kgPerHeadDay: 2.5, cost: 2000, costPerHeadDay: 250, variancePct: 0.1, notes: ['Server note: kiểm tra khẩu phần'] }],
  total: { kg: 20, cost: 2000, kgPerHeadDay: 2.5, costPerHeadDay: 250, days: 15, headDays: 120 },
  costByFeed: [{ feedCode: 'TA-01', feedName: 'Cỏ voi', kg: 20, cost: 2000 }],
  adjustmentLosses: { kg: 12, value: 150000 }, rawRows: [{ penId: 1, penCode: 'C-01', herdGroup: 'FATTENING', feedItemId: 101, feedCode: 'TA-01', plannedKg: 18, actualKg: 20, varianceRatio: 0.1, totalCost: 2000 }],
  adjustmentLossKg: 12, adjustmentLossValue: 150000, generatedAt: '2026-11-15T17:00:00Z',
}

const serverRow: FeedConsumptionServerRow = { key: 'FEED:TA-01', label: 'Cỏ voi', herdGroup: null, averageHead: 8, actualKg: 20, averageKgPerHeadDay: 2.5, totalCost: 2000, averageCostPerHeadDay: 250, varianceRatio: 0.1, notes: ['Server note: kiểm tra khẩu phần'] }

function hookValue(overrides: Partial<ReturnType<typeof useFeedConsumptionReport>> = {}) {
  return {
    from: report.from, to: report.to, setFrom: vi.fn(), setTo: vi.fn(), groupBy: 'FEED' as const, setGroupBy: vi.fn(),
    groupOptions: [{ value: 'FEED' as const, label: 'Theo thức ăn', title: 'Theo thức ăn', column: 'Thức ăn' }], validPeriod: true,
    loaded: { source: 'backend' as const, backendReport: report, feedings: [], receipts: [], adjustments: [], catalogue: [], rations: [] }, backendReport: report, projection: null,
    summary: { actualKg: 123, plannedKg: 0, cost: 456000, days: 15, headDays: 100, averageKgPerHeadDay: 1.2, averageCostPerHeadDay: 4560, receivedKg: 200, receiptCount: 2, receivedAmount: 5000000, receivedAmountIsGoodsOnly: false },
    days: 15, rows: [serverRow], feedBars: [{ key: 'TA-01', label: 'Cỏ voi', kg: 20, totalCost: 2000 }], maxCost: 2000, option: { value: 'FEED' as const, label: 'Theo thức ăn', title: 'Theo thức ăn', column: 'Thức ăn' }, reasonFor: vi.fn(), loading: false, errorMessage: null, refetch: vi.fn(), mayLackSources: false,
    ...overrides,
  } as ReturnType<typeof useFeedConsumptionReport>
}

function renderPage() {
  return render(<SessionContext.Provider value={session}><MemoryRouter><FeedConsumptionReportPage /></MemoryRouter></SessionContext.Provider>)
}

describe('SCR-85 consumption report presentation and print output', () => {
  beforeEach(() => {
    useReportMock.mockReturnValue(hookValue())
    vi.spyOn(window, 'print').mockImplementation(() => undefined)
  })

  it('renders a trusted print masthead, server notes and authoritative totals', () => {
    renderPage()
    const masthead = document.querySelector('header[aria-label="Đầu trang báo cáo in"]') as HTMLElement
    expect(masthead).toBeTruthy()
    expect(within(masthead).getByText('Trại kiểm thử')).toBeInTheDocument()
    expect(within(masthead).getByText('01/11/2026 – 15/11/2026')).toBeInTheDocument()
    expect(within(masthead).getByText('Theo thức ăn')).toBeInTheDocument()
    expect(within(masthead).getByText('16/11/2026 00:00 (UTC+07:00)')).toBeInTheDocument()

    expect(screen.getByRole('columnheader', { name: 'Chênh lệch so khẩu phần (%)' })).toBeInTheDocument()
    expect(screen.getByText('+10,0%')).toBeInTheDocument()
    expect(screen.getByText('Server note: kiểm tra khẩu phần')).toBeInTheDocument()
    expect(screen.getByText('Hao hụt điều chỉnh')).toBeInTheDocument()
    expect(screen.getAllByText('12 kg')).toHaveLength(2)
    expect(screen.getAllByText('150.000 đ')).toHaveLength(2)
    expect(screen.getByText('Tổng máy chủ')).toBeInTheDocument()
    const totalRow = screen.getByText('Tổng máy chủ').closest('tr')
    expect(totalRow).toBeTruthy()
    expect(within(totalRow as HTMLElement).getByText('20 kg')).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader', { name: 'Chi phí (VND)' })).toHaveLength(2)
    expect(screen.getByText('Điều chỉnh kho đã ghi sổ')).toBeInTheDocument()
  })

  it('keeps print controls and CSS print rules explicit', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => undefined)
    renderPage()
    screen.getByRole('button', { name: /In báo cáo/ }).click()
    expect(printSpy).toHaveBeenCalledOnce()
    const css = [...document.querySelectorAll('style')].map((node) => node.textContent).join('\n')
    expect(css).toContain('@page beefcare-feed-report { size: A4 portrait; margin: 0; }')
    expect(css).toContain('padding: 14mm !important')
    expect(css).toContain('box-decoration-break: clone')
    expect(document.querySelector('.feed-report-print')).toHaveClass('print-layout-root')
    expect(css).toContain('table-header-group')
    expect(css).toContain('table-footer-group')
    expect(css).toContain('overflow: visible')
    expect(document.querySelector('header[aria-label="Đầu trang báo cáo in"]')).toHaveClass('print-only')
    expect(screen.getByRole('button', { name: /In báo cáo/ }).closest('.no-print')).not.toBeNull()
  })

  it('shows the no VALID feeding record state without an empty report table', () => {
    useReportMock.mockReturnValue(hookValue({
      backendReport: { ...report, rows: [], rawRows: [], total: { ...report.total, kg: 0, cost: 0, headDays: 0 }, tiles: { ...report.tiles, kg: 0, cost: 0, headDays: 0 } },
      loaded: { source: 'backend', backendReport: null, feedings: [], receipts: [], adjustments: [], catalogue: [], rations: [] },
      rows: [], feedBars: [], summary: { ...hookValue().summary!, actualKg: 0, cost: 0, headDays: 0 },
    }))
    renderPage()
    expect(screen.getByText('Không có bản ghi cho ăn VALID trong khoảng thời gian này.')).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Chênh lệch so khẩu phần (%)' })).not.toBeInTheDocument()
  })
})
