import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
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
