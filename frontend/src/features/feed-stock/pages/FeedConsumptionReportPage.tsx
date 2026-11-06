import { useMemo, useState } from 'react'
import Layout from '../../../components/Layout'
import { Icon } from '../../../components/Icon'
import { Button, Card, DateInput, Foot, Metric, Note, PageHeader, Segmented, Table, Td, Th } from '../../../components/ui'
import { backendMode } from '../../../api/backendTransport'
import { userFacingError } from '../../../api/userFacingError'
import { useQuery } from '../../../hooks/useApi'
import { loadFeedConsumptionReport } from '../api/feedConsumptionApi'
import { buildFeedConsumptionReport, filterFeedConsumptionReport, summarizeFeedConsumptionReport } from '../data/feedConsumptionReport'
import { rationGroupLabel } from '../data/feedRationForm'
import { daysFromToday } from '../data/feedDemoDates'
import { formatKg, formatNumber, formatShortDate, formatVnd } from '../domain/feedLabels'
import FeedManagementTabs from '../components/FeedManagementTabs'
import type { FeedConsumptionGroupBy, FeedConsumptionProjectionRow } from '../types/feedConsumption'

const GROUP_BY: Array<{ value: FeedConsumptionGroupBy; label: string; title: string; column: string }> = [
  { value: 'HERD_GROUP', label: 'Theo nhóm đàn', title: 'Theo nhóm đàn', column: 'Nhóm đàn' },
  { value: 'PEN', label: 'Theo chuồng', title: 'Theo chuồng', column: 'Chuồng' },
  { value: 'FEED', label: 'Theo thức ăn', title: 'Theo thức ăn', column: 'Thức ăn' },
]
const HERD_ORDER = ['BREEDING_FEMALES', 'FATTENING', 'BREEDING_BULLS', 'CALVES', 'YOUNG_STOCK', 'OTHER']
const FOOT = 'Báo cáo tiêu thụ và chi phí thức ăn theo kỳ (Chủ trại, Quản lý). Đổi cách xem theo nhóm đàn, chuồng hoặc thức ăn; nhóm lệch khẩu phần nhiều được tô đỏ kèm lý do. “In báo cáo” xuất bản in PDF.'

const dateValue = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

/** SRS GBR-66: month start to today. The local demo has 3 weeks of history, so it opens on the last 22 days instead. */
function initialPeriod() {
  const today = new Date()
  if (backendMode === 'local') return { from: daysFromToday(-21), to: daysFromToday(0) }
  return { from: dateValue(new Date(today.getFullYear(), today.getMonth(), 1)), to: dateValue(today) }
}

