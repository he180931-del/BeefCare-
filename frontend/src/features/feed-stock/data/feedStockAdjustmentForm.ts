import type { FeedStockRow } from '../types'
import type {
  FeedStockAdjustment,
  FeedStockAdjustmentDraftInput,
  FeedStockAdjustmentFormValues,
  FeedStockAdjustmentType,
} from '../types/feedStockAdjustment'

const isAdjustmentType = (value: string): value is FeedStockAdjustmentType =>
  value === 'PERIODIC_COUNT' || value === 'LOSS' || value === 'SPOILAGE' || value === 'OTHER'

export function localFeedDate() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00`)
  return !Number.isNaN(date.getTime())
    && `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` === value
}

export function initialFeedStockAdjustmentForm(
  record: FeedStockAdjustment | null,
  stockRows: readonly FeedStockRow[],
): FeedStockAdjustmentFormValues {
  const savedLines = new Map(record?.lines.map((line) => [line.feedItemId, line]) ?? [])
  return {
    countDate: record?.countDate ?? localFeedDate(),
    adjustmentType: record && isAdjustmentType(record.adjustmentType) ? record.adjustmentType : 'PERIODIC_COUNT',
    countedBy: record?.countedBy ?? '',
    lines: stockRows.map((stock) => {
      const saved = savedLines.get(stock.feedItemId)
      return {
        feedItemId: stock.feedItemId,
        countedKg: String(saved?.countedKg ?? stock.onHandKg),
        reason: saved?.reason ?? '',
      }
    }),
  }
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

export function toFeedStockAdjustmentDraftInput(
  values: FeedStockAdjustmentFormValues,
  id?: number,
): FeedStockAdjustmentDraftInput {
  return {
    ...(id === undefined ? {} : { id }),
    countDate: values.countDate,
    adjustmentType: values.adjustmentType,
    countedBy: values.countedBy,
    lines: values.lines.map((line) => ({
      feedItemId: line.feedItemId,
      countedKg: Number(line.countedKg),
      reason: line.reason,
    })),
  }
}

export type FeedStockAdjustmentPreviewLine = {
  stock: FeedStockRow
  countedKg: number | null
  differenceKg: number | null
  unitCost: number | null
  differenceValue: number | null
}

export function previewFeedStockAdjustment(
  values: FeedStockAdjustmentFormValues,
  stockRows: readonly FeedStockRow[],
): { lines: FeedStockAdjustmentPreviewLine[]; changedFeeds: number; totalDifferenceKg: number | null; totalValue: number | null } {
  const lines = stockRows.map((stock) => {
    const value = values.lines.find((line) => line.feedItemId === stock.feedItemId)?.countedKg ?? ''
    const countedKg = value.trim() && Number.isFinite(Number(value)) ? Number(value) : null
    const differenceKg = countedKg === null ? null : Math.round((countedKg - stock.onHandKg) * 1000) / 1000
    const unitCost = stock.onHandKg > 0 ? stock.stockValue / stock.onHandKg : null
    const differenceValue = differenceKg === null ? null : differenceKg === 0 ? 0 : unitCost === null ? null : Math.round(differenceKg * unitCost)
    return { stock, countedKg, differenceKg, unitCost, differenceValue }
  })
  const complete = lines.every((line) => line.differenceKg !== null)
  const totalDifferenceKg = complete ? Math.round(lines.reduce((sum, line) => sum + (line.differenceKg ?? 0), 0) * 1000) / 1000 : null
  const totalValue = lines.every((line) => line.differenceKg === 0 || line.differenceValue !== null)
    ? lines.reduce((sum, line) => sum + (line.differenceValue ?? 0), 0)
    : null
  return {
    lines,
    changedFeeds: lines.filter((line) => line.differenceKg !== null && Math.abs(line.differenceKg) > 0.0005).length,
    totalDifferenceKg,
    totalValue,
  }
}

/** Next ĐCK-YYYY-nnnn shown on a new adjustment; the store assigns the same code when the draft is saved. */
export function nextFeedAdjustmentCode(codes: readonly string[], year = new Date().getFullYear()) {
  const prefix = `ĐCK-${year}-`
  const max = Math.max(0, ...codes.filter((code) => code.startsWith(prefix)).map((code) => Number(code.slice(prefix.length)) || 0))
  return `${prefix}${String(max + 1).padStart(4, '0')}`
}
