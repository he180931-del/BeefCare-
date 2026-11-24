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
    const screenResult = document.querySelector('.report-result-screen') as HTMLElement

    expect(within(screenResult).getByRole('heading', { name: /Tuân thủ theo lịch tiêm/ })).toBeInTheDocument()
    expect(within(screenResult).getByRole('columnheader', { name: 'Lịch tiêm' })).toBeInTheDocument()
    expect(within(screenResult).getByText('Tổng (mũi)')).toBeInTheDocument()
    expect(within(screenResult).getByRole('heading', { name: /Mũi đã tiêm theo lịch/ })).toBeInTheDocument()
    expect(within(screenResult).getByText('0 mũi')).toBeInTheDocument()
    expect(within(screenResult).getByRole('img', { name: 'Lịch A: 0 mũi' })).toBeInTheDocument()
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
    const screenResult = document.querySelector('.report-result-screen') as HTMLElement

    expect(within(screenResult).getByRole('columnheader', { name: 'Thức ăn đã dùng (kg)' })).toBeInTheDocument()
    expect(within(screenResult).getByRole('columnheader', { name: 'Thức ăn tính tỷ lệ (bò đủ cân, kg)' })).toBeInTheDocument()
    expect(within(screenResult).getAllByText('40')).toHaveLength(2)
    expect(within(screenResult).getAllByText('20')).toHaveLength(2)
  })
})

const bentoView = (tiles: ReportView['tiles']): ReportView => ({
  reportType: 'RPT-05', title: 'Báo cáo', from: '2026-10-22', to: '2026-11-20', generatedAt: '2026-11-20T13:00:00Z', timeZone: 'Asia/Ho_Chi_Minh',
  scope: 'Toàn trại', tiles, columns: [], rows: [], totalRow: null, chart: null, unavailableData: [],
})
const tilesOf = (count: number) => Array.from({ length: count }, (_, index) => ({ label: `Chỉ số ${index + 1}`, value: String(index), note: '' }))
const heroCell = () => within(document.querySelector('.report-result-screen') as HTMLElement).getByRole('region', { name: 'Chỉ số báo cáo' }).firstElementChild as HTMLElement
const herdReport = (headAtEnd: string): ReportView => ({
  ...bentoView([{ key: 'headAtEnd', label: 'Số bò cuối kỳ', value: headAtEnd, note: 'đang nuôi' }]),
  reportType: 'RPT-01',
  title: 'Tổng hợp đàn',
})

describe('empty herd report explanation', () => {
  it('explains the eligibility rule when no cattle qualify for RPT-01', () => {
    render(<ReportResult report={herdReport('0')} />)

    expect(screen.getByRole('complementary', { name: 'Thông tin về phạm vi báo cáo' })).toHaveTextContent('Báo cáo này chỉ tính những con có phiếu nhập đàn hợp lệ trước ngày kết thúc kỳ và vẫn còn trong đàn vào ngày đó.')
    expect(screen.getByRole('complementary', { name: 'Thông tin về phạm vi báo cáo' })).toHaveTextContent('bò hiển thị ở màn hình khác có thể chưa xuất hiện nếu hồ sơ nhập đàn của chúng chưa có trong dữ liệu đến ngày kết thúc kỳ đã chọn.')
    expect(within(document.querySelector('.report-result-screen') as HTMLElement).getByText('0')).toBeInTheDocument()
  })

  it('does not show the explanation for a non-empty RPT-01 report', () => {
    render(<ReportResult report={{ ...herdReport('0'), rows: [{ label: 'Chuồng A', cells: {} }] }} />)

    expect(screen.queryByRole('complementary', { name: 'Thông tin về phạm vi báo cáo' })).not.toBeInTheDocument()
  })

  it('does not show the explanation for another non-empty report', () => {
    render(<ReportResult report={{ ...bentoView([{ key: 'done', label: 'Đã tiêm', value: '12', note: 'mũi' }]), rows: [{ label: 'Lịch A', cells: {} }] }} />)

    expect(screen.queryByRole('complementary', { name: 'Thông tin về phạm vi báo cáo' })).not.toBeInTheDocument()
  })
})

