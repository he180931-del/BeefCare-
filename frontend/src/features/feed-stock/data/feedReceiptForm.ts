import type { FeedStockRow } from '../types'
import type { FeedReceipt } from '../types/feedReceipt'
import type { FeedReceiptDemoRecord, FeedReceiptDraftInput, FeedReceiptDraftLineInput } from '../types/feedReceiptDemo'
import type { FeedSupplier } from '../types/feedCatalogue'

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

export const todayIso = (today = new Date()) => `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

const isCalendarDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00`)
  return !Number.isNaN(date.getTime())
    && `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` === value
}

export const blankFeedReceiptLine = (): FeedReceiptFormLine => ({
  feedItemId: '',
  lotNumber: '',
  expiryDate: '',
  quantityPurchase: '',
  purchaseUnit: 'kg',
  unitPrice: '',
})

export function initialFeedReceiptForm(record: FeedReceipt | FeedReceiptDemoRecord | null, initialFeedItemId = ''): FeedReceiptFormValues {
  if (!record) return {
    receiptDate: todayIso(),
    supplierId: '',
    invoiceNumber: '',
    receivedBy: '',
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

export function validateFeedReceiptForm(values: FeedReceiptFormValues, feedRows: readonly FeedStockRow[], suppliers: readonly FeedSupplier[], today = todayIso(), allowInactiveSupplierId?: number, allowInactiveFeedIds: readonly number[] = []): string | null {
  if (!values.receiptDate) return 'Nhập ngày nhận hàng.'
  if (!isCalendarDate(values.receiptDate)) return 'Ngày nhập không hợp lệ.'
  if (values.receiptDate > today) return 'Ngày nhập không được ở tương lai.'
  if (!values.supplierId || !suppliers.some((supplier) => supplier.id === Number(values.supplierId) && (supplier.active || supplier.id === allowInactiveSupplierId))) return 'Chọn nhà cung cấp.'
  if (values.invoiceNumber.length > 50) return 'Số hóa đơn tối đa 50 ký tự.'
  if (values.receivedBy.length > 100) return 'Người nhận tối đa 100 ký tự.'
  if (values.storageLocation.length > 100) return 'Vị trí lưu kho tối đa 100 ký tự.'
  if (values.note.length > 1000) return 'Ghi chú tối đa 1.000 ký tự.'
  const transportFee = Number(values.transportFee)
  if (!values.transportFee || !Number.isInteger(transportFee) || transportFee < 0) return 'Phí vận chuyển phải là số nguyên không âm.'
  if (!values.lines.length) return 'Thêm ít nhất một dòng thức ăn.'
  const selectedFeedIds = values.lines.map((line) => Number(line.feedItemId)).filter((id) => Number.isInteger(id) && id > 0)
  if (new Set(selectedFeedIds).size !== selectedFeedIds.length) return 'Mỗi mặt hàng chỉ được có một dòng trong phiếu.'
  for (const [index, line] of values.lines.entries()) {
    const lineNumber = index + 1
    const feedItemId = Number(line.feedItemId)
    if (!Number.isInteger(feedItemId) || !feedRows.some((row) => row.feedItemId === feedItemId && (row.available !== false || allowInactiveFeedIds.includes(row.feedItemId)))) return `Chọn thức ăn cho dòng ${lineNumber}.`
    if (line.lotNumber.length > 30) return `Số lô dòng ${lineNumber} tối đa 30 ký tự.`
    if (line.expiryDate && line.expiryDate <= values.receiptDate) return `Hạn sử dụng dòng ${lineNumber} phải sau ngày nhập.`
    const quantity = Number(line.quantityPurchase)
    if (!line.quantityPurchase || !Number.isFinite(quantity) || quantity <= 0) return `Nhập số lượng lớn hơn 0 cho dòng ${lineNumber}.`
    const unitPrice = Number(line.unitPrice)
    if (line.unitPrice === '' || !Number.isInteger(unitPrice) || unitPrice < 0) return `Đơn giá dòng ${lineNumber} phải là số nguyên không âm.`
  }
  const goodsAmount = values.lines.reduce((sum, line) => sum + Math.round(Number(line.quantityPurchase) * Number(line.unitPrice)), 0)
  const amountPaid = Number(values.amountPaid)
  if (values.amountPaid === '' || !Number.isInteger(amountPaid) || amountPaid < 0) return 'Số tiền đã trả phải là số nguyên không âm.'
  if (amountPaid > goodsAmount + transportFee) return 'Số tiền đã trả không được vượt tổng phải trả.'
  if (amountPaid > 0 && (!values.paymentMethod || !(values.paymentDate || values.receiptDate))) return 'Chọn hình thức và ngày thanh toán.'
  if (values.paymentDate && !isCalendarDate(values.paymentDate)) return 'Ngày thanh toán không hợp lệ.'
  if (values.paymentDate && (values.paymentDate > today || values.paymentDate < values.receiptDate)) return 'Ngày thanh toán phải từ ngày nhập đến hôm nay.'
  if (values.balanceDueDate && !isCalendarDate(values.balanceDueDate)) return 'Hạn thanh toán không hợp lệ.'
  return null
}

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
