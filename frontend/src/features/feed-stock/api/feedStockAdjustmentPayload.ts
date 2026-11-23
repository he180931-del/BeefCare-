// Request payload mapping moved out of src/features/feed-stock/data/feedStockAdjustmentForm.ts (refactor phase 2): form values → API input.
import type { FeedStockAdjustmentDraftInput, FeedStockAdjustmentFormValues } from '../types/feedStockAdjustment'

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
