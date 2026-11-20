// Request payload mapping moved out of src/features/feed-stock/data/feedReceiptForm.ts (refactor phase 2): form values → API input.
import type { FeedStockRow } from '../types'
import type { FeedReceiptDraftInput, FeedReceiptDraftLineInput } from '../types/feedReceiptDemo'
import type { FeedSupplier } from '../types/feedCatalogue'
import { type FeedReceiptFormValues } from '../domain/feedReceiptForm'

export function toFeedReceiptDraftInput(values: FeedReceiptFormValues, feedRows: readonly FeedStockRow[], suppliers: readonly FeedSupplier[], recordId?: number, allowInactiveSupplierId?: number, allowInactiveFeedIds: readonly number[] = []): FeedReceiptDraftInput {
  const supplier = suppliers.find((item) => item.id === Number(values.supplierId) && (item.active || item.id === allowInactiveSupplierId))
  if (!supplier) throw new Error('Chọn nhà cung cấp.')
  const lines: FeedReceiptDraftLineInput[] = values.lines.map((line) => {
    const feed = feedRows.find((item) => item.feedItemId === Number(line.feedItemId))
    if (!feed || feed.available === false && !allowInactiveFeedIds.includes(feed.feedItemId)) throw new Error('Chọn thức ăn đang hoạt động trong danh sách.')
    return {
      ...(line.id !== undefined ? { id: line.id } : {}),
      feedItemId: feed.feedItemId,
      feedCode: feed.code,
      feedName: feed.name,
      lotNumber: line.lotNumber.trim() || null,
      expiryDate: line.expiryDate || null,
      quantityPurchase: Number(line.quantityPurchase),
      purchaseUnit: line.purchaseUnit || 'kg',
      kgPerPurchaseUnit: line.purchaseUnit.toLocaleLowerCase('vi') === 'kg' ? 1 : feed.kgPerPurchaseUnit ?? 1,
      unitPrice: Number(line.unitPrice),
    }
  })
  return {
    ...(recordId !== undefined ? { id: recordId } : {}),
    receiptDate: values.receiptDate,
    supplierId: supplier.id,
    supplierName: supplier.name,
    invoiceNumber: values.invoiceNumber.trim(),
    receivedBy: values.receivedBy.trim(),
    storageLocation: values.storageLocation.trim(),
    note: values.note.trim(),
    transportFee: Number(values.transportFee),
    amountPaid: Number(values.amountPaid),
    paymentMethod: values.paymentMethod || null,
    paymentDate: values.paymentDate,
    balanceDueDate: values.balanceDueDate,
    lines,
  }
}
