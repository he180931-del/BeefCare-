import { Badge, Card, Note, Table, Td, Th, Tile } from '../../../components/ui'
import { formatDateTime } from '../domain/format'
import type { ReportCell, ReportView } from '../types'

const renderCell = (cell: ReportCell | undefined) => {
  if (cell === undefined) return '—'
  if (typeof cell === 'string') return cell
  return <>{cell.text}{cell.text && cell.badge ? ' ' : ''}{cell.badge && <Badge tone="warn">{cell.badge}</Badge>}</>
}

export default function ReportResult({ report }: { report: ReportView }) {
  const bySchedule = report.reportType === 'RPT-03'
  const max = Math.max(...(report.chart?.bars.map((b) => b.value) ?? [100]), 1)
  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-xs text-muted">{`${report.scope} · tính lúc ${formatDateTime(report.generatedAt)}`}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {report.tiles.map((t) => <Tile key={t.label} label={t.label} value={t.value} note={t.note} />)}
      </div>
      {report.unavailableData.map((message) => <Note key={message} tone="warn">{message}</Note>)}
      <Card title={bySchedule ? 'Kết quả theo lịch tiêm' : 'Kết quả theo chuồng'} sub={'Thiếu dữ liệu hiển thị "Thiếu dữ liệu (n con)"'}>
        {report.rows.length === 0 ? <p className="m-0 text-xs text-muted">Không có dữ liệu cho bộ lọc đã chọn.</p> : (
          <Table scroll>
            <thead><tr><Th>{bySchedule ? 'Lịch tiêm' : 'Chuồng'}</Th>{report.columns.map((c) => <Th key={c.key}>{c.label}</Th>)}</tr></thead>
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
      </Card>
      {report.chart && (
        <Card title={report.chart.title} sub={report.chart.sub}>
          <div className="flex items-end gap-4" role="img" aria-label={report.chart.bars.map((b) => `${b.label}: ${b.value}%`).join(', ')}>
            {report.chart.bars.map((b, i) => (
              <div key={b.label} className="flex w-14 flex-col items-center gap-1">
                <span className="text-[11px] font-semibold text-brand-dark">{`${b.value}%`}</span>
                <div className={`w-full rounded ${i === report.chart!.bars.length - 1 ? 'bg-brand' : 'bg-[#b8dbc4]'}`} style={{ height: `${Math.round((b.value / max) * 100)}px` }} />
                <span className="text-[11px] text-muted">{b.label}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
