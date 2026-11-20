import { Badge, Metric, Note, Panel, Table, Td, Th } from '../../../shared/ui'
import { formatDateTime } from '../domain/format'
import type { ReportCell, ReportMetricChart, ReportView } from '../types'

const renderCell = (cell: ReportCell | undefined) => {
  if (cell === undefined) return '—'
  if (typeof cell === 'string') return cell
  return <>{cell.text}{cell.text && cell.badge ? ' ' : ''}{cell.badge && <Badge tone="warn">{cell.badge}</Badge>}</>
}

const TILE_COLUMNS: Record<number, string> = {
  1: '@min-[1024px]:grid-cols-1',
  2: '@min-[1024px]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]',
  3: '@min-[1024px]:grid-cols-[minmax(0,2fr)_repeat(2,minmax(0,1fr))]',
  4: '@min-[1024px]:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]',
  5: '@min-[1024px]:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]',
}
// Số cột ô đầu chiếm trên lưới 4 cột, theo (1 − số ô) mod 4; 0 nghĩa là cả hàng.
const HERO_SPAN_OF_4 = ['@min-[1024px]:col-span-4', '@min-[1024px]:col-span-1', '@min-[1024px]:col-span-2', '@min-[1024px]:col-span-3']

export default function ReportResult({ report }: { report: ReportView }) {
  const rowHeading = ({
    'RPT-01': 'Phân loại',
    'RPT-02': 'Nhóm · chuồng · giai đoạn',
    'RPT-03': 'Lịch / vắc-xin tại trại',
    'RPT-04': 'Phân loại',
    'RPT-05': 'Sự kiện / kết quả',
    'RPT-06': 'Loại biến động',
    'RPT-07': 'Chuồng',
  } as const)[report.reportType]
  const tableTitle = ({
    'RPT-01': 'Kết quả tổng hợp đàn',
    'RPT-02': 'Kết quả tăng trưởng theo nhóm, chuồng và giai đoạn',
    'RPT-03': 'Kết quả theo lịch tiêm',
    'RPT-04': 'Kết quả sức khỏe và điều trị',
    'RPT-05': 'Kết quả sinh sản',
    'RPT-06': 'Biến động đàn theo loại',
    'RPT-07': 'Hiệu quả vỗ béo theo chuồng',
  } as const)[report.reportType]
  const max = 100
  const sections = report.sections ?? []
  // Ô đầu là khối nổi bật. Không để ô lẻ một mình ở hàng cuối: 1–5 ô xếp đủ một hàng (ô đầu rộng gấp đôi); nhiều hơn thì
  // lưới 4 cột và ô đầu giãn 1–4 cột cho tổng số chỗ chia hết cho 4; ở lưới 2 cột, số ô lẻ thì ô đầu chiếm cả hàng.
  const tileCount = report.tiles.length
  const tileColumns = TILE_COLUMNS[tileCount] ?? '@min-[1024px]:grid-cols-4'
  const wideHero = tileCount > 5 ? HERO_SPAN_OF_4[(((1 - tileCount) % 4) + 4) % 4] : '@min-[1024px]:col-span-1'
  const heroSpan = `${tileCount % 2 === 1 ? '@min-[640px]:col-span-2' : ''} ${wideHero}`
  return (
    <div className="flex min-w-0 flex-col gap-4 @min-[1024px]:gap-6">
      <p className="m-0 text-xs text-muted">{`${report.scope} · tính lúc ${formatDateTime(report.generatedAt, report.timeZone)}`}</p>
      {report.tiles.length > 0 && (
        <section aria-label="Chỉ số báo cáo" className={`grid grid-cols-1 gap-4 @min-[640px]:grid-cols-2 ${tileColumns}`}>
          {report.tiles.map((tile, index) => (
            <div key={tile.label} className={`grid min-w-0 ${index === 0 ? heroSpan : ''}`}>
              {/* Ô "Chưa có dữ liệu" không lặp lại cùng câu ở dòng ghi chú. */}
              <Metric surface="panel" tone={index === 0 ? 'emphasis' : 'default'} compact={index !== 0} label={tile.label} value={tile.value} note={tile.note === tile.value ? undefined : tile.note} />
            </div>
          ))}
        </section>
      )}
      {report.unavailableData.map((message) => <Note key={message} tone="warn">{message}</Note>)}
      {sections.length > 0 ? sections.map((section) => (
        <Panel key={section.key} title={section.title} sub={'Thiếu dữ liệu hiển thị "Thiếu dữ liệu (n con)"'}>
          <Table scroll>
            <thead><tr><Th>{section.rowHeading}</Th>{section.columns.map((c) => <Th key={c.key}>{c.label}</Th>)}</tr></thead>
            <tbody>
              {section.rows.map((row) => (
                <tr key={row.label}><Td className="font-medium">{row.label}</Td>{section.columns.map((c) => <Td key={c.key}>{renderCell(row.cells[c.key])}</Td>)}</tr>
              ))}
              {section.totalRow && (
                <tr className="font-semibold"><Td>{section.totalRow.label}</Td>{section.columns.map((c) => <Td key={c.key}>{renderCell(section.totalRow?.cells[c.key])}</Td>)}</tr>
              )}
              {section.rows.length === 0 && !section.totalRow && <tr><Td colSpan={section.columns.length + 1}>Không có dữ liệu cho bộ lọc đã chọn.</Td></tr>}
            </tbody>
          </Table>
        </Panel>
      )) : (
        <Panel title={tableTitle} sub={'Thiếu dữ liệu hiển thị "Thiếu dữ liệu (n con)"'}>
          {report.rows.length === 0 ? <p className="m-0 text-xs text-muted">Không có dữ liệu cho bộ lọc đã chọn.</p> : (
            <Table scroll>
              <thead><tr><Th>{rowHeading}</Th>{report.columns.map((c) => <Th key={c.key}>{c.label}</Th>)}</tr></thead>
              <tbody>
                {report.rows.map((row) => (
                  <tr key={row.label}><Td className="font-medium">{row.label}</Td>{report.columns.map((c) => <Td key={c.key}>{renderCell(row.cells[c.key])}</Td>)}</tr>
                ))}
                {report.totalRow && (
                  <tr className="font-semibold"><Td>{report.totalRow.label}</Td>{report.columns.map((c) => <Td key={c.key}>{renderCell(report.totalRow?.cells[c.key])}</Td>)}</tr>
                )}
              </tbody>
            </Table>
          )}
        </Panel>
      )}
      {(report.charts ?? []).map((chart) => {
        const maxValue = Math.max(1, ...chart.bars.map((bar) => Math.abs(bar.value ?? 0)))
        const describe = (bar: ReportMetricChart['bars'][number]) => bar.value === null
          ? `${bar.label}: chưa đủ dữ liệu${bar.sampleSize == null ? '' : ` (n=${bar.sampleSize})`}`
          : `${bar.label}: ${bar.value} ${chart.unit}${bar.sampleSize == null ? '' : ` (n=${bar.sampleSize})`}`
        return (
          <Panel key={chart.title} title={chart.title} sub={chart.sub}>
            {chart.bars.length === 0 ? <p className="m-0 text-xs text-muted">Không có dữ liệu trong kỳ để vẽ biểu đồ.</p> : (
            <div className="flex items-end gap-4 overflow-x-auto" role="img" aria-label={chart.bars.map(describe).join(', ')}>
              {chart.bars.map((bar, i) => (
                <div key={bar.label} className="flex w-20 shrink-0 flex-col items-center gap-1">
                  <span className="text-center text-[11px] font-semibold text-brand-dark">{bar.value === null ? 'Chưa đủ dữ liệu' : `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 }).format(bar.value)} ${chart.unit}`}</span>
                  <div className={`w-full rounded ${i === chart.bars.length - 1 ? 'bg-brand' : 'bg-[#b8dbc4]'}`} style={{ height: `${Math.round((Math.abs(bar.value ?? 0) / maxValue) * 100)}px` }} />
                  {bar.sampleSize != null && <span className="text-[10px] text-muted">n = {bar.sampleSize}</span>}
                  {bar.numerator != null && bar.denominator != null && <span className="text-[10px] text-muted">{bar.numerator}/{bar.denominator}</span>}
                  <span className="text-[11px] text-muted">{bar.label}</span>
                </div>
              ))}
            </div>
            )}
          </Panel>
        )
      })}
      {report.chart && (
        <Panel title={report.chart.title} sub={report.chart.sub}>
          <div className="flex items-end gap-4 overflow-x-auto" role="img" aria-label={report.chart.bars.map((b) => b.value === null ? `${b.label}: chưa đủ dữ liệu (${b.numerator ?? 0}/${b.denominator ?? 0})` : `${b.label}: ${b.value}% (${b.numerator ?? 0}/${b.denominator ?? 0})`).join(', ')}>
            {report.chart.bars.map((b, i) => (
              <div key={b.label} className="flex w-14 shrink-0 flex-col items-center gap-1">
                <span className="text-center text-[11px] font-semibold text-brand-dark">{b.value === null ? 'Chưa đủ dữ liệu' : `${b.value}%`}</span>
                <div className={`w-full rounded ${i === report.chart!.bars.length - 1 ? 'bg-brand' : 'bg-[#b8dbc4]'}`} style={{ height: `${Math.round(((b.value ?? 0) / max) * 100)}px` }} />
                {b.denominator !== undefined && <span className="text-[10px] text-muted">{b.numerator ?? 0}/{b.denominator}</span>}
                <span className="text-[11px] text-muted">{b.label}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  )
}
