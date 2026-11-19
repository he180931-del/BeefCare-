import type { FeedStockRow } from '../types'
import { FEED_CATALOGUE_MOCK } from './feedCatalogueMock'
import { daysFromToday } from './feedDemoDates'
import { deriveFeedStockStatus } from '../domain/feedStockStatus'

// Synthetic local-demo rows shaped after StockView; quantities follow the Figma stock frame (TA-01 … TA-08).
type Seed = { onHandKg: number; averageDailyUseKg: number; lot?: [string, number] }
const SEEDS: Record<number, Seed> = {
  101: { onHandKg: 1850, averageDailyUseKg: 573 },
  102: { onHandKg: 4200, averageDailyUseKg: 68 },
  103: { onHandKg: 120, averageDailyUseKg: 12 },
  104: { onHandKg: 2300, averageDailyUseKg: 460, lot: ['L0922', 8] },
  105: { onHandKg: 1120, averageDailyUseKg: 50, lot: ['L2409', 14] },
  106: { onHandKg: 30, averageDailyUseKg: 46 },
  107: { onHandKg: 18, averageDailyUseKg: 0.5 },
  108: { onHandKg: 0, averageDailyUseKg: 3 },
}

export const FEED_STOCK_MOCK: FeedStockRow[] = FEED_CATALOGUE_MOCK.map((item) => {
  const seed = SEEDS[item.id]
  return {
    feedItemId: item.id,
    code: item.code,
    name: item.name,
    group: item.group as FeedStockRow['group'],
    onHandKg: seed.onHandKg,
    minimumStockKg: item.minimumStockKg,
    averageDailyUseKg: seed.averageDailyUseKg,
    daysOfCover: Math.round((seed.onHandKg / seed.averageDailyUseKg) * 10) / 10,
    stockValue: Math.round(seed.onHandKg * item.unitCost),
    status: deriveFeedStockStatus(seed.onHandKg, item.minimumStockKg, seed.averageDailyUseKg),
    version: item.version,
    nearestLotNumber: seed.lot ? seed.lot[0] : null,
    nearestLotExpiryDate: seed.lot ? daysFromToday(seed.lot[1]) : null,
  }
})
