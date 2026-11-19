import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { Button, Foot, Note, PageHeader, Select, inputCls } from '../../../components/ui'
import { Icon, type IconName } from '../../../components/Icon'
import { userFacingError } from '../../../api/userFacingError'
import { useQuery } from '../../../hooks/useApi'
import { getFeedStockUpdatedAt } from '../api/feedMovementApi'
import { listFeedFeedingRecords } from '../api/feedFeedingApi'
import { listFeedRationPens, listFeedRations } from '../api/feedRationApi'
import { listFeedStock } from '../api/feedStockApi'
import { filterFeedStock } from '../data/feedStock'
import { summarizeTodaySessions } from '../data/feedTodayRations'
import { feedGroupLabel, formatDate } from '../domain/feedLabels'
import type { FeedGroup, FeedStockRow, FeedStockStatus } from '../types'
import { FeedStockSummary } from '../components/FeedStockSummary'
import FeedStockTable from '../components/FeedStockTable'
import FeedManagementTabs from '../components/FeedManagementTabs'
import FeedMovementsDialog from '../components/FeedMovementsDialog'

const STATUS_LABELS: Record<FeedStockStatus, string> = {
  SUFFICIENT: 'Đủ dùng',
  LOW: 'Sắp hết',
  OUT_OF_STOCK: 'Hết hàng',
}

const localToday = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function updatedText(iso: string | null | undefined) {
  const match = iso?.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/)
  return match ? ` · cập nhật ${formatDate(match[1])} ${match[2]}` : ''
}

function QuickAction({ to, icon, title, sub }: { to: string; icon: IconName; title: string; sub: string }) {
  return (
    <Link to={to} className="flex min-w-0 items-center gap-3 rounded-md border border-edge bg-white px-[18px] py-4 text-ink no-underline hover:bg-page">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#cde9d8] text-brand"><Icon name={icon} size={20} /></span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-muted">{sub}</span>
      </span>
    </Link>
  )
}

