import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { Badge, Button, Note, PageHeader, Select, Table, Td, Th, Tile, inputCls } from '../../../components/ui'
import { backendMode } from '../../../api/backendTransport'
import { userFacingError } from '../../../api/userFacingError'
import { useQuery } from '../../../hooks/useApi'
import { listFeedRationPens, listFeedRations } from '../api/feedRationApi'
import { filterFeedRations, summarizeFeedRations, type FeedRationStatusFilter } from '../data/feedRationMock'
import { rationGroupLabel } from '../data/feedRationForm'
import type { FeedRation } from '../types/feedRation'
import FeedManagementTabs from '../components/FeedManagementTabs'

const quantity = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 })
const currency = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 })
const STATUS_LABELS: Record<string, string> = { EFFECTIVE: 'Đang áp dụng', SCHEDULED: 'Sắp áp dụng', ENDED: 'Đã kết thúc' }
const STATUS_FILTERS: Array<{ value: FeedRationStatusFilter; label: string }> = [
  { value: 'CURRENT', label: 'Hiệu lực & sắp áp dụng' },
  { value: 'ENDED', label: 'Đã kết thúc' },
  { value: 'ALL', label: 'Tất cả' },
]

function rationHeadcount(row: FeedRation, pens: Awaited<ReturnType<typeof listFeedRationPens>>) {
  return row.penIds.reduce((sum, id) => sum + (pens.find((pen) => pen.id === id)?.headcount ?? 0), 0)
}

function rationDailyKg(row: FeedRation) {
  return row.components.reduce((sum, component) => sum + component.dailyKg, 0)
}

function rationDailyCost(row: FeedRation) {
  return row.components.every((component) => component.estimatedDailyCost !== null)
    ? row.components.reduce((sum, component) => sum + (component.estimatedDailyCost ?? 0), 0)
    : null
}

