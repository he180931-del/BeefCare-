import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import ReportResult from '../../../src/features/farm-overview/components/ReportResult'
import type { ReportView } from '../../../src/features/farm-overview/types'

const report: ReportView = {
  reportType: 'RPT-03', title: 'Tuân thủ tiêm phòng', from: '2026-10-01', to: '2026-10-31',
  generatedAt: '2026-11-14T04:00:00Z', scope: '2026-10-01 – 2026-10-31', tiles: [],
  columns: [], rows: [], totalRow: null, chart: null, unavailableData: [],
  sections: [{
    key: 'schedule', title: 'Tuân thủ theo lịch tiêm', rowHeading: 'Lịch tiêm',
    columns: [{ key: 'done', label: 'Đã tiêm' }],
    rows: [{ label: 'Lịch A', cells: { done: '0' } }],
    totalRow: { label: 'Tổng (mũi)', cells: { done: '0' } },
  }],
  charts: [{
    title: 'Mũi đã tiêm theo lịch', sub: 'Số mũi đã hoàn tất', unit: 'mũi',
    bars: [{ label: 'Lịch A', value: 0, sampleSize: null }],
  }],
}

describe('report sections and charts', () => {
  it('renders section totals and chart values with the supplied unit', () => {
    render(<ReportResult report={report} />)

    expect(screen.getByRole('heading', { name: /Tuân thủ theo lịch tiêm/ })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Lịch tiêm' })).toBeInTheDocument()
    expect(screen.getByText('Tổng (mũi)')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Mũi đã tiêm theo lịch/ })).toBeInTheDocument()
    expect(screen.getByText('0 mũi')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Lịch A: 0 mũi' })).toBeInTheDocument()
  })

  it('labels total feed separately from the feed used in eligible-cattle ratios', () => {
    const fattening: ReportView = {
      ...report,
      reportType: 'RPT-07',
      sections: [{
        key: 'fatteningByPen', title: 'Hiệu quả vỗ béo theo chuồng', rowHeading: 'Chuồng',
        columns: [
          { key: 'feedKg', label: 'Thức ăn đã dùng (kg)' },
          { key: 'feedKgForIncluded', label: 'Thức ăn tính tỷ lệ (bò đủ cân, kg)' },
        ],
        rows: [{ label: 'Chuồng P1', cells: { feedKg: '40', feedKgForIncluded: '20' } }],
        totalRow: { label: 'Tổng', cells: { feedKg: '40', feedKgForIncluded: '20' } },
      }],
      charts: [],
    }
    render(<ReportResult report={fattening} />)

    expect(screen.getByRole('columnheader', { name: 'Thức ăn đã dùng (kg)' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Thức ăn tính tỷ lệ (bò đủ cân, kg)' })).toBeInTheDocument()
    expect(screen.getAllByText('40')).toHaveLength(2)
    expect(screen.getAllByText('20')).toHaveLength(2)
  })
})

const bentoView = (tiles: ReportView['tiles']): ReportView => ({
  reportType: 'RPT-05', title: 'Báo cáo', from: '2026-10-22', to: '2026-11-20', generatedAt: '2026-11-20T13:00:00Z', timeZone: 'Asia/Ho_Chi_Minh',
  scope: 'Toàn trại', tiles, columns: [], rows: [], totalRow: null, chart: null, unavailableData: [],
})
const tilesOf = (count: number) => Array.from({ length: count }, (_, index) => ({ label: `Chỉ số ${index + 1}`, value: String(index), note: '' }))
const heroCell = () => screen.getByRole('region', { name: 'Chỉ số báo cáo' }).firstElementChild as HTMLElement

describe('report tiles (Bento)', () => {
  it.each([
    [6, '@min-[1024px]:col-span-3'],
    [8, '@min-[1024px]:col-span-1'],
    [12, '@min-[1024px]:col-span-1'],
    [17, '@min-[1024px]:col-span-4'],
  ])('with %i tiles the first tile spans so that no tile is left alone on the last row of four (%s)', (count, span) => {
    render(<ReportResult report={bentoView(tilesOf(count))} />)
    expect(heroCell().className).toContain(span)
  })

  it('lets the first of an odd number of tiles take the whole row of the two-column grid', () => {
    render(<ReportResult report={bentoView(tilesOf(5))} />)
    expect(heroCell().className).toContain('@min-[640px]:col-span-2')
  })

  it('says there is nothing to chart instead of drawing an empty chart', () => {
    render(<ReportResult report={{ ...bentoView(tilesOf(1)), charts: [{ title: 'Lần phối theo phương pháp', sub: 'Mỗi lần phối được tính một lần.', unit: 'lần', bars: [] }] }} />)
    expect(screen.getByText('Không có dữ liệu trong kỳ để vẽ biểu đồ.')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('does not repeat "Chưa có dữ liệu" under a tile whose value already says so', () => {
    render(<ReportResult report={bentoView([{ label: 'Số bò cuối kỳ', value: '2', note: '' }, { label: 'Xuất đàn theo loại', value: 'Chưa có dữ liệu', note: 'Chưa có dữ liệu' }])} />)
    const tile = screen.getByText('Xuất đàn theo loại').parentElement as HTMLElement
    expect(within(tile).getAllByText('Chưa có dữ liệu')).toHaveLength(1)
  })
})
