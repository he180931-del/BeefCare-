import { businessDate } from '../../../shared/lib/date/farmTime'
import type { FeedStockRow } from '../types'
import type { FeedStockAdjustment, FeedStockAdjustmentFormValues, FeedStockAdjustmentType } from '../types/feedStockAdjustment'

const isAdjustmentType = (value: string): value is FeedStockAdjustmentType =>
  value === 'PERIODIC_COUNT' || value === 'LOSS' || value === 'SPOILAGE' || value === 'OTHER'

export const localFeedDate = businessDate

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
export function nextFeedAdjustmentCode(codes: readonly string[], year = Number(businessDate().slice(0, 4))) {
  const prefix = `ĐCK-${year}-`
  const max = Math.max(0, ...codes.filter((code) => code.startsWith(prefix)).map((code) => Number(code.slice(prefix.length)) || 0))
  return `${prefix}${String(max + 1).padStart(4, '0')}`
}
