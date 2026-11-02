import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { Icon } from '../../../components/Icon'
import { Badge, Button, DateInput, Foot, Metric, Note, PageHeader, Select, Table, Td, Th, inputCls } from '../../../components/ui'
import { backendMode } from '../../../api/backendTransport'
import { userFacingError } from '../../../api/userFacingError'
import { useQuery } from '../../../hooks/useApi'
import { listFeedRationPens, listFeedRations } from '../api/feedRationApi'
import { filterFeedRations, summarizeFeedRations, type FeedRationStatusFilter } from '../data/feedRationMock'
import { rationGroupLabel } from '../data/feedRationForm'
import { formatDate, formatNumber, formatShortDate, formatVnd } from '../domain/feedLabels'
import type { FeedRation } from '../types/feedRation'
import FeedManagementTabs from '../components/FeedManagementTabs'
import { FeedRationCancelDialog, FeedRationStopDialog } from '../components/FeedRationDialogs'

const STATUS_BADGES: Record<string, { label: string; tone: 'ok' | 'info' | 'outline' }> = {
  EFFECTIVE: { label: 'Đang áp dụng', tone: 'ok' },
  SCHEDULED: { label: 'Sắp áp dụng', tone: 'info' },
  ENDED: { label: 'Ngừng', tone: 'outline' },
}
const STATUS_FILTERS: Array<{ value: FeedRationStatusFilter; label: string }> = [
  { value: 'CURRENT', label: 'Đang & sắp áp dụng' },
  { value: 'ENDED', label: 'Đã kết thúc' },
  { value: 'ALL', label: 'Tất cả' },
]

const rationDailyKg = (row: FeedRation) => row.components.reduce((sum, component) => sum + component.dailyKg, 0)
const rationDailyCost = (row: FeedRation) => row.components.every((component) => component.estimatedDailyCost !== null)
  ? row.components.reduce((sum, component) => sum + (component.estimatedDailyCost ?? 0), 0)
  : null

function effectiveText(row: FeedRation) {
  if (!row.effectiveTo) return `từ ${formatDate(row.effectiveFrom)}`
  const sameYear = row.effectiveFrom.slice(0, 4) === row.effectiveTo.slice(0, 4)
  return `${sameYear ? formatShortDate(row.effectiveFrom) : formatDate(row.effectiveFrom)} – ${formatDate(row.effectiveTo)}`
}

