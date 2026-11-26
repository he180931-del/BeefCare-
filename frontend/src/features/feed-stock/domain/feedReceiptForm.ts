import { businessDate } from '../../../shared/lib/date/farmTime'
import type { FeedReceipt } from '../types/feedReceipt'
import type { FeedReceiptDemoRecord } from '../types/feedReceiptDemo'

export type FeedReceiptFormLine = {
  id?: number
  feedItemId: string
  lotNumber: string
  expiryDate: string
  quantityPurchase: string
  purchaseUnit: string
  unitPrice: string
}

export type FeedReceiptFormValues = {
  receiptDate: string
  supplierId: string
  invoiceNumber: string
  receivedBy: string
  storageLocation: string
  note: string
  transportFee: string
  amountPaid: string
  paymentMethod: '' | 'CASH' | 'BANK_TRANSFER'
  paymentDate: string
  balanceDueDate: string
  lines: FeedReceiptFormLine[]
}

export const todayIso = businessDate

/** Inclusive minimum for the native expiry date picker, which must be strictly after receiptDate. */
export function minimumExpiryDate(receiptDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(receiptDate)) return ''
  const [year, month, day] = receiptDate.split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1, day + 1))
  return next.toISOString().slice(0, 10)
}

export const blankFeedReceiptLine = (): FeedReceiptFormLine => ({
  feedItemId: '',
  lotNumber: '',
  expiryDate: '',
  quantityPurchase: '',
  purchaseUnit: 'kg',
  unitPrice: '',
})

/** {@code defaultReceivedBy}: phiếu mới điền sẵn người nhận hàng là người đang đăng nhập (vẫn sửa được). */
export function initialFeedReceiptForm(record: FeedReceipt | FeedReceiptDemoRecord | null, initialFeedItemId = '', defaultReceivedBy = ''): FeedReceiptFormValues {
  if (!record) return {
    receiptDate: todayIso(),
    supplierId: '',
    invoiceNumber: '',
    receivedBy: defaultReceivedBy,
    storageLocation: '',
    note: '',
    transportFee: '0',
    amountPaid: '0',
    paymentMethod: '',
    paymentDate: '',
    balanceDueDate: '',
    lines: [{ ...blankFeedReceiptLine(), feedItemId: initialFeedItemId }],
  }
  return {
    receiptDate: record.receiptDate,
    supplierId: String(record.supplierId),
    invoiceNumber: record.invoiceNumber ?? '',
    receivedBy: record.receivedBy ?? '',
    storageLocation: record.storageLocation ?? '',
    note: record.note ?? '',
    transportFee: String(record.transportFee),
    amountPaid: String(record.status === 'DRAFT' ? record.initialPaymentAmount ?? record.amountPaid ?? 0 : record.amountPaid ?? 0),
    paymentMethod: record.paymentMethod ?? '',
    paymentDate: record.paymentDate ?? '',
    balanceDueDate: record.paymentDueDate ?? ('balanceDueDate' in record ? record.balanceDueDate : ''),
    lines: record.lines.map((line) => ({
      id: line.id,
      feedItemId: String(line.feedItemId),
      lotNumber: line.lotNumber ?? '',
      expiryDate: line.expiryDate ?? '',
      quantityPurchase: String(line.quantityPurchase),
      purchaseUnit: line.purchaseUnit ?? 'kg',
      unitPrice: String(line.unitPrice),
    })),
  }
}