export default function FeedRationPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const query = useQuery(async () => {
    const [rows, pens] = await Promise.all([listFeedRations(), listFeedRationPens()])
    return { rows, pens }
  }, [])
  const [status, setStatus] = useState<FeedRationStatusFilter>('CURRENT')
  const [queryText, setQueryText] = useState('')
  const [herdGroup, setHerdGroup] = useState('ALL')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const routeMessage = typeof location.state === 'object' && location.state !== null && 'rationMessage' in location.state
    ? String((location.state as { rationMessage?: unknown }).rationMessage ?? '')
    : ''
  const rows = query.data?.rows ?? []
  const pens = query.data?.pens ?? []
  const groups = useMemo(() => [...new Set(rows.map((row) => row.herdGroup).filter(Boolean))].sort(), [rows])
  const summary = useMemo(() => summarizeFeedRations(rows, pens), [rows, pens])
  const visibleRows = useMemo(() => filterFeedRations(rows, {
    query: queryText,
    status,
    herdGroup,
    from,
    to,
  }), [rows, queryText, status, herdGroup, from, to])
  const error = query.error ? userFacingError(query.error, 'Không thể tải danh sách khẩu phần. Vui lòng thử lại.') : null

  return (
    <Layout title="Thức ăn – Khẩu phần" user="manager">
      <PageHeader title="Danh sách khẩu phần" sub="Theo dõi khẩu phần theo chuồng, nhóm đàn và thời gian áp dụng.">
        <Button variant="primary" onClick={() => navigate('/thuc-an/khau-phan/moi')}>Tạo khẩu phần</Button>
      </PageHeader>
      {backendMode === 'local' && <Badge tone="info">Dữ liệu minh họa</Badge>}
      <FeedManagementTabs />
      {routeMessage && <Note tone="ok">{routeMessage}</Note>}
      {backendMode === 'backend' && <Note tone="warn">Lưu phiên bản mới hiện chỉ hoạt động trong bản demo.</Note>}

      <section role="tabpanel" aria-label="Danh sách khẩu phần" className="flex flex-col gap-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Tile label="Khẩu phần đang áp dụng" value={query.data ? summary.effectiveRations : '—'} note={query.data ? `${summary.pensCovered} chuồng · ${summary.headCovered} con` : 'Chưa tải dữ liệu'} />
          <Tile label="Lượng dự kiến mỗi ngày" value={query.data ? `${quantity.format(summary.plannedDailyKg)} kg` : '—'} note={summary.plannedKgPerHead === null ? '— kg/đầu/ngày' : `${quantity.format(summary.plannedKgPerHead)} kg/đầu/ngày`} />
          <Tile label="Chi phí dự kiến mỗi ngày" value={summary.plannedDailyCost === null ? '—' : `${currency.format(summary.plannedDailyCost)} đ`} note={summary.plannedCostPerHead === null ? '— đ/đầu/ngày' : `${currency.format(summary.plannedCostPerHead)} đ/đầu/ngày`} />
          <Tile label="Chuồng chưa có khẩu phần" value={query.data ? summary.pensWithoutRation : '—'} note="Chuồng đang hoạt động, có bò" warn={summary.pensWithoutRation > 0} />
        </div>

        <nav role="tablist" aria-label="Lọc trạng thái khẩu phần" className="flex max-w-full gap-1 overflow-x-auto border-b border-edge">
          {STATUS_FILTERS.map((item) => (
            <button key={item.value} type="button" role="tab" aria-selected={status === item.value} onClick={() => setStatus(item.value)} className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-xs ${status === item.value ? 'border-brand font-semibold text-brand-dark' : 'border-transparent text-muted'}`}>
              {item.label}{item.value === 'CURRENT' ? ` (${rows.filter((row) => row.status === 'EFFECTIVE' || row.status === 'SCHEDULED').length})` : ''}
            </button>
          ))}
        </nav>

        <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
          <label className="sr-only" htmlFor="feed-ration-search">Tìm mã, tên khẩu phần</label>
          <input id="feed-ration-search" type="search" value={queryText} onChange={(event) => setQueryText(event.target.value)} placeholder="Tìm mã, tên khẩu phần..." className={`${inputCls} sm:w-[270px]`} />
          <Select id="feed-ration-group" aria-label="Nhóm đàn" value={herdGroup} onChange={(event) => setHerdGroup(event.target.value)} className="sm:w-[220px]">
            <option value="ALL">Nhóm đàn: Tất cả</option>
            {groups.map((group) => <option key={group} value={group}>{rationGroupLabel(group)}</option>)}
          </Select>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="feed-ration-from" className="text-xs text-muted">Từ ngày</label>
            <input id="feed-ration-from" aria-label="Từ ngày" type="date" value={from} onChange={(event) => setFrom(event.target.value)} className={`${inputCls} w-auto`} />
            <label htmlFor="feed-ration-to" className="text-xs text-muted">Đến ngày</label>
            <input id="feed-ration-to" aria-label="Đến ngày" type="date" value={to} onChange={(event) => setTo(event.target.value)} className={`${inputCls} w-auto`} />
          </div>
        </div>

        {query.loading && !query.data && <div role="status" className="rounded-md border border-edge bg-white p-8 text-center text-sm text-muted">Đang tải khẩu phần…</div>}
        {error && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-err-bg bg-white p-4 text-sm text-err-fg">
            <span>{error}</span><Button size="sm" disabled={query.loading} onClick={() => query.refetch()}>{query.loading ? 'Đang tải lại…' : 'Thử tải lại'}</Button>
          </div>
        )}
        {!query.loading && !error && rows.length === 0 && <Note tone="info">Chưa có khẩu phần. Tạo khẩu phần để lên kế hoạch cho chuồng.</Note>}
        {!query.loading && !error && rows.length > 0 && visibleRows.length === 0 && <Note tone="info">Không tìm thấy khẩu phần phù hợp với bộ lọc.</Note>}
        {!query.loading && !error && visibleRows.length > 0 && (
          <>
            <p className="m-0 text-xs text-muted">{visibleRows.length} phiên bản khẩu phần</p>
            <Table scroll>
              <thead><tr>
                <Th>Khẩu phần</Th><Th>Nhóm đàn / chuồng</Th><Th>Đầu con</Th><Th>Thức ăn · kg/đầu/ngày</Th><Th>Kg/đầu/ngày</Th><Th>Đ/ngày/đầu</Th><Th>Hiệu lực</Th><Th>Trạng thái</Th><Th>Thao tác</Th>
              </tr></thead>
              <tbody>
                {visibleRows.map((row) => {
                  const rowPens = row.penIds.map((id) => pens.find((pen) => pen.id === id)).filter((pen) => pen !== undefined)
                  const cost = rationDailyCost(row)
                  return (
                    <tr key={row.id}>
                      <Td><strong>{row.rationCode} v{row.versionNo}</strong><span className="block text-muted">{row.name}</span></Td>
                      <Td>{rationGroupLabel(row.herdGroup)}<span className="block text-muted">{rowPens.map((pen) => pen.code).join(', ') || '—'}</span></Td>
                      <Td>{rowPens.length ? rationHeadcount(row, pens) : '—'}</Td>
                      <Td>{row.components.map((component) => <span key={component.feedItemId} className="block">{component.feedName} · {quantity.format(component.dailyKg)}</span>)}</Td>
                      <Td>{quantity.format(rationDailyKg(row))}</Td>
                      <Td>{cost === null ? '—' : currency.format(cost)}</Td>
                      <Td>{row.effectiveFrom} – {row.effectiveTo ?? '—'}</Td>
                      <Td><Badge tone={row.status === 'EFFECTIVE' ? 'ok' : row.status === 'SCHEDULED' ? 'warn' : undefined}>{STATUS_LABELS[row.status] ?? row.status}</Badge></Td>
                      <Td>
                        <div className="flex flex-wrap gap-1.5">
                          <Button size="sm" aria-label={`Xem ${row.rationCode} v${row.versionNo}`} onClick={() => navigate(`/thuc-an/khau-phan/${row.id}`)}>Xem</Button>
                          <Button size="sm" disabled={backendMode === 'backend'} title={backendMode === 'backend' ? 'Thao tác ghi chỉ hoạt động trong bản demo' : undefined} aria-label={`Tạo phiên bản ${row.rationCode}`} onClick={() => navigate(`/thuc-an/khau-phan/${row.id}`)}>Tạo phiên bản</Button>
                          {row.status === 'SCHEDULED' && <Button size="sm" disabled title="Thao tác này chưa sẵn sàng" aria-label={`Hủy phiên bản ${row.rationCode}`}>Hủy phiên bản</Button>}
                          {row.status === 'EFFECTIVE' && <Button size="sm" disabled title="Thao tác này chưa sẵn sàng" aria-label={`Ngừng ${row.rationCode}`}>Ngừng</Button>}
                        </div>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
          </>
        )}
        {query.data && summary.plannedDailyCost === null && <Note tone="warn">Chưa đủ dữ liệu giá bình quân để tính chi phí cho một số khẩu phần.</Note>}
      </section>
    </Layout>
  )
}
