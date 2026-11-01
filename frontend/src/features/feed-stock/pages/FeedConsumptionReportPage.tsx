import { useMemo, useState } from 'react'
import Layout from '../../../components/Layout'
import { Badge, Button, Card, Field, Note, PageHeader, Select, Table, Td, Th, Tile, inputCls } from '../../../components/ui'
import { backendMode } from '../../../api/backendTransport'
import { userFacingError } from '../../../api/userFacingError'
import { useQuery } from '../../../hooks/useApi'
import { loadFeedConsumptionReport } from '../api/feedConsumptionApi'
import { buildFeedConsumptionReport, filterFeedConsumptionReport, summarizeFeedConsumptionReport } from '../data/feedConsumptionReport'
import FeedManagementTabs from '../components/FeedManagementTabs'
import type { FeedConsumptionGroupBy } from '../types/feedConsumption'

const quantity = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 })
const money = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 })
const groupByOptions: Array<{ value: FeedConsumptionGroupBy; label: string }> = [
  { value: 'HERD_GROUP', label: 'Nhóm đàn' },
  { value: 'PEN', label: 'Chuồng' },
  { value: 'FEED', label: 'Thức ăn' },
]

function dateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function initialPeriod() {
  const today = new Date()
  return { from: dateValue(new Date(today.getFullYear(), today.getMonth(), 1)), to: dateValue(today) }
}

