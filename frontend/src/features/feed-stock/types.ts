export type FeedStockStatus = 'OUT_OF_STOCK' | 'LOW' | 'SUFFICIENT'
export type FeedGroup =
  | 'GREEN_ROUGHAGE'
  | 'DRY_ROUGHAGE'
  | 'CONCENTRATE'
  | 'TMR'
  | 'MINERAL_ADDITIVE'
  | 'CALF_FEED'

/** Read projection returned by GET /api/farms/{farmId}/feed/stock (StockView). */
export type FeedStockRow = {
  feedItemId: number
  code: string
  name: string
  group: FeedGroup
  onHandKg: number
  minimumStockKg: number | null
  averageDailyUseKg: number
  daysOfCover: number | null
  stockValue: number
  status: FeedStockStatus
  version: number
  nearestLotNumber: string | null
  nearestLotExpiryDate: string | null
  /** Local catalogue metadata used by the receipt form; backend mode fills it from the catalogue GET. */
  available?: boolean
  purchaseUnit?: string
  kgPerPurchaseUnit?: number
}
