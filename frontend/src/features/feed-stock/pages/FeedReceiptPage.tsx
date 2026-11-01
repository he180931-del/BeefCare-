import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { Badge, Button, Note, PageHeader, Select, inputCls } from '../../../components/ui'
import { userFacingError } from '../../../api/userFacingError'
import { backendMode } from '../../../api/backendTransport'
import { useQuery } from '../../../hooks/useApi'
import { listFeedReceipts } from '../api/feedReceiptApi'
import { filterFeedReceipts, getDefaultFeedReceiptPeriod, summarizeFeedReceipts } from '../data/feedReceipts'
import type { FeedReceiptStatus } from '../types/feedReceipt'
import FeedManagementTabs from '../components/FeedManagementTabs'
import FeedReceiptSummary from '../components/FeedReceiptSummary'
import FeedReceiptTable from '../components/FeedReceiptTable'

const STATUS_TABS: Array<{ value: FeedReceiptStatus | 'ALL'; label: string; countKey: 'all' | 'draft' | 'posted' | 'voided' }> = [
  { value: 'ALL', label: 'Tất cả', countKey: 'all' },
  { value: 'DRAFT', label: 'Nháp', countKey: 'draft' },
  { value: 'POSTED', label: 'Đã ghi', countKey: 'posted' },
  { value: 'VOIDED', label: 'Đã hủy', countKey: 'voided' },
]

export default function FeedReceiptPage() {
  const receiptQuery = useQuery(() => listFeedReceipts(), [])
  const navigate = useNavigate()
  const location = useLocation()
  const routeMessage = typeof location.state === 'object' && location.state !== null && 'receiptMessage' in location.state
    ? String((location.state as { receiptMessage?: unknown }).receiptMessage ?? '')
    : ''
  const [status, setStatus] = useState<FeedReceiptStatus | 'ALL'>('ALL')
  const defaultPeriod = useMemo(() => getDefaultFeedReceiptPeriod(), [])
  const [from, setFrom] = useState(defaultPeriod.from)
  const [to, setTo] = useState(defaultPeriod.to)
  const [supplierId, setSupplierId] = useState<number | 'ALL'>('ALL')
  const [query, setQuery] = useState('')
  const rows = receiptQuery.data ?? []
  const summary = receiptQuery.data ? summarizeFeedReceipts(rows) : null
  const suppliers = useMemo(() => {
    const unique = new Map<number, string>()
    rows.forEach((row) => unique.set(row.supplierId, row.supplierName))
    return [...unique.entries()].sort((a, b) => a[1].localeCompare(b[1], 'vi'))
  }, [rows])
  const visibleRows = useMemo(
    () => filterFeedReceipts(rows, { query, status, from, to, supplierId }),
    [rows, query, status, from, to, supplierId],
  )
  const errorMessage = receiptQuery.error
    ? userFacingError(receiptQuery.error, 'Không thể tải danh sách phiếu nhập kho. Vui lòng thử lại.')
    : null

  return (
    <Layout title="Thức ăn – Phiếu nhập kho" user="manager">
      <PageHeader
        title="Phiếu nhập kho thức ăn"
        sub="Theo dõi các phiếu nhập và trạng thái ghi nhận vào kho."
      >
        <Button variant="primary" onClick={() => navigate('/thuc-an/phieu-nhap/moi')} aria-label="Tạo phiếu nhập kho">
          + Tạo phiếu nhập kho
        </Button>
      </PageHeader>

      {backendMode === 'local' && <Badge tone="info">Dữ liệu minh họa</Badge>}

      <FeedManagementTabs />

      {routeMessage && <Note tone="ok">{routeMessage}</Note>}

      <section role="tabpanel" aria-label="Danh sách phiếu nhập kho" className="flex flex-col gap-5">
        <FeedReceiptSummary rows={receiptQuery.data} />

        <nav role="tablist" aria-label="Lọc trạng thái phiếu nhập" className="flex max-w-full gap-1 overflow-x-auto border-b border-edge">
          {STATUS_TABS.map((tab) => {
            const active = status === tab.value
            const count = summary?.counts[tab.countKey]
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setStatus(tab.value)}
                className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-xs ${active ? 'border-brand font-semibold text-brand-dark' : 'border-transparent text-muted'}`}
              >
                {tab.label} ({count ?? '—'})
              </button>
            )
          })}
        </nav>

        <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
          <label className="sr-only" htmlFor="feed-receipt-search">Tìm mã phiếu, nhà cung cấp, thức ăn</label>
          <input
            id="feed-receipt-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm mã phiếu, nhà cung cấp, thức ăn..."
            className={`${inputCls} sm:w-[300px]`}
          />
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="feed-receipt-from" className="text-xs text-muted">Từ ngày</label>
            <input id="feed-receipt-from" aria-label="Từ ngày" type="date" value={from} onChange={(event) => setFrom(event.target.value)} className={`${inputCls} w-auto`} />
            <label htmlFor="feed-receipt-to" className="text-xs text-muted">Đến ngày</label>
            <input id="feed-receipt-to" aria-label="Đến ngày" type="date" value={to} onChange={(event) => setTo(event.target.value)} className={`${inputCls} w-auto`} />
          </div>
          <label className="sr-only" htmlFor="feed-receipt-supplier">Nhà cung cấp</label>
          <Select
            id="feed-receipt-supplier"
            aria-label="Nhà cung cấp"
            value={supplierId}
            onChange={(event) => setSupplierId(event.target.value === 'ALL' ? 'ALL' : Number(event.target.value))}
            className="sm:w-[230px]"
          >
            <option value="ALL">Nhà cung cấp: Tất cả</option>
            {suppliers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </Select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span>{visibleRows.length} phiếu</span>
          <span>Kết quả được lọc theo thông tin hiện có.</span>
        </div>

        {receiptQuery.loading && !receiptQuery.data && (
          <div role="status" aria-live="polite" className="rounded-md border border-edge bg-white p-8 text-center text-sm text-muted">
            Đang tải phiếu nhập kho…
          </div>
        )}

        {errorMessage && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-err-bg bg-white p-4 text-sm text-err-fg">
            <span>{errorMessage}</span>
            <Button size="sm" disabled={receiptQuery.loading} onClick={() => receiptQuery.refetch()}>
              {receiptQuery.loading ? 'Đang tải lại…' : 'Thử tải lại'}
            </Button>
          </div>
        )}

        {!receiptQuery.loading && !errorMessage && rows.length === 0 && <Note tone="info">Chưa có phiếu nhập kho.</Note>}
        {!receiptQuery.loading && !errorMessage && rows.length > 0 && visibleRows.length === 0 && <Note tone="info">Không tìm thấy phiếu nhập kho phù hợp với bộ lọc.</Note>}
        {!receiptQuery.loading && !errorMessage && visibleRows.length > 0 && <FeedReceiptTable rows={visibleRows} />}

        <Note tone="warn">Một số thông tin chưa sẵn sàng.</Note>
      </section>
    </Layout>
  )
}