describe('report tiles (Bento)', () => {
  it('keeps the headline to at most four tiles with one emphasized tile', () => {
    render(<ReportResult report={bentoView(tilesOf(17))} />)
    const region = within(document.querySelector('.report-result-screen') as HTMLElement).getByRole('region', { name: 'Chỉ số báo cáo' })
    expect(region.children).toHaveLength(4)
    expect(heroCell().className).toContain('bg-brand-dark')
  })

  it('says there is nothing to chart instead of drawing an empty chart', () => {
    render(<ReportResult report={{ ...bentoView(tilesOf(1)), charts: [{ title: 'Lần phối theo phương pháp', sub: 'Mỗi lần phối được tính một lần.', unit: 'lần', bars: [] }] }} />)
    const screenResult = document.querySelector('.report-result-screen') as HTMLElement
    expect(within(screenResult).queryByText('Không có dữ liệu trong kỳ để vẽ biểu đồ.')).not.toBeInTheDocument()
    expect(within(screenResult).queryByRole('img')).not.toBeInTheDocument()
  })

  it('does not repeat "Chưa có dữ liệu" under a tile whose value already says so', () => {
    render(<ReportResult report={bentoView([{ label: 'Số bò cuối kỳ', value: '2', note: '' }, { label: 'Xuất đàn theo loại', value: 'Chưa có dữ liệu', note: 'Chưa có dữ liệu' }])} />)
    const tile = within(document.querySelector('.report-result-screen') as HTMLElement).getByText('Xuất đàn theo loại').parentElement as HTMLElement
    expect(within(tile).getAllByText('Chưa có dữ liệu')).toHaveLength(1)
  })

  it('uses reproduction wording only for RPT-05 percentage chart samples', () => {
    const chart = { title: 'Tỷ lệ', sub: 'Theo kỳ', unit: '%', bars: [{ label: 'Tháng 10', value: 50, sampleSize: 4, numerator: 2, denominator: 4 }] }
    const { rerender } = render(<ReportResult report={{ ...bentoView([]), reportType: 'RPT-04', charts: [chart] }} />)
    const screenResult = document.querySelector('.report-result-screen') as HTMLElement
    expect(within(screenResult).getByText('Mẫu tính: 4')).toBeInTheDocument()
    expect(within(screenResult).queryByText('Dựa trên 4 lần phối có kết quả')).not.toBeInTheDocument()

    rerender(<ReportResult report={{ ...bentoView([]), reportType: 'RPT-05', charts: [chart] }} />)
    expect(within(screenResult).getByText('Dựa trên 4 lần phối có kết quả')).toBeInTheDocument()
  })
})

describe('report print document', () => {
  const printableReport = (reportType: ReportView['reportType'] = 'RPT-03'): ReportView => ({
    ...report,
    reportType,
    title: reportType === 'RPT-05' ? 'Hiệu quả sinh sản' : report.title,
    from: '2026-10-01',
    to: '2026-10-31',
    generatedAt: '2026-11-14T04:00:00Z',
    timeZone: 'Asia/Ho_Chi_Minh',
    scope: '01/10/2026 – 31/10/2026',
    filters: ['Chuồng A1'],
    tiles: [
      { key: 'one', label: 'Chỉ số một', value: '1', note: 'con' },
      { key: 'two', label: 'Chỉ số hai', value: '2', note: 'lần' },
      { key: 'three', label: 'Chỉ số ba', value: '3', note: 'kg' },
      { key: 'four', label: 'Chỉ số bốn', value: '4', note: 'mũi' },
      { key: 'five', label: 'Chỉ số năm', value: '5', note: 'ngày' },
    ],
    charts: [{
      title: 'Giá trị theo tháng', sub: 'Số liệu hợp lệ', unit: '%',
      bars: [{ label: 'Tháng 10', value: 50, sampleSize: 4, numerator: 2, denominator: 4 }],
    }],
  })

  it('prints all returned KPI tiles, metadata, and chart values as a table fallback', () => {
    render(<ReportResult report={printableReport()} farmName="Trại bò Yên Bài" />)

    const document = screen.getByTestId('report-print-document')
    expect(document).toHaveTextContent('BEEFCARE')
    expect(document).toHaveTextContent('Trại bò Yên Bài')
    expect(document).toHaveTextContent('01/10/2026 – 31/10/2026')
    expect(document).toHaveTextContent('Asia/Ho_Chi_Minh')
    expect(document).toHaveTextContent('Chuồng A1')
    expect(document).toHaveTextContent('Tính lúc 11:00 14/11/2026')
    expect(document).toHaveTextContent('Chỉ số năm')
    expect(within(document).getByRole('table', { name: /Giá trị theo tháng/ })).toHaveTextContent('50 %')
    expect(within(document).getByRole('table', { name: /Giá trị theo tháng/ })).toHaveTextContent('2/4')
    expect(document.querySelectorAll('button, form')).toHaveLength(0)
  })

  it('prints the authoritative full title and keeps top-level rows beside mapped sections', () => {
    const withTopLevel = printableReport('RPT-05')
    withTopLevel.columns = [{ key: 'count', label: 'Số con' }]
    withTopLevel.rows = [{ label: 'Chuồng A1', cells: { count: '3' } }]
    withTopLevel.totalRow = { label: 'Tổng', cells: { count: '3' } }
    render(<ReportResult report={withTopLevel} />)

    const document = screen.getByTestId('report-print-document')
    expect(within(document).getByRole('heading', { level: 1, name: 'Hiệu quả sinh sản' })).toBeInTheDocument()
    expect(within(document).getByRole('table', { name: 'Hiệu quả sinh sản' })).toHaveTextContent('Chuồng A1')
    expect(within(document).getByRole('table', { name: 'Tuân thủ theo lịch tiêm' })).toHaveTextContent('Tổng (mũi)')
  })

  it.each(['RPT-01', 'RPT-02', 'RPT-03', 'RPT-04', 'RPT-05', 'RPT-06', 'RPT-07'] as const)('identifies %s in the print boundary', (reportType) => {
    render(<ReportResult report={printableReport(reportType)} />)
    expect(screen.getByTestId('report-print-document')).toHaveAccessibleName(new RegExp(`${reportType}.*`))
  })
})