export default function FeedStockPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const routeMessage = typeof location.state === 'object' && location.state !== null && 'feedStockMessage' in location.state
    ? String((location.state as { feedStockMessage?: unknown }).feedStockMessage ?? '')
    : ''
  const stockQuery = useQuery(() => listFeedStock(), [])
  const updatedQuery = useQuery(() => getFeedStockUpdatedAt().catch(() => null), [])
  // Side data for the quick-action hint and the per-head tile; the page works without it.
  const sideQuery = useQuery(async () => {
    const date = localToday()
    const [pens, rations, records] = await Promise.all([listFeedRationPens(), listFeedRations(), listFeedFeedingRecords({ from: date, to: date })])
    return { pens, headCount: pens.filter((pen) => pen.status === 'ACTIVE').reduce((sum, pen) => sum + pen.headcount, 0), sessions: summarizeTodaySessions({ pens, rations, records, stock: [], date }) }
  }, []).data
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<FeedGroup | 'ALL'>('ALL')
  const [status, setStatus] = useState<FeedStockStatus | 'ALL'>('ALL')
  const allRows = stockQuery.data ?? []
  const groups = useMemo(
    () => [...new Set(allRows.map((row) => row.group))].sort((left, right) => left.localeCompare(right)),
    [allRows],
  )
  const visibleRows = useMemo(
    () => filterFeedStock(allRows, { query: query.trim(), group, status }),
    [allRows, group, query, status],
  )
  const viewing: FeedStockRow | undefined = params.get('m') === 'xem'
    ? allRows.find((row) => String(row.feedItemId) === params.get('feed'))
    : undefined
  const openMovements = (row: FeedStockRow) => setParams((current) => {
    const next = new URLSearchParams(current)
    next.set('m', 'xem')
    next.set('feed', String(row.feedItemId))
    return next
  })
  const closeMovements = () => setParams((current) => {
    const next = new URLSearchParams(current)
    next.delete('m')
    next.delete('feed')
    return next
  })

  const errorMessage = stockQuery.error
    ? userFacingError(stockQuery.error, 'Không thể tải dữ liệu tồn kho. Vui lòng thử lại.')
    : null
  const missing = sideQuery?.sessions.missing.length
  const feedingHint = missing === undefined ? 'Mở nhật ký cho ăn hôm nay' : missing === 0 ? 'Đã ghi đủ các cữ hôm nay' : `${missing} cữ chưa ghi hôm nay`

  return (
    <Layout title="Thức ăn › Tồn kho" user="manager">
      <PageHeader
        title="Quản lý thức ăn"
        sub={`Tồn kho tự cộng khi lưu phiếu nhập kho và tự trừ khi ghi cữ cho ăn${updatedText(updatedQuery.data)}`}
      >
        <Button aria-label="Kiểm kê / điều chỉnh" onClick={() => navigate('/thuc-an/kiem-ke/moi')}>
          Kiểm kê / điều chỉnh
        </Button>
        <Button variant="primary" aria-label="Tạo phiếu nhập kho" onClick={() => navigate('/thuc-an/phieu-nhap/moi')}>
          <span className="inline-flex items-center gap-1.5"><Icon name="circle-plus" size={16} />Tạo phiếu nhập kho</span>
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <QuickAction to="/thuc-an/phieu-nhap/moi" icon="file-import" title="Nhập kho" sub="Phiếu nhập từ nhà cung cấp" />
        <QuickAction to="/thuc-an/nhat-ky?m=ghi" icon="grain" title="Ghi cữ cho ăn" sub={feedingHint} />
        <QuickAction to="/thuc-an/kiem-ke/moi" icon="clipboard-list" title="Kiểm kê" sub="Đếm tồn, điều chỉnh" />
        <QuickAction to="/thuc-an/bao-cao" icon="report-analytics" title="Chi phí thức ăn" sub="Tiêu thụ theo kỳ" />
      </div>

      <FeedManagementTabs />
      {routeMessage && <Note tone="ok">{routeMessage}</Note>}

      <section role="tabpanel" aria-label="Tồn kho thức ăn" className="flex flex-col gap-4">
        <FeedStockSummary rows={stockQuery.data} headCount={sideQuery?.headCount} />

        <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
          <label className="sr-only" htmlFor="feed-stock-search">Tìm mã, tên thức ăn</label>
          <input
            id="feed-stock-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm mã, tên thức ăn…"
            className={`${inputCls} sm:w-[280px]`}
          />
          <label className="sr-only" htmlFor="feed-stock-group">Nhóm thức ăn</label>
          <Select
            id="feed-stock-group"
            aria-label="Nhóm thức ăn"
            value={group}
            onChange={(event) => setGroup(event.target.value as FeedGroup | 'ALL')}
            className="sm:w-[170px]"
          >
            <option value="ALL">Nhóm: Tất cả</option>
            {groups.map((item) => (
              <option key={item} value={item}>{feedGroupLabel(item)}</option>
            ))}
          </Select>
          <label className="sr-only" htmlFor="feed-stock-status">Trạng thái tồn kho</label>
          <Select
            id="feed-stock-status"
            aria-label="Trạng thái tồn kho"
            value={status}
            onChange={(event) => setStatus(event.target.value as FeedStockStatus | 'ALL')}
            className="sm:w-[170px]"
          >
            <option value="ALL">Trạng thái: Tất cả</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        </div>

        {stockQuery.loading && !stockQuery.data && (
          <div role="status" aria-live="polite" className="rounded-md border border-edge bg-white p-8 text-center text-sm text-muted">
            Đang tải tồn kho…
          </div>
        )}

        {errorMessage && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-err-bg bg-white p-4 text-sm text-err-fg">
            <span>{errorMessage}</span>
            <Button size="sm" disabled={stockQuery.loading} onClick={() => stockQuery.refetch()}>
              {stockQuery.loading ? 'Đang tải lại…' : 'Thử tải lại'}
            </Button>
          </div>
        )}

        {!stockQuery.loading && !errorMessage && allRows.length === 0 && (
          <Note tone="info">Chưa có dữ liệu tồn kho.</Note>
        )}

        {!stockQuery.loading && !errorMessage && allRows.length > 0 && visibleRows.length === 0 && (
          <Note tone="info">Không tìm thấy thức ăn phù hợp với bộ lọc.</Note>
        )}

        {!stockQuery.loading && !errorMessage && visibleRows.length > 0 && (
          <FeedStockTable rows={visibleRows} onView={openMovements} />
        )}
      </section>

      <Foot>Tồn kho thức ăn. Mức tối thiểu đặt trong Danh mục; khi tồn ≤ mức tối thiểu, hệ thống nhắc “Sắp hết thức ăn” cho Chủ trại và Quản lý. Đủ dùng = tồn ÷ tiêu thụ bình quân 7 ngày. Tồn kho không bao giờ âm.</Foot>
      {viewing && <FeedMovementsDialog feed={viewing} onClose={closeMovements} />}
    </Layout>
  )
}
