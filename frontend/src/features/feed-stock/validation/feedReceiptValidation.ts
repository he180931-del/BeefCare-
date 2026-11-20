// Input validation moved out of src/features/feed-stock/data/feedReceiptForm.ts (refactor phase 2): field rules only, the
// business policy stays in the domain file.
import type { FeedStockRow } from '../types'
import type { FeedSupplier } from '../types/feedCatalogue'
import { type FeedReceiptFormValues, todayIso } from '../domain/feedReceiptForm'

const isCalendarDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime())
    && date.toISOString().slice(0, 10) === value
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
