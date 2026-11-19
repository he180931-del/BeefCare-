import { useLocation, useNavigate } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { Badge, Button, Note, PageHeader, Table, Td, Th } from '../../../components/ui'
import { userFacingError } from '../../../api/userFacingError'
import { useQuery } from '../../../hooks/useApi'
import { listFeedStockAdjustments } from '../api/feedStockAdjustmentApi'
import FeedManagementTabs from '../components/FeedManagementTabs'

const numberFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 })
const currencyFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 })
const TYPE_LABELS: Record<string, string> = {
  PERIODIC_COUNT: 'Kiểm kê định kỳ',
  LOSS: 'Thất thoát',
  SPOILAGE: 'Hư hỏng',
  OTHER: 'Khác',
}
const STATUS_LABELS: Record<string, string> = { DRAFT: 'Nháp', POSTED: 'Đã ghi nhận' }

export default function FeedStockAdjustmentPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const query = useQuery(() => listFeedStockAdjustments(), [])
  const routeMessage = typeof location.state === 'object' && location.state !== null && 'adjustmentMessage' in location.state
    ? String((location.state as { adjustmentMessage?: unknown }).adjustmentMessage ?? '')
    : ''
  const rows = query.data ?? []
  const error = query.error
    ? userFacingError(query.error, 'Không thể tải phiếu kiểm kê. Vui lòng thử lại.')
    : null

  return (
    <Layout title="Thức ăn › Kiểm kê" user="manager">
      <PageHeader title="Phiếu kiểm kê / điều chỉnh tồn kho" sub="Theo dõi các lần kiểm kê và phần chênh lệch tồn kho.">
        <Button onClick={() => navigate('/thuc-an')}>Quay lại tồn kho</Button>
        <Button variant="primary" onClick={() => navigate('/thuc-an/kiem-ke/moi')}>Tạo phiếu kiểm kê</Button>
      </PageHeader>

      <FeedManagementTabs />
      {routeMessage && <Note tone="ok">{routeMessage}</Note>}

      <section role="tabpanel" aria-label="Danh sách phiếu kiểm kê" className="flex flex-col gap-4">
        {query.loading && !query.data && <div role="status" className="rounded-md border border-edge bg-white p-8 text-center text-sm text-muted">Đang tải phiếu kiểm kê…</div>}
        {error && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-err-bg bg-white p-4 text-sm text-err-fg">
            <span>{error}</span>
            <Button size="sm" disabled={query.loading} onClick={() => query.refetch()}>{query.loading ? 'Đang tải lại…' : 'Thử tải lại'}</Button>
          </div>
        )}
        {!query.loading && !error && rows.length === 0 && (
          <Note tone="info">Chưa có phiếu kiểm kê. Tạo phiếu mới để so sánh lượng đếm với tồn hiện tại.</Note>
        )}
        {!query.loading && !error && rows.length > 0 && (
          <>
            <p className="m-0 text-xs text-muted">{rows.length} phiếu kiểm kê</p>
            <Table scroll>
              <thead><tr>
                <Th>Số phiếu</Th><Th>Ngày kiểm kê</Th><Th>Loại</Th><Th>Mặt hàng</Th><Th>Chênh lệch (kg)</Th><Th>Giá trị (đ)</Th><Th>Trạng thái</Th><Th>Thao tác</Th>
              </tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <Td className="font-semibold">{row.code}</Td>
                    <Td>{row.countDate}</Td>
                    <Td>{TYPE_LABELS[row.adjustmentType] ?? row.adjustmentType}</Td>
                    <Td>{row.lines.length}</Td>
                    <Td>{numberFormat.format(row.totalDifferenceKg)}</Td>
                    <Td>{row.totalValue === null ? '—' : currencyFormat.format(row.totalValue)}</Td>
                    <Td><Badge tone={row.status === 'POSTED' ? 'ok' : row.status === 'DRAFT' ? 'warn' : undefined}>{STATUS_LABELS[row.status] ?? row.status}</Badge></Td>
                    <Td>
                      <Button size="sm" aria-label={`${row.status === 'DRAFT' ? 'Tiếp tục' : 'Xem'} ${row.code}`} onClick={() => navigate(`/thuc-an/kiem-ke/${row.id}`)}>
                        {row.status === 'DRAFT' ? 'Tiếp tục' : 'Xem'}
                      </Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </>
        )}
        <Note>Ghi nhận kiểm kê không thay đổi các phiếu nhập hoặc nhật ký cho ăn trước đó.</Note>
      </section>
    </Layout>
  )
}
