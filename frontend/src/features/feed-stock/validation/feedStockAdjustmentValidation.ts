// Input validation moved out of src/features/feed-stock/data/feedStockAdjustmentForm.ts (refactor phase 2): field rules only, the
// business policy stays in the domain file.
import type { FeedStockRow } from '../types'
import type { FeedStockAdjustmentFormValues } from '../types/feedStockAdjustment'
import { localFeedDate } from '../domain/feedStockAdjustmentForm'

function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime())
    && date.toISOString().slice(0, 10) === value
}

export function validateFeedStockAdjustmentForm(
  values: FeedStockAdjustmentFormValues,
  stockRows: readonly FeedStockRow[],
): string | null {
  if (!isCalendarDate(values.countDate)) return 'Ngày kiểm kê không hợp lệ.'
  if (values.countDate > localFeedDate()) return 'Ngày kiểm kê không được ở tương lai.'
  if (values.countedBy.length > 200) return 'Tên người kiểm kê tối đa 200 ký tự.'
  if (!values.lines.length || values.lines.length !== stockRows.length) return 'Danh sách thức ăn đã thay đổi. Hãy tải lại màn hình.'
  const lines = new Map(values.lines.map((line) => [line.feedItemId, line]))
  if (lines.size !== values.lines.length || stockRows.some((stock) => !lines.has(stock.feedItemId))) {
    return 'Mỗi mặt hàng chỉ được kiểm kê một lần.'
  }
  for (const stock of stockRows) {
    const line = lines.get(stock.feedItemId)!
    if (line.countedKg.trim() === '') return `Nhập số đếm cho ${stock.code}.`
    const countedKg = Number(line.countedKg)
    if (!Number.isFinite(countedKg) || countedKg < 0) return `Số đếm của ${stock.code} phải là số không âm.`
    if (Math.abs(countedKg * 1000 - Math.round(countedKg * 1000)) > 1e-7) return `Số đếm của ${stock.code} tối đa 3 chữ số thập phân.`
    const differenceKg = countedKg - stock.onHandKg
    if (Math.abs(differenceKg) > 0.0005 && !line.reason.trim()) return `Nhập lý do chênh lệch cho ${stock.code}.`
  }
  return null
}
