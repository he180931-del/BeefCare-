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
  groupBy: FeedConsumptionGroupBy
  tiles: FeedConsumptionReportTiles
  rows: FeedConsumptionReportGroupedRow[]
  total: FeedConsumptionReportTotal
  costByFeed: FeedConsumptionReportCostByFeed[]
  adjustmentLosses: { kg: number; value: number }
  rawRows: FeedConsumptionBackendRow[]
  adjustmentLossKg: number | null
  adjustmentLossValue: number | null
  generatedAt: string | null
}

export type FeedConsumptionReportTiles = {
  kg: number
  cost: number
  averageKgPerHeadDay: number
  averageCostPerHeadDay: number
  days: number
  headDays: number
  receivedKg: number
  receiptCount: number
  receivedAmount: number
}

export type FeedConsumptionReportGroupedRow = {
  group: string
  avgHead: number
  kg: number
  kgPerHeadDay: number
  cost: number
  costPerHeadDay: number
  variancePct: number | null
  notes: string[]
}

export type FeedConsumptionReportTotal = {
  kg: number
  cost: number
  kgPerHeadDay: number
  costPerHeadDay: number
  days: number
  headDays: number
}
export type FeedConsumptionReportCostByFeed = { feedCode: string; feedName: string; kg: number; cost: number }

/** Display projection of the grouped server contract; no client-side re-aggregation. */
export type FeedConsumptionServerRow = {
  key: string
  label: string
  herdGroup: string | null
  averageHead: number
  actualKg: number
  averageKgPerHeadDay: number
  totalCost: number
  averageCostPerHeadDay: number
  varianceRatio: number | null
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
