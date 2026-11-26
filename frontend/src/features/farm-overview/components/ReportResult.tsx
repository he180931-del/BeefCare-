import { useState } from 'react'
import { Badge, Button, Metric, Note, Panel, Table, Td, Th } from '../../../shared/ui'
import { formatDateTime, formatKey, fmtInt } from '../domain/format'
import { REPORT_CATALOGUE } from '../domain/reportRules'
import type { ReportCell, ReportFilterKey, ReportMetricChart, ReportView } from '../types'

const renderCell = (cell: ReportCell | undefined) => {
  if (cell === undefined) return '—'
  if (typeof cell === 'string') return cell
  return <>{cell.text}{cell.text && cell.badge ? ' ' : ''}{cell.badge && <Badge tone="warn">{cell.badge}</Badge>}</>
}

/** Stable server summary keys used to keep the headline small without matching translated labels. */
const KPI_KEYS: Record<ReportView['reportType'], string[]> = {
  'RPT-01': ['headAtEnd', 'entriesInPeriod', 'exitsInPeriod'],
  'RPT-02': ['averageGroupWeightKg', 'averageADGKgPerDay', 'validWeighings'],
  'RPT-03': ['done', 'planned', 'overdue', 'doses', 'onFarmVaccinations'],
  'RPT-04': ['openedCases', 'closedCases', 'cattleWithActiveMeatWithdrawalAtEnd'],
  'RPT-05': ['trackedFemales', 'overallConceptionRate', 'firstServiceConceptionRate', 'overdueFemales', 'overdueFemales.count', 'calvings', 'liveCalves'],
  'RPT-06': ['entries', 'exits', 'penMoves'],
  'RPT-07': ['averageAdgKgPerDay', 'feedPerKgGain', 'feedCostPerKgGain', 'targetReached'],
}

function headlineTiles(report: ReportView) {
  const selected: typeof report.tiles = []
  for (const key of KPI_KEYS[report.reportType]) {
    const tile = report.tiles.find((item) => item.key === key)
    if (tile && !selected.includes(tile)) selected.push(tile)
    if (selected.length === 4) break
  }
  if (selected.length < 2) {
    for (const tile of report.tiles) {
      if (!selected.includes(tile)) selected.push(tile)
      if (selected.length === 4) break
    }
  }
  return selected
}

function chartIdentity(chart: ReportMetricChart) {
  return chart.title + '|' + chart.bars.map((bar) => bar.label + ':' + (bar.value === null ? 'missing' : bar.value)).join(',')
}