function calendarDays(from: string, to: string) {
  const start = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T00:00:00`)
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) return 0
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1
}

const currency = (value: number | null) => value === null ? '—' : formatNumber(value, 0)
const oneDecimal = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
function percent(value: number | null) {
  if (value === null) return '—'
  const text = oneDecimal.format(Math.abs(value) * 100)
  return `${text === '0,0' ? '' : value > 0 ? '+' : '−'}${text}%`
}

export default function FeedConsumptionReportPage() {
  const period = useMemo(initialPeriod, [])
  const [from, setFrom] = useState(period.from)
  const [to, setTo] = useState(period.to)
  const [groupBy, setGroupBy] = useState<FeedConsumptionGroupBy>('HERD_GROUP')
  const validPeriod = Boolean(from && to && from <= to)
  const query = useQuery(async () => {
    if (!validPeriod) return { from, to, data: null }
    return { from, to, data: await loadFeedConsumptionReport({ from, to }) }
  }, [from, to])
  const loaded = query.data?.from === from && query.data?.to === to ? query.data.data : null
  const report = useMemo(() => loaded ? buildFeedConsumptionReport({ ...loaded, from, to, backendReport: loaded.backendReport }) : null, [from, loaded, to])
  const projection = useMemo(() => report ? filterFeedConsumptionReport(report, { from, to, groupBy }, loaded?.catalogue ?? []) : null, [from, groupBy, loaded?.catalogue, report, to])
  const costByFeed = useMemo(() => report ? filterFeedConsumptionReport(report, { from, to, groupBy: 'FEED' }, loaded?.catalogue ?? []) : null, [from, loaded?.catalogue, report, to])
  const summary = projection ? summarizeFeedConsumptionReport(projection) : null
  const error = query.error ? userFacingError(query.error, 'Không thể tải báo cáo tiêu thụ thức ăn.') : null
  const days = calendarDays(from, to)
  const loading = query.loading && !loaded
  const option = GROUP_BY.find((item) => item.value === groupBy) ?? GROUP_BY[0]

  const rows = useMemo(() => {
    const list = [...(projection?.rows ?? [])]
    if (groupBy === 'HERD_GROUP') list.sort((a, b) => (HERD_ORDER.indexOf(a.herdGroup ?? '') + 1 || 99) - (HERD_ORDER.indexOf(b.herdGroup ?? '') + 1 || 99))
    else if (groupBy === 'FEED') list.sort((a, b) => (b.totalCost ?? 0) - (a.totalCost ?? 0))
    return list
  }, [groupBy, projection])
  const feedBars = useMemo(() => [...(costByFeed?.rows ?? [])].sort((a, b) => (b.totalCost ?? 0) - (a.totalCost ?? 0)), [costByFeed])
  const maxCost = Math.max(1, ...feedBars.map((row) => row.totalCost ?? 0))
  const rowLabel = (row: FeedConsumptionProjectionRow) => groupBy === 'HERD_GROUP' ? (row.herdGroup === 'Unknown' ? 'Chưa phân nhóm' : rationGroupLabel(row.label)) : row.label
  // Reason shown under a strongly negative variance: the first day a planned feed was recorded as 0 because it was out of stock.
  const reasonFor = (row: FeedConsumptionProjectionRow) => {
    if (row.varianceRatio === null || row.varianceRatio > -0.1) return null
    const first = (projection?.feedings ?? [])
      .filter((record) => (row.penId === null || record.penId === row.penId) && record.lines.some((line) => line.plannedKg > 0 && line.actualKg === 0))
      .map((record) => ({ date: record.feedingDate, line: record.lines.find((line) => line.plannedKg > 0 && line.actualKg === 0), group: record.rationCode }))
      .sort((a, b) => a.date.localeCompare(b.date))
    const match = groupBy === 'HERD_GROUP' ? first.filter((item) => report?.rations.find((ration) => ration.rationCode === item.group)?.herdGroup === row.herdGroup) : first
    const earliest = match[0]
    return earliest?.line ? `${earliest.line.feedName ?? earliest.line.feedCode} hết kho từ ${formatShortDate(earliest.date)}` : null
  }

  return (
    <Layout title="Thức ăn › Báo cáo" user="manager">
      <style>{`@media print { body * { visibility: hidden; } .feed-report-print, .feed-report-print * { visibility: visible; } .feed-report-print { position: absolute; inset: 0 auto auto 0; width: 100%; } .feed-report-print .no-print { display: none !important; } }`}</style>
      <div className="feed-report-print flex flex-col gap-4">
        <PageHeader title="Báo cáo tiêu thụ & chi phí thức ăn" sub="Tiêu thụ thực tế từ nhật ký cho ăn, chi phí theo giá nhập bình quân">
          <Button className="no-print" onClick={() => window.print()}><span className="inline-flex items-center gap-1.5"><Icon name="printer" size={16} />In báo cáo</span></Button>
        </PageHeader>
        <div className="no-print"><FeedManagementTabs /></div>
        {loaded?.source === 'backend' && <Note tone="info">Đang xem số liệu máy chủ. Chi phí lấy theo giá đã chốt ở từng cữ.</Note>}

        <section role="tabpanel" aria-label="Báo cáo tiêu thụ thức ăn" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="feed-report-from" className="sr-only">Từ ngày</label>
              <DateInput id="feed-report-from" value={from} onChange={setFrom} className="w-[160px]" />
              <span aria-hidden="true" className="text-muted">–</span>
              <label htmlFor="feed-report-to" className="sr-only">Đến ngày</label>
              <DateInput id="feed-report-to" value={to} onChange={setTo} className="w-[160px]" />
            </div>
            <Segmented value={groupBy} onChange={(value) => setGroupBy(value as FeedConsumptionGroupBy)} options={GROUP_BY.map((item) => ({ value: item.value, label: item.label }))} />
          </div>
          {!validPeriod && <p role="alert" className="m-0 text-xs text-err-fg">Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.</p>}

          {summary && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Metric compact label="Tổng tiêu thụ" value={formatKg(summary.actualKg, 0)} sub={`${summary.days} ngày · ${formatNumber(summary.headDays, 0)} con-ngày`} />
              <Metric compact label="Chi phí thức ăn" value={summary.cost === null ? '—' : formatVnd(summary.cost)} sub={summary.cost === null ? 'Thiếu giá tại một hoặc nhiều cữ' : 'Theo giá nhập bình quân'} />
              <Metric compact label="Bình quân" value={summary.averageCostPerHeadDay === null ? '—' : `${formatNumber(summary.averageCostPerHeadDay, 0)} đ/con/ngày`} sub={summary.averageKgPerHeadDay === null ? '— kg/con/ngày' : `${formatNumber(summary.averageKgPerHeadDay)} kg/con/ngày`} />
              <Metric compact label="Nhập kho trong kỳ" value={formatKg(summary.receivedKg, 0)} sub={`${summary.receiptCount} phiếu · ${summary.receivedAmount === null ? '—' : formatVnd(summary.receivedAmount)}`} />
            </div>
          )}

          {loading && <div role="status" className="rounded-md border border-edge bg-white p-8 text-center text-sm text-muted">Đang tổng hợp báo cáo…</div>}
          {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-err-bg bg-white p-4 text-sm text-err-fg"><span>{error}</span><Button size="sm" disabled={query.loading || !validPeriod} onClick={() => query.refetch()}>Thử tải lại</Button></div>}
          {!loading && !error && validPeriod && projection && projection.rows.length === 0 && <Note tone="info">Không có dữ liệu tiêu thụ trong khoảng thời gian này.</Note>}

          {!loading && !error && projection && projection.rows.length > 0 && (
            <Card title={option.title} sub="So với khẩu phần = (thực tế − kế hoạch) ÷ kế hoạch của các cữ đã ghi">
              <Table scroll stack={false}>
                <thead><tr><Th>{option.column}</Th><Th>Số con TB</Th><Th>Tiêu thụ (kg)</Th><Th>kg/con/ngày</Th><Th>Chi phí (đ)</Th><Th>đ/con/ngày</Th><Th>So với khẩu phần</Th></tr></thead>
                <tbody>
                  {rows.map((row) => {
                    const averageHead = days > 0 && row.headDays > 0 ? row.headDays / days : null
                    const averageKg = row.headDays > 0 ? row.actualKg / row.headDays : null
                    const averageCost = row.totalCost !== null && row.headDays > 0 ? row.totalCost / row.headDays : null
                    const reason = reasonFor(row)
                    const bad = row.varianceRatio !== null && row.varianceRatio <= -0.1
                    return (
                      <tr key={row.key}>
                        <Td className="whitespace-nowrap font-medium">{rowLabel(row)}</Td>
                        <Td className="whitespace-nowrap">{averageHead === null ? '—' : formatNumber(averageHead, 0)}</Td>
                        <Td className="whitespace-nowrap">{formatNumber(row.actualKg, 0)}</Td>
                        <Td className="whitespace-nowrap">{averageKg === null ? '—' : formatNumber(averageKg)}</Td>
                        <Td className="whitespace-nowrap">{currency(row.totalCost)}</Td>
                        <Td className="whitespace-nowrap">{currency(averageCost)}</Td>
                        <Td className={bad ? 'text-err-fg' : undefined}>
                          <div className={`whitespace-nowrap ${bad ? 'font-medium' : ''}`}>{percent(row.varianceRatio)}</div>
                          {reason && <div className="text-[11px]">{reason}</div>}
                        </Td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <Td className="font-semibold">Tổng</Td>
                    <Td className="whitespace-nowrap font-semibold">{days > 0 && projection.headDays > 0 ? formatNumber(projection.headDays / days, 0) : '—'}</Td>
                    <Td className="whitespace-nowrap font-semibold">{formatNumber(summary?.actualKg ?? 0, 0)}</Td>
                    <Td className="whitespace-nowrap font-semibold">{summary?.averageKgPerHeadDay == null ? '—' : formatNumber(summary.averageKgPerHeadDay)}</Td>
                    <Td className="whitespace-nowrap font-semibold">{currency(summary?.cost ?? null)}</Td>
                    <Td className="whitespace-nowrap font-semibold">{currency(summary?.averageCostPerHeadDay ?? null)}</Td>
                    <Td />
                  </tr>
                </tfoot>
              </Table>
            </Card>
          )}

          {!loading && !error && projection && projection.rows.length > 0 && (
            <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,660px)_minmax(0,436px)]">
              <Card title="Chi phí theo thức ăn">
                <div className="flex flex-col gap-3">
                  {feedBars.map((row) => (
                    <div key={row.key} className="flex items-center gap-3 text-xs">
                      <span className="w-[140px] shrink-0">{row.label}</span>
                      <span className="h-3 min-w-0 flex-1 overflow-hidden rounded-[3px] bg-chip"><span className="block h-full rounded-[3px] bg-brand" style={{ width: `${Math.round(((row.totalCost ?? 0) / maxCost) * 100)}%` }} /></span>
                      <span className="w-[110px] shrink-0 whitespace-nowrap text-right font-medium">{row.totalCost === null ? '—' : formatVnd(row.totalCost)}</span>
                    </div>
                  ))}
                </div>
              </Card>
              <Card title="Cách tính">
                <ul className="m-0 flex list-none flex-col gap-2 p-0 text-xs text-[#183528]">
                  {[
                    'Chi phí = lượng thực tế đã ghi trong nhật ký × giá nhập bình quân gia quyền của thức ăn tại thời điểm ghi.',
                    'Số con TB = trung bình số con có mặt mỗi ngày trong kỳ (theo phân chuồng).',
                    'So với khẩu phần = (thực tế − kế hoạch) ÷ kế hoạch của các cữ đã ghi.',
                    projection.adjustmentLossValue ? `Hao hụt từ phiếu điều chỉnh kho (−${formatNumber(projection.adjustmentLossValue, 0)} đ) không tính vào chi phí theo nhóm đàn.` : 'Hao hụt từ phiếu điều chỉnh kho được theo dõi riêng, không tính vào chi phí theo nhóm đàn.',
                  ].map((text) => <li key={text} className="flex gap-2"><span aria-hidden="true" className="text-muted">•</span><span>{text}</span></li>)}
                </ul>
              </Card>
            </div>
          )}
          {backendMode === 'backend' && !loaded && <Note tone="grey">Một số trường hợp thiếu nguồn số liệu sẽ hiển thị “—”.</Note>}
        </section>
        <Foot>{FOOT}</Foot>
      </div>
    </Layout>
  )
}
