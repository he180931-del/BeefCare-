import { Metric } from '../../../components/ui'
import { shortSupplierName, summarizeFeedReceipts } from '../data/feedReceipts'
import { formatKg, formatVnd } from '../domain/feedLabels'
import type { FeedSupplier } from '../types/feedCatalogue'
import type { FeedReceipt } from '../types/feedReceipt'

export default function FeedReceiptSummary({ rows, suppliers }: { rows: readonly FeedReceipt[] | null; suppliers?: readonly FeedSupplier[] | null }) {
  const summary = rows ? summarizeFeedReceipts(rows) : null
  // Most recently used suppliers first, as in the frame.
  const lastUsed = new Map<number, string>()
  rows?.forEach((row) => { if (row.receiptDate > (lastUsed.get(row.supplierId) ?? '')) lastUsed.set(row.supplierId, row.receiptDate) })
  const active = suppliers?.filter((supplier) => supplier.active)
    .sort((left, right) => (lastUsed.get(right.id) ?? '').localeCompare(lastUsed.get(left.id) ?? '') || left.name.localeCompare(right.name, 'vi'))
  const owingNote = summary && summary.owedAmount !== null
    ? summary.owingCodes.length ? `${summary.owingCodes.length} phiếu · ${summary.owingCodes.join(', ')}` : 'Không còn phiếu nào chưa trả đủ'
    : 'Chưa có dữ liệu thanh toán trong danh sách receipt.'
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <Metric
        compact
        label="Nhập kho 30 ngày qua"
        value={summary ? formatKg(summary.receivedKg, 0) : '—'}
        sub={summary ? `${summary.receiptCount} phiếu · ${formatVnd(summary.totalPayable)}` : 'Chưa tải được dữ liệu'}
      />
      <Metric compact warn label="Còn nợ nhà cung cấp" value={summary && summary.owedAmount !== null ? formatVnd(summary.owedAmount) : '—'} sub={owingNote} />
      <Metric
        compact
        label="Nhà cung cấp đang giao dịch"
        value={active ? active.length : '—'}
        sub={active?.length ? `${active.slice(0, 3).map((supplier) => shortSupplierName(supplier.name)).join(' · ')}${active.length > 3 ? ' · …' : ''}` : 'Chưa tải được nhà cung cấp'}
      />
    </div>
  )
}
