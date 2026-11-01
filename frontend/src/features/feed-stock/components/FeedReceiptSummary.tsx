import { Tile } from '../../../components/ui'
import { summarizeFeedReceipts } from '../data/feedReceipts'
import type { FeedReceipt } from '../types/feedReceipt'

const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 })
const quantity = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 })

export default function FeedReceiptSummary({ rows }: { rows: readonly FeedReceipt[] | null }) {
  const summary = rows ? summarizeFeedReceipts(rows) : null
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <Tile
        label="Nhập trong tháng này"
        value={summary ? currency.format(summary.totalPayable) : '—'}
        note={summary ? `${summary.receiptCount} phiếu · ${quantity.format(summary.receivedKg)} kg đã ghi nhận` : 'Chưa tải được dữ liệu'}
      />
      <Tile
        label="Công nợ nhà cung cấp"
        value="—"
        note="Chưa có dữ liệu thanh toán trong danh sách receipt."
        warn
      />
      <Tile
        label="Nhà cung cấp đang hoạt động"
        value="—"
        note="API danh sách receipt không trả trạng thái nhà cung cấp."
      />
    </div>
  )
}