function calendarDays(from: string, to: string) {
  const start = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T00:00:00`)
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) return 0
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1
}

function currency(value: number | null) {
  return value === null ? '—' : `${money.format(value)} đ`
}

function percent(value: number | null) {
  return value === null ? '—' : `${value > 0 ? '+' : ''}${(value * 100).toFixed(1)}%`
}

export default function FeedConsumptionReportPage() {
  const period = useMemo(initialPeriod, [])
  const [from, setFrom] = useState(period.from)
  const [to, setTo] = useState(period.to)
  const [feedFilter, setFeedFilter] = useState('ALL')
  const [penFilter, setPenFilter] = useState('ALL')
  const [groupFilter, setGroupFilter] = useState('ALL')
  const [groupBy, setGroupBy] = useState<FeedConsumptionGroupBy>('HERD_GROUP')
  const validPeriod = Boolean(from && to && from <= to)
  const query = useQuery(async () => {
    if (!validPeriod) return { from, to, data: null }
    return { from, to, data: await loadFeedConsumptionReport({ from, to }) }
  }, [from, to])
  const loaded = query.data?.from === from && query.data?.to === to ? query.data.data : null
  const report = useMemo(() => loaded ? buildFeedConsumptionReport({
    ...loaded,
    from,
    to,
    backendReport: loaded.backendReport,
  }) : null, [from, loaded, to])
  const filterFeedId = feedFilter === 'ALL' ? 'ALL' : Number(feedFilter)
  const projection = useMemo(() => report ? filterFeedConsumptionReport(report, {
    from,
    to,
    groupBy,
    feedItemId: filterFeedId,
    penId: penFilter === 'ALL' ? 'ALL' : Number(penFilter),
    herdGroup: groupFilter,
  }, loaded?.catalogue ?? []) : null, [feedFilter, from, groupBy, groupFilter, loaded?.catalogue, penFilter, report, to])
  const costByFeed = useMemo(() => report ? filterFeedConsumptionReport(report, {
    from,
    to,
    groupBy: 'FEED',
    feedItemId: filterFeedId,
    penId: penFilter === 'ALL' ? 'ALL' : Number(penFilter),
    herdGroup: groupFilter,
  }, loaded?.catalogue ?? []) : null, [feedFilter, from, groupFilter, loaded?.catalogue, penFilter, report, to])
  const summary = projection ? summarizeFeedConsumptionReport(projection, filterFeedId) : null
  const error = query.error ? userFacingError(query.error, 'Không thể tải báo cáo tiêu thụ thức ăn.') : null
  const reportRows = report?.baseRows ?? []
  const feedOptions = (loaded?.catalogue ?? []).filter((item) => reportRows.some((row) => row.feedItemId === item.id))
    .sort((left, right) => left.name.localeCompare(right.name))
  const penOptions = [...new Map((loaded?.feedings ?? []).filter((record) => record.status === 'VALID')
    .map((record) => [record.penId, { id: record.penId, code: record.penCode || `Chuồng ${record.penId}`, name: record.penName || '' }])).values()]
    .sort((left, right) => left.code.localeCompare(right.code))
  const groupOptions = [...new Set(reportRows.map((row) => row.herdGroup))].sort((left, right) => left.localeCompare(right))
  const numberOfCalendarDays = calendarDays(from, to)
  const loading = query.loading && !loaded

  return (
    <Layout title="Thức ăn – Báo cáo tiêu thụ" user="manager">
      <style>{`@media print { body * { visibility: hidden; } .feed-report-print, .feed-report-print * { visibility: visible; } .feed-report-print { position: absolute; inset: 0 auto auto 0; width: 100%; } .feed-report-print .no-print { display: none !important; } }`}</style>
      <div className="feed-report-print flex flex-col gap-5">
        <PageHeader title="Báo cáo tiêu thụ & chi phí thức ăn" sub="Tổng hợp lượng cho ăn thực tế, giá trị ghi nhận tại từng cữ và phiếu nhập trong kỳ.">
          <Button className="no-print" onClick={() => window.print()}>In báo cáo</Button>
        </PageHeader>
        {loaded?.source === 'demo' && <Badge tone="info">Dữ liệu minh họa</Badge>}
        <div className="no-print"><FeedManagementTabs /></div>
        {loaded?.source === 'backend' && <Note tone="info">Đang xem số liệu máy chủ. Chi phí lấy theo giá đã chốt ở từng cữ; báo cáo không tự thay bằng dữ liệu minh họa.</Note>}

        <section role="tabpanel" aria-label="Báo cáo tiêu thụ thức ăn" className="flex flex-col gap-5">
          <Card title="Khoảng thời gian và bộ lọc">
            <div className="flex flex-wrap items-end gap-3">
              <Field id="feed-report-from" label="Từ ngày">
                <input id="feed-report-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} className={inputCls} />
              </Field>
              <Field id="feed-report-to" label="Đến ngày">
                <input id="feed-report-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} className={inputCls} />
              </Field>
              <Field id="feed-report-feed" label="Thức ăn">
                <Select id="feed-report-feed" value={feedFilter} onChange={(event) => setFeedFilter(event.target.value)} className="min-w-[190px]">
                  <option value="ALL">Tất cả thức ăn</option>
                  {feedOptions.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
                </Select>
              </Field>
              <Field id="feed-report-pen" label="Chuồng">
                <Select id="feed-report-pen" value={penFilter} onChange={(event) => setPenFilter(event.target.value)} className="min-w-[170px]">
                  <option value="ALL">Tất cả chuồng</option>
                  {penOptions.map((pen) => <option key={pen.id} value={pen.id}>{pen.code}{pen.name ? ` · ${pen.name}` : ''}</option>)}
                </Select>
              </Field>
              <Field id="feed-report-herd-group" label="Nhóm đàn">
                <Select id="feed-report-herd-group" value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)} className="min-w-[170px]">
                  <option value="ALL">Tất cả nhóm</option>
                  {groupOptions.map((group) => <option key={group} value={group}>{group === 'Unknown' ? 'Chưa phân nhóm' : group}</option>)}
                </Select>
              </Field>
              <Field id="feed-report-group-by" label="Gộp theo">
                <Select id="feed-report-group-by" value={groupBy} onChange={(event) => setGroupBy(event.target.value as FeedConsumptionGroupBy)}>
                  {groupByOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </Select>
              </Field>
            </div>
            {!validPeriod && <p role="alert" className="mb-0 text-xs text-err-fg">Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.</p>}
            {validPeriod && <p className="mb-0 text-xs text-muted">Số ngày trong kỳ: {numberOfCalendarDays}</p>}
          </Card>

          {summary && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Tile label="Lượng thức ăn thực tế" value={`${quantity.format(summary.actualKg)} kg`} note={`${summary.days} ngày có ghi · ${summary.actualKg > 0 && summary.headDays === 0 ? '—' : quantity.format(summary.headDays)} con-ngày`} />
            <Tile label="Chi phí thức ăn" value={currency(summary.cost)} note={summary.cost === null ? 'Thiếu giá tại một hoặc nhiều cữ' : 'Theo giá ghi nhận tại từng cữ'} />
            <Tile label="Bình quân mỗi con mỗi ngày" value={`${summary.averageKgPerHeadDay === null ? '—' : `${quantity.format(summary.averageKgPerHeadDay)} kg`}`} note={`${summary.averageCostPerHeadDay === null ? '—' : currency(summary.averageCostPerHeadDay)} / con / ngày`} />
            <Tile label="Đã nhập trong kỳ" value={`${quantity.format(summary.receivedKg)} kg`} note={`${summary.receiptCount} phiếu · ${currency(summary.receivedAmount)}${summary.receivedAmountIsGoodsOnly ? ' tiền hàng đã lọc' : ''} · không theo chuồng/nhóm`} />
          </div>}

          {loading && <div role="status" className="rounded-md border border-edge bg-white p-8 text-center text-sm text-muted">Đang tổng hợp báo cáo…</div>}
          {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-err-bg bg-white p-4 text-sm text-err-fg"><span>{error}</span><Button size="sm" disabled={query.loading || !validPeriod} onClick={() => query.refetch()}>Thử tải lại</Button></div>}
          {!loading && !error && validPeriod && projection && projection.rows.length === 0 && <Note tone="info">Không có dữ liệu tiêu thụ trong khoảng thời gian và bộ lọc này.</Note>}
          {!loading && !error && projection && projection.rows.length > 0 && (
            <Card title="Tiêu thụ và chi phí theo nhóm" sub="Số liệu thực tế lấy từ các cữ hợp lệ; tỷ lệ chênh lệch = (thực tế − kế hoạch) / kế hoạch.">
              <Table scroll>
                <thead><tr><Th>{groupByOptions.find((option) => option.value === groupBy)?.label}</Th><Th>Con bình quân</Th><Th>Thực tế (kg)</Th><Th>Kg / con / ngày</Th><Th>Chi phí (đ)</Th><Th>Đ / con / ngày</Th><Th>So với kế hoạch</Th></tr></thead>
                <tbody>{projection.rows.map((row) => {
                  const averageHead = numberOfCalendarDays > 0 && row.headDays > 0 ? row.headDays / numberOfCalendarDays : null
                  const averageKg = row.headDays > 0 ? row.actualKg / row.headDays : null
                  const averageCost = row.totalCost !== null && row.headDays > 0 ? row.totalCost / row.headDays : null
                  return <tr key={row.key}>
                    <Td><strong>{row.label}</strong></Td>
                    <Td>{averageHead === null ? '—' : quantity.format(averageHead)}</Td>
                    <Td>{quantity.format(row.actualKg)}</Td>
                    <Td>{averageKg === null ? '—' : quantity.format(averageKg)}</Td>
                    <Td>{currency(row.totalCost)}</Td>
                    <Td>{currency(averageCost)}</Td>
                    <Td>{percent(row.varianceRatio)}</Td>
                  </tr>
                })}</tbody>
                <tfoot><tr className="bg-chip font-semibold"><Td>Tổng</Td><Td>{numberOfCalendarDays > 0 && projection.headDays > 0 ? quantity.format(projection.headDays / numberOfCalendarDays) : '—'}</Td><Td>{quantity.format(summary?.actualKg ?? 0)}</Td><Td>{summary?.averageKgPerHeadDay === null || !summary ? '—' : quantity.format(summary.averageKgPerHeadDay)}</Td><Td>{currency(summary?.cost ?? null)}</Td><Td>{currency(summary?.averageCostPerHeadDay ?? null)}</Td><Td>{percent(summary && summary.plannedKg > 0 ? (summary.actualKg - summary.plannedKg) / summary.plannedKg : null)}</Td></tr></tfoot>
              </Table>
            </Card>
          )}
          {!loading && !error && costByFeed && costByFeed.rows.length > 0 && (
            <Card title="Chi phí theo thức ăn" sub="Giá trị được tổng hợp từ các cữ hợp lệ trong kỳ và bộ lọc hiện tại.">
              <Table scroll>
                <thead><tr><Th>Thức ăn</Th><Th>Tiêu thụ (kg)</Th><Th>Chi phí (đ)</Th></tr></thead>
                <tbody>{costByFeed.rows.map((row) => {
                  const feed = loaded?.catalogue.find((item) => item.id === row.feedItemId)
                  return <tr key={row.key}><Td><strong>{feed?.code ? `${feed.code} · ` : ''}{row.label}</strong></Td><Td>{quantity.format(row.actualKg)}</Td><Td>{currency(row.totalCost)}</Td></tr>
                })}</tbody>
              </Table>
            </Card>
          )}
          {loaded && (projection?.adjustmentLossKg || 0) > 0 && <Note tone="warn">Tổn thất kiểm kê trong kỳ: {quantity.format(projection?.adjustmentLossKg ?? 0)} kg · {currency(projection?.adjustmentLossValue ?? null)}. Khoản này được theo dõi riêng, không phân bổ theo chuồng hoặc nhóm đàn.</Note>}
          {loaded && loaded.source === 'demo' && <Note tone="info">Dữ liệu minh họa được lưu trong trình duyệt. Phiếu nhập chỉ tổng hợp phiếu đã ghi nhận; chi phí tiêu thụ lấy từ giá tại thời điểm ghi cữ. Các dòng chưa có giá sẽ hiện “—”.</Note>}
          {loaded && <Note tone="info">Bình quân đầu con dùng số ghi trong nhật ký và chỉ tính một lần mỗi chuồng/ngày để tránh lặp giữa nhiều cữ; nếu thiếu nhật ký đầu con, chỉ số bình quân hiện “—”. Phiếu nhập chỉ lọc theo mặt hàng, không phân bổ theo chuồng hoặc nhóm đàn; khi lọc mặt hàng, số tiền chỉ gồm tiền hàng vì phí vận chuyển không được chia theo mặt hàng.</Note>}
          {backendMode === 'backend' && !loaded && <Note tone="grey">Một số trường hợp thiếu nguồn số liệu sẽ hiển thị “—”.</Note>}
        </section>
      </div>
    </Layout>
  )
}
