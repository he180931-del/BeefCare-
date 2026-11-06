import type { FeedFeedingRecord } from './feedFeeding'
import type { FeedCatalogueItem } from './feedCatalogue'
import type { FeedReceipt } from './feedReceipt'
import type { FeedRation } from './feedRation'
import type { FeedStockAdjustment } from './feedStockAdjustment'

export type FeedConsumptionRange = { from: string; to: string }
export type FeedConsumptionGroupBy = 'HERD_GROUP' | 'PEN' | 'FEED'
export type FeedConsumptionFilters = FeedConsumptionRange & {
  groupBy: FeedConsumptionGroupBy
  feedItemId?: number | 'ALL'
  penId?: number | 'ALL'
  herdGroup?: string | 'ALL'
}

export type FeedConsumptionBackendRow = {
  penId: number
  penCode: string
  herdGroup: string
  feedItemId: number
  feedCode: string
  plannedKg: number
  actualKg: number
  varianceRatio: number | null
  totalCost: number | null
}

export type FeedConsumptionBackendReport = {
  from: string
  to: string
  rows: FeedConsumptionBackendRow[]
  adjustmentLossKg: number | null
  adjustmentLossValue: number | null
  generatedAt: string | null
}

export type FeedConsumptionSupportingData = {
  feedings: FeedFeedingRecord[]
  receipts: FeedReceipt[]
  adjustments: FeedStockAdjustment[]
  catalogue: FeedCatalogueItem[]
  rations: FeedRation[]
}

export type FeedConsumptionApiResult = FeedConsumptionSupportingData & {
  source: 'demo' | 'backend'
  backendReport: FeedConsumptionBackendReport | null
}

export type FeedConsumptionProjectionRow = {
  key: string
  label: string
  penId: number | null
  feedItemId: number | null
  herdGroup: string | null
  plannedKg: number
  actualKg: number
  varianceRatio: number | null
  totalCost: number | null
  headDays: number
  days: number
}

export type FeedConsumptionProjection = {
  from: string
  to: string
  groupBy: FeedConsumptionGroupBy
  rows: FeedConsumptionProjectionRow[]
  days: number
  headDays: number
  feedings: FeedFeedingRecord[]
  receipts: FeedReceipt[]
  adjustmentLossKg: number | null
  adjustmentLossValue: number | null
  costKnown: boolean
}

export type FeedConsumptionSummary = {
  actualKg: number
  plannedKg: number
  cost: number | null
  days: number
  headDays: number
  averageKgPerHeadDay: number | null
  averageCostPerHeadDay: number | null
  receivedKg: number
  receiptCount: number
  receivedAmount: number | null
  receivedAmountIsGoodsOnly: boolean
}
