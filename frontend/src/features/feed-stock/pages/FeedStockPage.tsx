import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { Badge, Button, Note, PageHeader, Select, inputCls } from '../../../components/ui'
import { userFacingError } from '../../../api/userFacingError'
import { backendMode } from '../../../api/backendTransport'
import { useQuery } from '../../../hooks/useApi'
import { listFeedStock } from '../api/feedStockApi'
import { filterFeedStock } from '../data/feedStock'
import type { FeedGroup, FeedStockStatus } from '../types'
import { FeedStockSummary } from '../components/FeedStockSummary'
import FeedStockTable from '../components/FeedStockTable'
import FeedManagementTabs from '../components/FeedManagementTabs'

const GROUP_LABELS: Record<FeedGroup, string> = {
  GREEN_ROUGHAGE: 'Thức ăn thô xanh',
  DRY_ROUGHAGE: 'Thức ăn thô khô',
  CONCENTRATE: 'Thức ăn tinh',
  TMR: 'Thức ăn hỗn hợp hoàn chỉnh',
  MINERAL_ADDITIVE: 'Khoáng bổ sung',
  CALF_FEED: 'Thức ăn bê',
}
const STATUS_LABELS: Record<FeedStockStatus, string> = {
  SUFFICIENT: 'Đủ dùng',
  LOW: 'Sắp hết',
  OUT_OF_STOCK: 'Hết hàng',
}

export default function FeedStockPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const routeMessage = typeof location.state === 'object' && location.state !== null && 'feedStockMessage' in location.state
    ? String((location.state as { feedStockMessage?: unknown }).feedStockMessage ?? '')
    : ''
  const stockQuery = useQuery(() => listFeedStock(), [])
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

  const errorMessage = stockQuery.error
    ? userFacingError(stockQuery.error, 'Không thể tải dữ liệu tồn kho. Vui lòng thử lại.')
    : null

  return (
    <Layout title="Thức ăn – Tồn kho" user="manager">
      <PageHeader
        title="Quản lý thức ăn"
        sub="Theo dõi số lượng tồn, mức tối thiểu và tình trạng sử dụng thức ăn trong trại."
      >
        <Button
          aria-label="Kiểm kê / điều chỉnh"
          onClick={() => navigate('/thuc-an/kiem-ke/moi')}
        >
          Kiểm kê / điều chỉnh
        </Button>
        <Button
          variant="primary"
          aria-label="Tạo phiếu nhập kho"
          onClick={() => navigate('/thuc-an/phieu-nhap/moi')}
        >
          + Tạo phiếu nhập kho
        </Button>
      </PageHeader>

      {backendMode === 'local' && (
        <div>
          <Badge tone="info">Dữ liệu minh họa</Badge>
        </div>
      )}

      <FeedManagementTabs />
      {routeMessage && <Note tone="ok">{routeMessage}</Note>}

      <section role="tabpanel" aria-label="Tồn kho thức ăn" className="flex flex-col gap-5">
        <FeedStockSummary rows={stockQuery.data} />

        <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
          <label className="sr-only" htmlFor="feed-stock-search">Tìm mã, tên thức ăn</label>
          <input
            id="feed-stock-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm mã, tên thức ăn..."
            className={`${inputCls} sm:w-[300px]`}
          />
          <label className="sr-only" htmlFor="feed-stock-group">Nhóm thức ăn</label>
          <Select
            id="feed-stock-group"
            aria-label="Nhóm thức ăn"
            value={group}
            onChange={(event) => setGroup(event.target.value as FeedGroup | 'ALL')}
            className="sm:w-[230px]"
          >
            <option value="ALL">Nhóm: Tất cả</option>
            {groups.map((item) => (
              <option key={item} value={item}>{GROUP_LABELS[item] ?? item}</option>
            ))}
          </Select>
          <label className="sr-only" htmlFor="feed-stock-status">Trạng thái tồn kho</label>
          <Select
            id="feed-stock-status"
            aria-label="Trạng thái tồn kho"
            value={status}
            onChange={(event) => setStatus(event.target.value as FeedStockStatus | 'ALL')}
            className="sm:w-[200px]"
          >
            <option value="ALL">Trạng thái: Tất cả</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span>Cập nhật gần nhất: — (chưa có thời điểm cập nhật trong API tồn kho)</span>
          <span>{visibleRows.length} mặt hàng</span>
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
          <FeedStockTable rows={visibleRows} />
        )}

        <Note>
          Mức tối thiểu dùng để theo dõi REM-10 cho thức ăn đang hoạt động. Số ngày đủ dùng được lấy từ API; “—” nghĩa là chưa có mức tiêu thụ để tính. Lô gần hết hạn chỉ là cảnh báo hạn dùng.
        </Note>

        <Note tone="warn">
          Tạo phiếu nhập và kiểm kê có thể thử với dữ liệu minh họa. Lịch sử biến động chưa sẵn sàng.
        </Note>
      </section>
    </Layout>
  )
}
