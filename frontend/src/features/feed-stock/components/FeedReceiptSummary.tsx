import { Metric } from '../../../shared/ui'
import { shortSupplierName, summarizeFeedReceipts } from '../domain/feedReceiptList'
import { formatKg, formatVnd } from '../domain/feedLabels'
import type { FeedSupplier } from '../types/feedCatalogue'
import type { FeedReceipt } from '../types/feedReceipt'

export default function FeedReceiptSummary({ rows, suppliers }: { rows: readonly FeedReceipt[] | null; suppliers?: readonly FeedSupplier[] | null }) {
  const summary = rows ? summarizeFeedReceipts(rows) : null
  // Most recently used suppliers first, as in the frame.
  const lastUsed = new Map<number, string>()
  rows?.forEach((row) => { if (row.receiptDate > (lastUsed.get(row.supplierId) ?? '')) lastUsed.set(row.supplierId, row.receiptDate) })
  const historical = new Map<number, string>()
  rows?.forEach((row) => historical.set(row.supplierId, row.supplierName))
  const historicalNames = [...historical.entries()]
    .sort((left, right) => (lastUsed.get(right[0]) ?? '').localeCompare(lastUsed.get(left[0]) ?? '') || left[1].localeCompare(right[1], 'vi'))
    .map(([, name]) => shortSupplierName(name))
  const active = suppliers?.filter((supplier) => supplier.active)
    .sort((left, right) => (lastUsed.get(right.id) ?? '').localeCompare(lastUsed.get(left.id) ?? '') || left.name.localeCompare(right.name, 'vi'))
  const owingNote = summary && summary.owedAmount !== null
    ? summary.owingCodes.length ? `${summary.owingCodes.length} phiếu · ${summary.owingCodes.join(', ')}` : 'Không còn phiếu nào chưa trả đủ'
    : 'Chưa có dữ liệu thanh toán trong danh sách receipt.'
  const owing = summary?.owedAmount ?? 0
  const supplierSub = suppliers === null
    ? 'Không thể tải nhà cung cấp'
    : suppliers === undefined
      ? 'Chưa tải được nhà cung cấp'
      : active?.length
        ? `${active.slice(0, 3).map((supplier) => shortSupplierName(supplier.name)).join(' · ')}${active.length > 3 ? ' · …' : ''}`
        : historicalNames.length
          ? `Không có nhà cung cấp đang hoạt động · Lịch sử phiếu nhập: ${historicalNames.slice(0, 3).join(' · ')}${historicalNames.length > 3 ? ' · …' : ''}`
          : 'Không có nhà cung cấp đang hoạt động'
  // Bento (Figma Tab 21 ①b): khối nổi bật là lượng nhập trong kỳ; công nợ chỉ tô vàng khi còn nợ thật.
  return (
    <section aria-label="Chỉ số phiếu nhập kho" className="grid grid-cols-1 gap-4 @min-[640px]:grid-cols-2 @min-[1024px]:grid-cols-[minmax(0,2fr)_repeat(2,minmax(0,1fr))]">
      <Metric
        surface="panel"
        tone="emphasis"
        label="Nhập kho 30 ngày qua"
        value={summary ? formatKg(summary.receivedKg, 0) : '—'}
        sub={summary ? `${summary.receiptCount} phiếu · ${formatVnd(summary.totalPayable)}` : 'Chưa tải được dữ liệu'}
      />
      <Metric compact surface="panel" tone={owing > 0 ? 'warn' : 'default'} warn={owing > 0} label="Còn nợ nhà cung cấp" value={summary && summary.owedAmount !== null ? formatVnd(summary.owedAmount) : '—'} sub={owingNote} />
      <Metric
        compact
        surface="panel"
        label="Nhà cung cấp đang giao dịch"
        value={active ? active.length : '—'}
        sub={supplierSub}
      />
    </section>
  )
}