export default function FeedRationPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const query = useQuery(async () => {
    const [rows, pens] = await Promise.all([listFeedRations(), listFeedRationPens()])
    return { rows, pens }
  }, [])
  const [status, setStatus] = useState<FeedRationStatusFilter>('CURRENT')
  const [queryText, setQueryText] = useState('')
  const [herdGroup, setHerdGroup] = useState('ALL')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [message, setMessage] = useState(typeof location.state === 'object' && location.state !== null && 'rationMessage' in location.state
    ? String((location.state as { rationMessage?: unknown }).rationMessage ?? '')
    : '')
  const rows = query.data?.rows ?? []
  const pens = query.data?.pens ?? []
  const groups = useMemo(() => [...new Set(rows.map((row) => row.herdGroup).filter(Boolean))].sort(), [rows])
  const summary = useMemo(() => summarizeFeedRations(rows, pens), [rows, pens])
  const visibleRows = useMemo(() => filterFeedRations(rows, { query: queryText, status, herdGroup, from, to }), [rows, queryText, status, herdGroup, from, to])
  const versionCount = (code: string) => rows.filter((row) => row.rationCode === code).length
  const error = query.error ? userFacingError(query.error, 'Không thể tải danh sách khẩu phần. Vui lòng thử lại.') : null
  const dialogRow = rows.find((row) => String(row.id) === params.get('id'))
  const dialog = params.get('m')
  const open = (name: string, row: FeedRation) => setParams((current) => { const next = new URLSearchParams(current); next.set('m', name); next.set('id', String(row.id)); return next })
  const close = () => setParams((current) => { const next = new URLSearchParams(current); next.delete('m'); next.delete('id'); return next })
  const done = (text: string) => { setMessage(text); close(); query.refetch() }
  const multiVersion = rows.some((row) => versionCount(row.rationCode) > 1)
  const headOf = (row: FeedRation) => row.penIds.reduce((sum, id) => sum + (pens.find((pen) => pen.id === id)?.headcount ?? 0), 0)
  const penCodes = (row: FeedRation) => row.penIds.map((id) => pens.find((pen) => pen.id === id)?.code).filter((code) => code !== undefined)

  return (
    <Layout title="Thức ăn › Khẩu phần" user="manager">
      <PageHeader title="Khẩu phần" sub="Lượng từng thức ăn / con / cữ, áp dụng cho chuồng theo nhóm đàn">
        <Button variant="primary" onClick={() => navigate('/thuc-an/khau-phan/moi')}>
          <span className="inline-flex items-center gap-1.5"><Icon name="circle-plus" size={16} />Tạo khẩu phần</span>
        </Button>
      </PageHeader>
      <FeedManagementTabs />
      {message && <Note tone="ok">{message}</Note>}
      {backendMode === 'backend' && <Note tone="warn">Lưu phiên bản mới, hủy phiên bản và ngừng khẩu phần hiện chỉ hoạt động trong bản demo.</Note>}

      <section role="tabpanel" aria-label="Danh sách khẩu phần" className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric compact label="Khẩu phần đang áp dụng" value={query.data ? summary.effectiveRations : '—'} sub={query.data ? `cho ${summary.pensCovered} chuồng · ${summary.headCovered} con` : 'Chưa tải dữ liệu'} />
          <Metric compact label="Lượng kế hoạch / ngày" value={query.data ? `${formatNumber(summary.plannedDailyKg, 0)} kg` : '—'} sub={summary.plannedKgPerHead === null ? 'bình quân — kg/con/ngày' : `bình quân ${formatNumber(summary.plannedKgPerHead)} kg/con/ngày`} />
          <Metric compact label="Chi phí kế hoạch / ngày" value={summary.plannedDailyCost === null ? '—' : formatVnd(summary.plannedDailyCost)} sub={summary.plannedCostPerHead === null ? 'bình quân — đ/con/ngày' : `bình quân ${formatNumber(summary.plannedCostPerHead, 0)} đ/con/ngày`} />
          <Metric
            compact
            label="Chuồng chưa có khẩu phần"
            warn={summary.pensWithoutRation > 0}
            value={query.data ? summary.pensWithoutRation : '—'}
            sub={summary.pensWithoutRation > 0 ? summary.pensWithoutRationNames.join(' · ') : 'Mọi chuồng đã có khẩu phần'}
          />
        </div>

        <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
          <Select id="feed-ration-status" aria-label="Trạng thái" value={status} onChange={(event) => setStatus(event.target.value as FeedRationStatusFilter)} className="sm:w-[260px]">
            {STATUS_FILTERS.map((item) => <option key={item.value} value={item.value}>Trạng thái: {item.label}</option>)}
          </Select>
          <Select id="feed-ration-group" aria-label="Nhóm đàn" value={herdGroup} onChange={(event) => setHerdGroup(event.target.value)} className="sm:w-[180px]">
            <option value="ALL">Nhóm đàn: Tất cả</option>
            {groups.map((group) => <option key={group} value={group}>{rationGroupLabel(group)}</option>)}
          </Select>
          <label className="sr-only" htmlFor="feed-ration-search">Tìm mã, tên khẩu phần</label>
          <input id="feed-ration-search" type="search" value={queryText} onChange={(event) => setQueryText(event.target.value)} placeholder="Tìm mã, tên khẩu phần…" className={`${inputCls} sm:w-[260px]`} />
          <span className="flex-1" />
          <div className="flex items-center gap-2">
            <label htmlFor="feed-ration-from" className="sr-only">Từ ngày</label>
            <DateInput id="feed-ration-from" value={from} onChange={setFrom} className="w-[150px]" />
            <span aria-hidden="true" className="text-muted">–</span>
            <label htmlFor="feed-ration-to" className="sr-only">Đến ngày</label>
            <DateInput id="feed-ration-to" value={to} onChange={setTo} className="w-[150px]" />
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
          <div className="flex flex-col gap-2 rounded-md border border-edge bg-white p-px">
            <Table scroll stack={false}>
              <thead><tr>
                <Th>Khẩu phần</Th><Th>Áp dụng cho</Th><Th>Số con</Th><Th>Thành phần (kg/con/ngày)</Th><Th>kg/con/ngày</Th><Th>đ/con/ngày</Th><Th>Hiệu lực</Th><Th>Trạng thái</Th><Th><span className="sr-only">Thao tác</span></Th>
              </tr></thead>
              <tbody>
                {visibleRows.map((row) => {
                  const cost = rationDailyCost(row)
                  const badge = STATUS_BADGES[row.status]
                  return (
                    <tr key={row.id} className={`${row.status === 'SCHEDULED' ? 'bg-[#eef4ef]' : ''} ${row.status === 'ENDED' ? 'opacity-60' : ''}`}>
                      <Td className="min-w-[200px]">
                        <Link to={`/thuc-an/khau-phan/${row.id}`} className="font-semibold text-brand no-underline hover:underline">
                          {row.rationCode} · {row.name}{versionCount(row.rationCode) > 1 ? ` (v${row.versionNo})` : ''}
                        </Link>
                        <div className="text-[11px] text-muted">{rationGroupLabel(row.herdGroup)}</div>
                      </Td>
                      <Td className="min-w-[100px]">{penCodes(row).length ? `Chuồng ${penCodes(row).join(', ')}` : '—'}</Td>
                      <Td className="whitespace-nowrap">{row.status === 'ENDED' || !row.penIds.length ? '—' : headOf(row)}</Td>
                      <Td className="min-w-[200px]">{row.components.map((component) => `${component.feedName} ${formatNumber(component.dailyKg, 3)}`).join(' · ')}</Td>
                      <Td className="whitespace-nowrap">{formatNumber(rationDailyKg(row), 2)}</Td>
                      <Td className="whitespace-nowrap">{cost === null ? '—' : formatNumber(cost, 0)}</Td>
                      <Td className="whitespace-nowrap">{effectiveText(row)}</Td>
                      <Td className="whitespace-nowrap">{badge ? <Badge tone={badge.tone}>{badge.label}</Badge> : <Badge tone="outline">{row.status}</Badge>}</Td>
                      <Td>
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <Button variant="link" size="sm" aria-label={`Sửa ${row.rationCode} v${row.versionNo}`} onClick={() => navigate(`/thuc-an/khau-phan/${row.id}`)}>Sửa</Button>
                          {row.status === 'SCHEDULED' && <Button variant="link" size="sm" disabled={backendMode === 'backend'} aria-label={`Hủy phiên bản ${row.rationCode} v${row.versionNo}`} onClick={() => open('huy', row)}>Hủy phiên bản</Button>}
                          {row.status === 'EFFECTIVE' && !row.effectiveTo && <Button variant="link" size="sm" disabled={backendMode === 'backend'} aria-label={`Ngừng ${row.rationCode} v${row.versionNo}`} onClick={() => open('ngung', row)}>Ngừng</Button>}
                        </div>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
            <p className="m-0 px-3 pb-2 text-xs text-muted">
              {visibleRows.length} khẩu phần
              {multiVersion ? ` · ${[...new Set(rows.filter((row) => versionCount(row.rationCode) > 1).map((row) => row.rationCode))].map((code) => `${versionCount(code)} phiên bản của ${code}`).join(', ')}` : ''}
            </p>
          </div>
        )}
        <Note tone="info">Mỗi chuồng chỉ có 1 khẩu phần hiệu lực tại một ngày. Phiên bản mới có hiệu lực từ ngày chọn và tự kết thúc phiên bản cũ vào ngày trước đó.</Note>
        {query.data && summary.plannedDailyCost === null && <Note tone="warn">Chưa đủ dữ liệu giá bình quân để tính chi phí cho một số khẩu phần.</Note>}
      </section>
      <Foot>Danh sách khẩu phần theo chuồng (Chủ trại, Quản lý). Lượng kế hoạch của một cữ = khẩu phần × số con đang có trong chuồng; chi phí ước tính theo giá nhập bình quân. Dòng nền xanh là phiên bản sắp áp dụng; khẩu phần ngừng hiển thị mờ.</Foot>
      {dialog === 'huy' && dialogRow?.status === 'SCHEDULED' && <FeedRationCancelDialog row={dialogRow} onClose={close} onDone={done} />}
      {dialog === 'ngung' && dialogRow?.status === 'EFFECTIVE' && <FeedRationStopDialog row={dialogRow} onClose={close} onDone={done} />}
    </Layout>
  )
}
