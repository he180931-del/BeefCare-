import Layout from '../../../app/layouts/FarmPlatformLayout'
import { useSession } from '../../../app/session/sessionContext'
import { toFarmLocal } from '../../../shared/lib/date/farmTime'
import { Button, Card, DateInput, Foot, Icon, Metric, Note, PageHeader, Segmented, Table, Td, Th } from '../../../shared/ui'
import { rationGroupLabel } from '../domain/feedRationForm'
import { formatDate, formatKg, formatNumber, formatVnd } from '../domain/feedLabels'
import FeedManagementTabs from '../components/FeedManagementTabs'
import { useFeedConsumptionReport } from '../hooks/useFeedConsumptionReport'
import type { FeedConsumptionGroupBy, FeedConsumptionProjectionRow, FeedConsumptionServerRow } from '../types/feedConsumption'

const FOOT = 'Báo cáo tiêu thụ và chi phí thức ăn theo kỳ (Chủ trại, Quản lý). Dữ liệu tiêu thụ lấy từ bản ghi cho ăn VALID; hao hụt điều chỉnh được theo dõi riêng. “In báo cáo” xuất bản in PDF.'
const oneDecimal = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

const money = (value: number | null | undefined) => value == null ? '—' : formatVnd(value)
const localDate = (value: string) => formatDate(value) || '—'