function reportCharts(report: ReportView): ReportMetricChart[] {
  const legacy: ReportMetricChart[] = report.chart ? [{
    title: report.chart.title,
    sub: report.chart.sub,
    unit: '%',
    bars: report.chart.bars.map((bar) => ({ ...bar, sampleSize: bar.denominator })),
  }] : []
  const seen = new Set<string>()
  return [...(report.charts ?? []), ...legacy].filter((chart) => {
    if (!chart.bars.length) return false
    const id = chartIdentity(chart)
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
}

const rowHeading = ({
  'RPT-01': 'Phân loại',
  'RPT-02': 'Nhóm · chuồng · giai đoạn',
  'RPT-03': 'Lịch / vắc-xin tại trại',
  'RPT-04': 'Phân loại',
  'RPT-05': 'Sự kiện / kết quả',
  'RPT-06': 'Loại biến động',
  'RPT-07': 'Chuồng',
} as const)

const hasNoRPT01EligibleCattle = (report: ReportView) => {
  if (report.reportType !== 'RPT-01') return false
  return !reportHasRows(report) && report.tiles.find((tile) => tile.key === 'headAtEnd')?.value.trim() === '0'
}

function chartSample(bar: ReportMetricChart['bars'][number], chart: ReportMetricChart, reportType: ReportView['reportType']) {
  if (reportType === 'RPT-05' && chart.unit === '%' && bar.denominator != null && bar.denominator > 0) return 'Dựa trên ' + fmtInt(bar.denominator) + ' lần phối có kết quả'
  if (bar.value === null) return bar.sampleSize != null && bar.sampleSize > 0 ? 'Mẫu tính: ' + fmtInt(bar.sampleSize) : ''
  return bar.sampleSize != null ? 'Mẫu tính: ' + fmtInt(bar.sampleSize) : ''
}

function renderChart(chart: ReportMetricChart, reportType: ReportView['reportType']) {
  const maxValue = Math.max(1, ...chart.bars.map((bar) => Math.abs(bar.value ?? 0)))
  const describe = (bar: ReportMetricChart['bars'][number]) => {
    const value = bar.value === null ? 'chưa đủ dữ liệu' : String(bar.value) + ' ' + chart.unit
    const sample = chartSample(bar, chart, reportType)
    return bar.label + ': ' + value + (sample ? ' · ' + sample : '')
  }
  return (
    <Panel key={chartIdentity(chart)} title={chart.title} sub={chart.sub} headingAs="h3">
      <div className="flex items-end gap-4 overflow-x-auto" role="img" aria-label={chart.bars.map(describe).join(', ')}>
        {chart.bars.map((bar, index) => {
          const sample = chartSample(bar, chart, reportType)
          const ratio = bar.value !== null && bar.numerator != null && bar.denominator != null && bar.denominator > 0
            ? String(bar.numerator) + '/' + String(bar.denominator)
            : ''
          return (
            <div key={bar.label} className="flex w-20 shrink-0 flex-col items-center gap-1">
              <span className="text-center text-[11px] font-semibold text-brand-dark">{bar.value === null ? 'Chưa đủ dữ liệu' : new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(bar.value) + ' ' + chart.unit}</span>
              <div className={'w-full rounded ' + (index === chart.bars.length - 1 ? 'bg-brand' : 'bg-[#b8dbc4]')} style={{ height: String(Math.round((Math.abs(bar.value ?? 0) / maxValue) * 100)) + 'px' }} />
              {ratio && <span className="text-[10px] text-muted">{ratio}</span>}
              {sample && <span className="text-[10px] text-muted">{sample}</span>}
              <span className="text-[11px] text-muted">{bar.label}</span>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

const FILTER_LABEL: Record<ReportFilterKey, string> = { pen: 'Chuồng', breed: 'Giống', group: 'Nhóm đàn', stage: 'Giai đoạn' }

const EMPTY_REPORT_MESSAGE: Record<ReportView['reportType'], string> = {
  'RPT-01': 'Không có bò đủ điều kiện trong kỳ đã áp dụng.',
  'RPT-02': 'Không có dữ liệu cân hợp lệ trong kỳ đã áp dụng.',
  'RPT-03': 'Không có mũi tiêm trong kỳ đã áp dụng.',
  'RPT-04': 'Không có ca sức khỏe hoặc điều trị trong kỳ đã áp dụng.',
  'RPT-05': 'Không có sự kiện sinh sản hợp lệ trong kỳ đã áp dụng.',
  'RPT-06': 'Không có biến động đàn trong kỳ đã áp dụng.',
  'RPT-07': 'Không có bò vỗ béo đủ điều kiện trong kỳ đã áp dụng.',
}

const printCellText = (cell: ReportCell | undefined) => {
  if (cell === undefined) return '—'
  if (typeof cell === 'string') return cell
  return [cell.text, cell.badge].filter(Boolean).join(' · ') || '—'
}

const printNumber = (value: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(value)

function reportHasRows(report: ReportView) {
  return report.rows.length > 0 || report.totalRow !== null || (report.sections ?? []).some((section) => section.rows.length > 0 || section.totalRow !== null)
}

function ReportPrintTable({ heading, rowHeading, columns, rows, totalRow }: {
  heading: string
  rowHeading: string
  columns: Array<{ key: string; label: string }>
  rows: Array<{ label: string; cells: Record<string, ReportCell> }>
  totalRow: { label: string; cells: Record<string, ReportCell> } | null
}) {
  return (
    <section className="report-print-section">
      <h2 className="report-print-heading">{heading}</h2>
      <table className="report-print-table">
        <caption className="sr-only">{heading}</caption>
        <thead><tr><th scope="col">{rowHeading}</th>{columns.map((column) => <th key={column.key} scope="col">{column.label}</th>)}</tr></thead>
        <tbody>{rows.map((row) => <tr key={row.label}><th scope="row">{row.label}</th>{columns.map((column) => <td key={column.key}>{printCellText(row.cells[column.key])}</td>)}</tr>)}</tbody>
        {totalRow && <tfoot><tr><th scope="row">{totalRow.label}</th>{columns.map((column) => <td key={column.key}>{printCellText(totalRow.cells[column.key])}</td>)}</tr></tfoot>}
      </table>
    </section>
  )
}

function ReportPrintChart({ chart, reportType }: { chart: ReportMetricChart; reportType: ReportView['reportType'] }) {
  return (
    <table className="report-print-table report-print-chart">
      <caption>{chart.title}<small>{chart.sub}</small></caption>
      <thead><tr><th scope="col">Nhóm / kỳ</th><th scope="col">Giá trị</th><th scope="col">Mẫu số</th></tr></thead>
      <tbody>
        {chart.bars.map((bar) => {
          const value = bar.value === null ? 'Chưa đủ dữ liệu' : `${printNumber(bar.value)} ${chart.unit}`
          const ratio = bar.numerator != null && bar.denominator != null ? `${fmtInt(bar.numerator)}/${fmtInt(bar.denominator)}` : ''
          const sample = chartSample(bar, chart, reportType)
          return <tr key={bar.label}><th scope="row">{bar.label}</th><td>{value}</td><td>{[ratio, sample].filter(Boolean).join(' · ') || '—'}</td></tr>
        })}
      </tbody>
    </table>
  )
}

function ReportPrintDocument({ report, farmName, appliedFilters }: { report: ReportView; farmName?: string | null; appliedFilters: string[] }) {
  const catalogue = REPORT_CATALOGUE.find((item) => item.code === report.reportType)
  const displayTitle = report.printTitle ?? catalogue?.label ?? catalogue?.title ?? report.title
  const supportedFilters = catalogue?.filters.map((key) => FILTER_LABEL[key]).join(', ') || 'Không có bộ lọc thêm'
  const sections = report.sections ?? []
  const charts = reportCharts(report)
  const warnings = [...new Set(report.unavailableData)]
  const empty = !reportHasRows(report)
  const printFilters = appliedFilters.length > 0 ? appliedFilters.join(' · ') : 'Toàn bộ phạm vi phù hợp'

  return (
    <article className="report-print-document print-layout-root" data-testid="report-print-document" aria-label={`${report.reportType} · ${displayTitle}`}>
      <header className="report-print-header">
        <div className="report-print-brand">BEEFCARE</div>
        <div className="report-print-title">
          <p className="report-print-code">Mã báo cáo: {report.reportType}</p>
          <h1>{displayTitle}</h1>
        </div>
        <dl className="report-print-meta">
          {farmName && <div><dt>Trại</dt><dd>{farmName}</dd></div>}
          <div><dt>Kỳ áp dụng</dt><dd>{formatKey(report.from)} – {formatKey(report.to)}</dd></div>
          <div><dt>Múi giờ</dt><dd>{report.timeZone || 'Chưa cung cấp'}</dd></div>
          <div><dt>Bộ lọc hỗ trợ</dt><dd>{supportedFilters}</dd></div>
          <div><dt>Bộ lọc đã áp dụng</dt><dd>{printFilters}</dd></div>
          <div><dt>Tính lúc</dt><dd>{formatDateTime(report.generatedAt, report.timeZone)}</dd></div>
        </dl>
      </header>

      {report.tiles.length > 0 && <section className="report-print-section" aria-label="Chỉ số báo cáo">
        <h2 className="report-print-heading">Chỉ số báo cáo</h2>
        <dl className="report-print-kpis">
          {report.tiles.map((tile, index) => <div className="report-print-kpi" key={tile.key ?? `${tile.label}-${index}`}><dt>{tile.label}</dt><dd>{tile.value}</dd>{tile.note && tile.note !== tile.value && <small>{tile.note}</small>}</div>)}
        </dl>
      </section>}

      {warnings.length > 0 && <section className="report-print-warning" aria-label="Cảnh báo dữ liệu">
        <h2>Cảnh báo dữ liệu</h2>
        <ul>{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
      </section>}

      {empty && <section className="report-print-empty" aria-label="Trạng thái dữ liệu">
        <h2>Không có dữ liệu phù hợp</h2>
        <p>{EMPTY_REPORT_MESSAGE[report.reportType]}</p>
      </section>}

      {showRPT01EmptyInfo(report) && <section className="report-print-empty" aria-label="Thông tin về phạm vi báo cáo">
        <h2>Điều kiện tính RPT-01</h2>
        <p>Báo cáo này chỉ tính những con có phiếu nhập đàn hợp lệ trước ngày kết thúc kỳ và vẫn còn trong đàn vào ngày đó. Vì vậy, bò hiển thị ở màn hình khác có thể chưa xuất hiện nếu hồ sơ nhập đàn của chúng chưa có trong dữ liệu đến ngày kết thúc kỳ đã chọn.</p>
      </section>}

      {(report.rows.length > 0 || report.totalRow !== null) && <ReportPrintTable heading={report.title} rowHeading={rowHeading[report.reportType]} columns={report.columns} rows={report.rows} totalRow={report.totalRow} />}
      {sections.map((section) => <ReportPrintTable key={section.key} heading={section.title} rowHeading={section.rowHeading} columns={section.columns} rows={section.rows} totalRow={section.totalRow} />)}
      {charts.map((chart) => <ReportPrintChart key={chartIdentity(chart)} chart={chart} reportType={report.reportType} />)}

      <footer className="report-print-footer">BEEFCARE · {report.reportType} · Báo cáo quản lý · Tính lúc {formatDateTime(report.generatedAt, report.timeZone)} · Múi giờ {report.timeZone || 'chưa cung cấp'}</footer>
    </article>
  )
}

function showRPT01EmptyInfo(report: ReportView) {
  if (report.reportType !== 'RPT-01') return false
  return !reportHasRows(report) && report.tiles.find((tile) => tile.key === 'headAtEnd')?.value.trim() === '0'
}

export default function ReportResult({ report, farmName, appliedFilters }: { report: ReportView; farmName?: string | null; appliedFilters?: string[] }) {
  const [detailsOpen, setDetailsOpen] = useState(true)
  const sections = report.sections ?? []
  const tiles = headlineTiles(report)
  const charts = reportCharts(report)
  const warnings = [...new Set(report.unavailableData)]
  const filters = appliedFilters ?? report.filters ?? []
  const tableTitle = report.title
  const showRPT01EmptyInfo = hasNoRPT01EligibleCattle(report)

  return (
    <>
      <div className="report-result-screen flex min-w-0 flex-col gap-4 @min-[1024px]:gap-6">

      <header className="rounded-2xl border border-field bg-white p-4 @min-[1024px]:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="m-0 text-xs font-semibold uppercase tracking-wide text-brand">Kết quả báo cáo</p>
            <h2 className="mb-0 mt-1 text-xl font-bold text-ink">{report.title}</h2>
          </div>
          <p className="m-0 text-right text-xs text-muted">Tính lúc {formatDateTime(report.generatedAt, report.timeZone)}</p>
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-muted">Kỳ đã áp dụng</dt><dd className="m-0 font-semibold">{formatKey(report.from)} – {formatKey(report.to)}</dd></div>
          <div><dt className="text-xs text-muted">Bộ lọc đang áp dụng</dt><dd className="m-0 flex flex-wrap gap-1.5">{filters.length ? filters.map((filter) => <Badge key={filter}>{filter}</Badge>) : <span>Toàn bộ phạm vi báo cáo</span>}</dd></div>
        </dl>
      </header>

      {showRPT01EmptyInfo && (
        <aside aria-label="Thông tin về phạm vi báo cáo">
          <Note tone="info">Báo cáo này chỉ tính những con có phiếu nhập đàn hợp lệ trước ngày kết thúc kỳ và vẫn còn trong đàn vào ngày đó. Vì vậy, bò hiển thị ở màn hình khác có thể chưa xuất hiện nếu hồ sơ nhập đàn của chúng chưa có trong dữ liệu đến ngày kết thúc kỳ đã chọn.</Note>
        </aside>
      )}

      {tiles.length > 0 && (
        <section aria-label="Chỉ số báo cáo" className="grid grid-cols-1 gap-3 sm:grid-cols-2 @min-[1024px]:grid-cols-4">
          {tiles.map((tile, index) => (
            <Metric key={tile.key ?? tile.label + '-' + index} surface="panel" tone={index === 0 ? 'emphasis' : 'default'} compact={index !== 0} label={tile.label} value={tile.value} note={tile.note === tile.value ? undefined : tile.note || undefined} />
          ))}
        </section>
      )}

      {warnings.length > 0 && <section aria-label="Cảnh báo dữ liệu" className="flex flex-col gap-2">{warnings.map((message) => <Note key={message} tone="warn">{message}</Note>)}</section>}

      <Panel
        title="Chi tiết"
        sub="Bảng, dòng tổng và biểu đồ của báo cáo"
        actions={<Button className="report-detail-toggle" variant="link" size="sm" aria-expanded={detailsOpen} onClick={() => setDetailsOpen((open) => !open)}>{detailsOpen ? 'Thu gọn' : 'Mở rộng'}</Button>}
      >
        <div className={'report-detail-content ' + (detailsOpen ? '' : 'is-collapsed hidden print:block')}>
          {sections.length > 0 ? sections.map((section) => (
            <Panel key={section.key} title={section.title} headingAs="h3" className="mb-4 last:mb-0">
              <Table scroll>
                <thead><tr><Th>{section.rowHeading}</Th>{section.columns.map((column) => <Th key={column.key}>{column.label}</Th>)}</tr></thead>
                <tbody>
                  {section.rows.map((row) => <tr key={row.label}><Td className="font-medium">{row.label}</Td>{section.columns.map((column) => <Td key={column.key}>{renderCell(row.cells[column.key])}</Td>)}</tr>)}
                  {section.totalRow && <tr className="font-semibold"><Td>{section.totalRow.label}</Td>{section.columns.map((column) => <Td key={column.key}>{renderCell(section.totalRow?.cells[column.key])}</Td>)}</tr>}
                  {section.rows.length === 0 && !section.totalRow && <tr><Td colSpan={section.columns.length + 1}>{EMPTY_REPORT_MESSAGE[report.reportType]}</Td></tr>}
                </tbody>
              </Table>
            </Panel>
          )) : (
            <Panel title={tableTitle} headingAs="h3" className="mb-4">
              {report.rows.length === 0 ? <p className="m-0 text-xs text-muted">{EMPTY_REPORT_MESSAGE[report.reportType]}</p> : (
                <Table scroll>
                  <thead><tr><Th>{rowHeading[report.reportType]}</Th>{report.columns.map((column) => <Th key={column.key}>{column.label}</Th>)}</tr></thead>
                  <tbody>
                    {report.rows.map((row) => <tr key={row.label}><Td className="font-medium">{row.label}</Td>{report.columns.map((column) => <Td key={column.key}>{renderCell(row.cells[column.key])}</Td>)}</tr>)}
                    {report.totalRow && <tr className="font-semibold"><Td>{report.totalRow.label}</Td>{report.columns.map((column) => <Td key={column.key}>{renderCell(report.totalRow?.cells[column.key])}</Td>)}</tr>}
                  </tbody>
                </Table>
              )}
            </Panel>
          )}
          {charts.map((chart) => renderChart(chart, report.reportType))}
        </div>
      </Panel>
      </div>
      <ReportPrintDocument report={report} farmName={farmName} appliedFilters={filters} />
    </>
  )
}
