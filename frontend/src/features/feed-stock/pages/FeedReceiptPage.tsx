import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { Icon } from '../../../components/Icon'
import { Button, DateInput, Foot, Note, PageHeader, Segmented, Select } from '../../../components/ui'
import { userFacingError } from '../../../api/userFacingError'
import { useQuery } from '../../../hooks/useApi'
import { listFeedReceipts } from '../api/feedReceiptApi'
import { listFeedSuppliers } from '../api/feedCatalogueApi'
import { filterFeedReceipts, getDefaultFeedReceiptPeriod, summarizeFeedReceipts } from '../data/feedReceipts'
import type { FeedReceiptStatus } from '../types/feedReceipt'
import FeedManagementTabs from '../components/FeedManagementTabs'
import FeedReceiptSummary from '../components/FeedReceiptSummary'
import FeedReceiptTable from '../components/FeedReceiptTable'

export default function FeedReceiptPage() {
  const receiptQuery = useQuery(() => listFeedReceipts(), [])
  // Supplier names for the tile and the filter; the list still works if they cannot be loaded.
  const suppliers = useQuery(() => listFeedSuppliers().catch(() => null), []).data
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
  const rows = receiptQuery.data ?? []
  const summary = receiptQuery.data ? summarizeFeedReceipts(rows) : null
  const supplierOptions = useMemo(() => {
    const unique = new Map<number, string>()
    rows.forEach((row) => unique.set(row.supplierId, row.supplierName))
    return [...unique.entries()].sort((a, b) => a[1].localeCompare(b[1], 'vi'))
  }, [rows])
  const visibleRows = useMemo(
    () => filterFeedReceipts(rows, { status, from, to, supplierId }),
    [rows, status, from, to, supplierId],
  )
  const errorMessage = receiptQuery.error
    ? userFacingError(receiptQuery.error, 'Không thể tải danh sách phiếu nhập kho. Vui lòng thử lại.')
    : null
  const count = (key: 'all' | 'draft' | 'posted' | 'voided') => summary?.counts[key] ?? '—'

  return (
    <Layout title="Thức ăn › Phiếu nhập kho" user="manager">
      <PageHeader title="Phiếu nhập kho" sub="Mỗi lần nhận thức ăn từ nhà cung cấp lập 1 phiếu nhập kho">
        <Button variant="primary" onClick={() => navigate('/thuc-an/phieu-nhap/moi')} aria-label="Tạo phiếu nhập kho">
          <span className="inline-flex items-center gap-1.5"><Icon name="circle-plus" size={16} />Tạo phiếu nhập kho</span>
        </Button>
      </PageHeader>

      <FeedManagementTabs />
      {routeMessage && <Note tone="ok">{routeMessage}</Note>}

      <section role="tabpanel" aria-label="Danh sách phiếu nhập kho" className="flex flex-col gap-4">
        <FeedReceiptSummary rows={receiptQuery.data} suppliers={suppliers} />

        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            value={status}
            onChange={(value) => setStatus(value as FeedReceiptStatus | 'ALL')}
            options={[
              { value: 'DRAFT', label: `Nháp (${count('draft')})` },
              { value: 'POSTED', label: `Đã nhập (${count('posted')})` },
              { value: 'VOIDED', label: `Đã hủy (${count('voided')})` },
              { value: 'ALL', label: `Tất cả (${count('all')})` },
            ]}
          />
          <span className="flex-1" />
          <div className="flex items-center gap-2">
            <label htmlFor="feed-receipt-from" className="sr-only">Từ ngày</label>
            <DateInput id="feed-receipt-from" value={from} onChange={setFrom} className="w-[150px]" />
            <span aria-hidden="true" className="text-muted">–</span>
            <label htmlFor="feed-receipt-to" className="sr-only">Đến ngày</label>
            <DateInput id="feed-receipt-to" value={to} onChange={setTo} className="w-[150px]" />
          </div>
          <label className="sr-only" htmlFor="feed-receipt-supplier">Nhà cung cấp</label>
          <Select
            id="feed-receipt-supplier"
            aria-label="Nhà cung cấp"
            value={supplierId}
            onChange={(event) => setSupplierId(event.target.value === 'ALL' ? 'ALL' : Number(event.target.value))}
            className="w-[210px]"
          >
            <option value="ALL">Nhà cung cấp: Tất cả</option>
            {supplierOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </Select>
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
        {!receiptQuery.loading && !errorMessage && visibleRows.length > 0 && (
          <div className="flex flex-col gap-2 rounded-md border border-edge bg-white p-px">
            <FeedReceiptTable rows={visibleRows} />
            <p className="m-0 px-3 pb-2 text-xs text-muted">Hiển thị {visibleRows.length} / {rows.length} phiếu</p>
          </div>
        )}
      </section>
      <Foot>Danh sách phiếu nhập kho thức ăn. Phiếu NHÁP chưa cộng kho, chưa ghi công nợ. Hủy phiếu đã nhập chỉ được khi tồn kho còn đủ để trừ lại số đã nhập; nếu không, dùng phiếu điều chỉnh kho.</Foot>
    </Layout>
  )
}
