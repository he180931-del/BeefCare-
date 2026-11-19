import { Link } from 'react-router-dom'
import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { Badge, EmptyBlock, ErrorBlock, LoadingBlock, Table, Td, Th } from '../../../components/ui'
import { userFacingError } from '../../../api/userFacingError'
import { useQuery } from '../../../hooks/useApi'
import { listFeedMovements } from '../api/feedMovementApi'
import { formatDate, formatKg, formatMoney } from '../domain/feedLabels'
import type { FeedStockRow } from '../types'
import type { FeedMovement } from '../types/feedMovement'

const TYPE_LABELS: Record<string, string> = {
  RECEIPT: 'Nhập kho',
  RECEIPT_VOID: 'Hủy phiếu nhập',
  ADJUSTMENT: 'Điều chỉnh kho',
  FEEDING: 'Cho ăn',
  FEEDING_CORRECTION: 'Sửa cữ cho ăn',
  FEEDING_VOID: 'Hủy cữ cho ăn',
}

const time = (iso: string) => {
  const match = iso.match(/T(\d{2}:\d{2})/)
  return match ? match[1] : ''
}

function Source({ row }: { row: FeedMovement }) {
  const label = row.sourceCode || (row.sourceId === null ? row.sourceType : `${row.sourceType} #${row.sourceId}`)
  if ((row.sourceType === 'RECEIPT') && row.sourceId !== null) {
    return <Link to={`/thuc-an/phieu-nhap/${row.sourceId}`} className="font-semibold text-brand no-underline hover:underline">{label}</Link>
  }
  return <>{label}</>
}

/** SCR-77 "Xem": stock movements of one feed (time, type, quantity, unit cost, balance after, source document). */
export default function FeedMovementsDialog({ feed, onClose }: { feed: FeedStockRow; onClose: () => void }) {
  const query = useQuery(() => listFeedMovements(feed.feedItemId), [feed.feedItemId])
  const rows = query.data ?? []
  return (
    <Modal title={`Biến động tồn kho ${feed.code} · ${feed.name}`} sub={`Tồn hiện tại ${formatKg(feed.onHandKg)} · mới nhất ở trên cùng`} topTitle="Thức ăn › Tồn kho" width={840} onClose={onClose}>
      {query.loading && !query.data && <LoadingBlock>Đang tải biến động tồn kho…</LoadingBlock>}
      {query.error ? <ErrorBlock message={userFacingError(query.error, 'Không tải được biến động tồn kho.')} onRetry={() => query.refetch()} /> : null}
      {query.data && rows.length === 0 && <EmptyBlock title="Chưa có biến động tồn kho" sub="Thức ăn này chưa có phiếu nhập, điều chỉnh hay cữ cho ăn." />}
      {rows.length > 0 && (
        <Table scroll stack={false}>
          <thead>
            <tr><Th>Thời điểm</Th><Th>Loại</Th><Th>Số lượng</Th><Th>Đơn giá</Th><Th>Tồn sau</Th><Th>Chứng từ</Th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <Td className="whitespace-nowrap">{formatDate(row.occurredAt)} {time(row.occurredAt)}</Td>
                <Td className="whitespace-nowrap"><Badge tone={row.quantityKg >= 0 ? 'ok' : 'outline'}>{TYPE_LABELS[row.movementType] ?? row.movementType}</Badge></Td>
                <Td className={`whitespace-nowrap font-medium ${row.quantityKg < 0 ? 'text-err-fg' : 'text-ok-fg'}`}>{row.quantityKg > 0 ? '+' : '−'}{formatKg(Math.abs(row.quantityKg))}</Td>
                <Td className="whitespace-nowrap">{row.unitCost === null ? '—' : `${formatMoney(row.unitCost)} đ/kg`}</Td>
                <Td className="whitespace-nowrap">{formatKg(row.balanceAfterKg)}</Td>
                <Td className="whitespace-nowrap"><Source row={row} /></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <ModalFooter className="!px-0 !pb-0"><ModalButton onClick={onClose}>Đóng</ModalButton></ModalFooter>
    </Modal>
  )
}
