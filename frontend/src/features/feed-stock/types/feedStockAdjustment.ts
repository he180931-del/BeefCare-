import type { FeedStockRow } from '../types'

export type FeedStockAdjustmentStatus = 'DRAFT' | 'POSTED'
export type FeedStockAdjustmentType = 'PERIODIC_COUNT' | 'LOSS' | 'SPOILAGE' | 'OTHER'

/** Mirrors AdjustmentView while allowing unknown backend status strings and unavailable local values. */
export type FeedStockAdjustmentLine = {
  feedItemId: number
  feedCode: string
  feedName: string
  systemKg: number
  countedKg: number
  differenceKg: number
  reason: string | null
  unitCost: number | null
  differenceValue: number | null
}

export type FeedStockAdjustment = {
  id: number
  code: string
  countDate: string
  adjustmentType: string
  countedBy: string
  status: string
  totalDifferenceKg: number
  totalValue: number | null
  postedAt: string | null
  version: number
  lines: FeedStockAdjustmentLine[]
}

export type FeedStockAdjustmentDraftLineInput = {
  feedItemId: number
  countedKg: number
  reason: string
}

export type FeedStockAdjustmentDraftInput = {
  id?: number
  countDate: string
  adjustmentType: FeedStockAdjustmentType
  countedBy: string
  lines: FeedStockAdjustmentDraftLineInput[]
}

export type FeedStockAdjustmentDemoRecord = FeedStockAdjustment & {
  lines: FeedStockAdjustmentLine[]
  [key: string]: unknown
}

export type FeedStockAdjustmentDemoStore = {
  list: () => Promise<FeedStockAdjustmentDemoRecord[]>
  get: (id: string) => Promise<FeedStockAdjustmentDemoRecord>
  saveDraft: (input: FeedStockAdjustmentDraftInput) => Promise<FeedStockAdjustmentDemoRecord>
  post: (id: number) => Promise<FeedStockAdjustmentDemoRecord>
  reset: () => Promise<void>
}

export type FeedStockAdjustmentFormValues = {
  countDate: string
  adjustmentType: FeedStockAdjustmentType
  countedBy: string
  lines: Array<{ feedItemId: number; countedKg: string; reason: string }>
}

export type FeedStockAdjustmentStock = FeedStockRow