function percent(value: number | null) {
  if (value === null) return '—'
  const text = oneDecimal.format(Math.abs(value) * 100)
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${text}%`
}

function generatedAtLabel(value: string | null | undefined) {
  const local = value ? toFarmLocal(value) : ''
  const match = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  return match ? `${match[3]}/${match[2]}/${match[1]} ${match[4]}:${match[5]} (UTC+07:00)` : '—'
}

export default function FeedConsumptionReportPage() {
  const session = useSession()
  const {
    from, to, setFrom, setTo, groupBy, setGroupBy, groupOptions, validPeriod, loaded, backendReport,
    summary, days, rows, feedBars, option, reasonFor, loading, errorMessage, refetch, mayLackSources,
  } = useFeedConsumptionReport()
  const rowLabel = (row: { label: string; herdGroup: string | null }) => groupBy === 'HERD_GROUP'
    ? (row.herdGroup === 'Unknown' ? 'Chưa phân nhóm' : rationGroupLabel(row.label))
    : row.label
  const hasValidFeedingRecord = backendReport
    ? backendReport.rawRows.length > 0 || backendReport.rows.length > 0 || backendReport.total.kg > 0 || backendReport.total.headDays > 0
    : Boolean(loaded?.feedings.some((record) => record.status === 'VALID' && record.feedingDate >= from && record.feedingDate <= to))
  const showGroupedTable = rows.length > 0 && hasValidFeedingRecord
  const serverTotal = backendReport?.total
  const totalAverageHead = serverTotal
    ? serverTotal.days > 0 && serverTotal.headDays > 0 ? serverTotal.headDays / serverTotal.days : null
    : summary && summary.days > 0 && summary.headDays > 0 ? summary.headDays / summary.days : null
  const totalKg = serverTotal?.kg ?? summary?.actualKg ?? null
  const totalKgPerHeadDay = serverTotal?.kgPerHeadDay ?? summary?.averageKgPerHeadDay ?? null
  const totalCost = serverTotal?.cost ?? summary?.cost ?? null
  const totalCostPerHeadDay = serverTotal?.costPerHeadDay ?? summary?.averageCostPerHeadDay ?? null
  const costByFeedTotal = backendReport
    ? backendReport.total.cost
    : feedBars.length > 0 && feedBars.every((row) => row.totalCost !== null && row.totalCost !== undefined)
      ? feedBars.reduce((sum, row) => sum + (row.totalCost ?? 0), 0)
      : null
  const notesFor = (row: FeedConsumptionProjectionRow | FeedConsumptionServerRow) => {
    if ('notes' in row) return row.notes ?? []
    return [reasonFor(row)].filter((note): note is string => Boolean(note))
  }

  return (
    <Layout title="Thức ăn › Báo cáo" user="manager">
      <style>{`
        .feed-report-print .print-only { display: none; }
        @media print {
          @page { size: A4 landscape; margin: 12mm; }
          html, body { overflow: visible !important; background: #fff !important; }
          body * { visibility: hidden; }
          .feed-report-print, .feed-report-print * { visibility: visible; }
          .feed-report-print { position: static; width: auto; max-width: none; overflow: visible !important; color: #111; }
          .feed-report-print .no-print { display: none !important; }
          .feed-report-print .print-only { display: block; }
          .feed-report-print .print-section { break-inside: avoid; page-break-inside: avoid; }
          .feed-report-print .print-table > div { overflow: visible !important; }
          .feed-report-print .print-table table { width: 100% !important; table-layout: fixed; font-size: 9pt; }
          .feed-report-print .print-table th, .feed-report-print .print-table td { padding: 4pt 5pt; overflow-wrap: anywhere; }
          .feed-report-print .print-table thead { display: table-header-group; }
          .feed-report-print .print-table tfoot { display: table-footer-group; }
          .feed-report-print .print-table tr { break-inside: avoid; page-break-inside: avoid; }
          .feed-report-print .print-table th { background: #eef4ef !important; color: #183528 !important; }
          .feed-report-print .print-footer { display: flex; justify-content: space-between; margin-top: 8mm; border-top: 1px solid #b7c5bd; padding-top: 3mm; font-size: 8pt; color: #52635a; }
        }
      `}</style>
      <div className="feed-report-print flex flex-col gap-4">
        <header role="banner" className="print-only print-section border-b border-[#183528] pb-3" aria-label="Đầu trang báo cáo in">
          <div className="text-lg font-bold tracking-wide">BeefCare</div>
          <h1 className="m-0 mt-1 text-2xl font-bold">Báo cáo tiêu thụ &amp; chi phí thức ăn</h1>
          <dl className="mt-3 grid grid-cols-4 gap-x-6 gap-y-1 text-xs">
            <div><dt className="font-semibold text-muted">Trang trại</dt><dd className="m-0">{session?.farmName ?? '—'}</dd></div>
            <div><dt className="font-semibold text-muted">Kỳ báo cáo</dt><dd className="m-0">{localDate(from)} – {localDate(to)}</dd></div>
            <div><dt className="font-semibold text-muted">Nhóm theo</dt><dd className="m-0">{option.label}</dd></div>
            <div><dt className="font-semibold text-muted">Tạo lúc (giờ trại)</dt><dd className="m-0">{generatedAtLabel(backendReport?.generatedAt)}</dd></div>
          </dl>
        </header>

        <PageHeader title="Báo cáo tiêu thụ & chi phí thức ăn" sub="Tiêu thụ thực tế từ nhật ký cho ăn, chi phí theo giá nhập bình quân">
          <Button className="no-print" onClick={() => window.print()}><span className="inline-flex items-center gap-1.5"><Icon name="printer" size={16} />In báo cáo</span></Button>
        </PageHeader>
        <div className="no-print"><FeedManagementTabs /></div>
        {loaded?.source === 'backend' && <Note tone="info">Đang xem số liệu máy chủ. Chi phí lấy theo giá đã chốt ở từng cữ.</Note>}

        <section role="tabpanel" aria-label="Báo cáo tiêu thụ thức ăn" className="@container flex flex-col gap-4">
          <div className="no-print flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="feed-report-from" className="sr-only">Từ ngày</label>
              <DateInput id="feed-report-from" value={from} onChange={setFrom} className="w-[160px]" />
              <span aria-hidden="true" className="text-muted">–</span>
              <label htmlFor="feed-report-to" className="sr-only">Đến ngày</label>
              <DateInput id="feed-report-to" value={to} onChange={setTo} className="w-[160px]" />
            </div>
            <Segmented value={groupBy} onChange={(value) => setGroupBy(value as FeedConsumptionGroupBy)} options={groupOptions.map((item) => ({ value: item.value, label: item.label }))} />
          </div>
          {!validPeriod && <p role="alert" className="no-print m-0 text-xs text-err-fg">Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.</p>}

          {summary && (
            <div className="print-section grid grid-cols-1 gap-4 @min-[640px]:grid-cols-2 @min-[1024px]:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
              <Metric surface="panel" tone="emphasis" label="Tổng tiêu thụ" value={formatKg(summary.actualKg, 0)} sub={`${summary.days} ngày · ${formatNumber(summary.headDays, 0)} con-ngày`} />
              <Metric compact surface="panel" label="Chi phí thức ăn" value={summary.cost === null ? '—' : formatVnd(summary.cost)} sub={summary.cost === null ? 'Thiếu giá tại một hoặc nhiều cữ' : 'Theo giá nhập bình quân'} />
              <Metric compact surface="panel" label="Bình quân" value={summary.averageCostPerHeadDay === null ? '—' : `${formatNumber(summary.averageCostPerHeadDay, 0)} đ/con/ngày`} sub={summary.averageKgPerHeadDay === null ? '— kg/con/ngày' : `${formatNumber(summary.averageKgPerHeadDay)} kg/con/ngày`} />
              <Metric compact surface="panel" label="Nhập kho trong kỳ" value={formatKg(summary.receivedKg, 0)} sub={`${summary.receiptCount} phiếu · ${summary.receivedAmount === null ? '—' : formatVnd(summary.receivedAmount)}`} />
              {backendReport && <>
                <Metric compact surface="panel" label="Hao hụt điều chỉnh" value={backendReport.adjustmentLosses.kg == null ? '—' : formatKg(backendReport.adjustmentLosses.kg, 0)} sub="Tách riêng khỏi tiêu thụ" />
                <Metric compact surface="panel" label="Giá trị hao hụt" value={backendReport.adjustmentLosses.value == null ? '—' : formatVnd(backendReport.adjustmentLosses.value)} sub="Theo giá vốn tại thời điểm điều chỉnh" />
              </>}
            </div>
          )}

          {loading && <div role="status" className="rounded-2xl border border-field bg-white p-8 text-center text-sm text-muted">Đang tổng hợp báo cáo…</div>}
          {errorMessage && <div role="alert" className="no-print flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-err-bg bg-white p-4 text-sm text-err-fg"><span>{errorMessage}</span><Button size="sm" disabled={loading || !validPeriod} onClick={() => void refetch()}>Thử tải lại</Button></div>}
          {!loading && !errorMessage && validPeriod && !hasValidFeedingRecord && <Note tone="info">Không có bản ghi cho ăn VALID trong khoảng thời gian này.</Note>}
          {!loading && !errorMessage && validPeriod && hasValidFeedingRecord && !showGroupedTable && <Note tone="info">Không có dữ liệu tiêu thụ trong khoảng thời gian này.</Note>}

          {!loading && !errorMessage && showGroupedTable && (
            <Card variant="panel" title={option.title} sub="So với khẩu phần = (thực tế − kế hoạch) ÷ kế hoạch của các cữ đã ghi">
              <div className="print-table">
                <Table scroll={false} stack={false}>
                  <colgroup><col style={{ width: '16%' }} /><col style={{ width: '10%' }} /><col style={{ width: '12%' }} /><col style={{ width: '12%' }} /><col style={{ width: '13%' }} /><col style={{ width: '13%' }} /><col style={{ width: '12%' }} /><col style={{ width: '12%' }} /></colgroup>
                  <thead><tr><Th scope="col">{option.column}</Th><Th scope="col">Số con TB</Th><Th scope="col">Tiêu thụ (kg)</Th><Th scope="col">kg/con/ngày</Th><Th scope="col">Chi phí (VND)</Th><Th scope="col">VND/con/ngày</Th><Th scope="col">Chênh lệch so khẩu phần (%)</Th><Th scope="col">{backendReport ? 'Ghi chú máy chủ' : 'Ghi chú'}</Th></tr></thead>
                  <tbody>
                    {rows.map((row) => {
                      const averageHead = 'averageHead' in row ? row.averageHead : days > 0 && row.headDays > 0 ? row.headDays / days : null
                      const averageKg = 'averageKgPerHeadDay' in row ? row.averageKgPerHeadDay : row.headDays > 0 ? row.actualKg / row.headDays : null
                      const averageCost = 'averageCostPerHeadDay' in row ? row.averageCostPerHeadDay : row.totalCost !== null && row.headDays > 0 ? row.totalCost / row.headDays : null
                      const notes = notesFor(row)
                      const bad = row.varianceRatio !== null && row.varianceRatio <= -0.1
                      return (
                        <tr key={row.key}>
                          <Td className="font-medium">{rowLabel(row)}</Td><Td>{averageHead === null ? '—' : formatNumber(averageHead, 0)}</Td><Td>{formatKg(row.actualKg, 0)}</Td><Td>{averageKg === null ? '—' : `${formatNumber(averageKg)} kg`}</Td><Td>{money(row.totalCost)}</Td><Td>{averageCost === null ? '—' : `${formatNumber(averageCost, 0)} VND`}</Td><Td className={bad ? 'text-err-fg' : undefined}>{percent(row.varianceRatio)}</Td><Td>{notes.length ? notes.join(' · ') : '—'}</Td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot><tr><Td className="font-semibold">{backendReport ? 'Tổng máy chủ' : 'Tổng'}</Td><Td>{totalAverageHead === null ? '—' : formatNumber(totalAverageHead, 0)}</Td><Td>{totalKg === null ? '—' : formatKg(totalKg, 0)}</Td><Td>{totalKgPerHeadDay === null ? '—' : `${formatNumber(totalKgPerHeadDay)} kg`}</Td><Td>{money(totalCost)}</Td><Td>{totalCostPerHeadDay === null ? '—' : `${formatNumber(totalCostPerHeadDay, 0)} VND`}</Td><Td>—</Td><Td>—</Td></tr></tfoot>
                </Table>
              </div>
            </Card>
          )}

          {!loading && !errorMessage && showGroupedTable && (
            <div className="print-section grid items-start gap-4 @min-[1024px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] @min-[1024px]:gap-6">
              <Card variant="panel" title="Chi phí theo thức ăn">
                <div className="print-table">
                  <Table scroll={false} stack={false}>
                    <colgroup><col style={{ width: '45%' }} /><col style={{ width: '25%' }} /><col style={{ width: '30%' }} /></colgroup>
                    <thead><tr><Th scope="col">Mặt hàng</Th><Th scope="col">Tiêu thụ (kg)</Th><Th scope="col">Chi phí (VND)</Th></tr></thead>
                    <tbody>{feedBars.map((row) => <tr key={row.key}><Td className="font-medium">{row.label}</Td><Td>{formatKg(row.kg, 0)}</Td><Td>{money(row.totalCost)}</Td></tr>)}</tbody>
                    <tfoot><tr><Td className="font-semibold">Tổng</Td><Td>{formatKg(feedBars.reduce((sum, row) => sum + row.kg, 0), 0)}</Td><Td>{money(costByFeedTotal)}</Td></tr></tfoot>
                  </Table>
                </div>
              </Card>
              <Card variant="panel" title="Cách tính">
                <ul className="m-0 flex list-none flex-col gap-2 p-0 text-xs text-[#183528]"><li>Chi phí = lượng thực tế đã ghi trong nhật ký × giá nhập bình quân gia quyền của thức ăn tại thời điểm ghi.</li><li>Số con TB = trung bình số con có mặt mỗi ngày trong kỳ (theo phân chuồng).</li><li>So với khẩu phần = (thực tế − kế hoạch) ÷ kế hoạch của các cữ đã ghi.</li><li>Hao hụt từ điều chỉnh kho được theo dõi riêng, không tính vào chi phí theo nhóm đàn.</li></ul>
              </Card>
            </div>
          )}

          {!loading && !errorMessage && backendReport && (
            <section className="print-section" aria-labelledby="feed-adjustment-loss-title">
              <Card variant="panel" title={<span id="feed-adjustment-loss-title">Hao hụt điều chỉnh kho</span>} sub="Tách riêng khỏi tiêu thụ và không phân bổ vào nhóm đàn">
                <div className="print-table"><Table scroll={false} stack={false}><thead><tr><Th scope="col">Chỉ tiêu</Th><Th scope="col">Giá trị</Th><Th scope="col">Nguồn</Th></tr></thead><tbody><tr><Td>Hao hụt (kg)</Td><Td>{backendReport.adjustmentLosses.kg == null ? '—' : formatKg(backendReport.adjustmentLosses.kg, 0)}</Td><Td>Điều chỉnh kho đã ghi sổ</Td></tr><tr><Td>Giá trị hao hụt (VND)</Td><Td>{money(backendReport.adjustmentLosses.value)}</Td><Td>Giá vốn tại thời điểm điều chỉnh</Td></tr></tbody></Table></div>
              </Card>
            </section>
          )}
          {mayLackSources && !loaded && <Note tone="grey">Một số trường hợp thiếu nguồn số liệu sẽ hiển thị “—”.</Note>}
        </section>
        <Foot>{FOOT}</Foot>
        <footer className="print-only print-footer"><span>BeefCare · Báo cáo tiêu thụ &amp; chi phí thức ăn</span><span>Trang in · {session?.farmName ?? '—'}</span></footer>
      </div>
    </Layout>
  )
}
