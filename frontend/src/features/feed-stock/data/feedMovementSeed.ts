import type { FeedStockRow } from '../types'
import type { FeedFeedingRecord } from '../types/feedFeeding'
import type { FeedMovement } from '../types/feedMovement'
import type { FeedReceiptDemoRecord } from '../types/feedReceiptDemo'
import { FEED_UNIT_COST } from './feedCatalogueMock'
import { isoAt } from './feedDemoDates'

type Event = Omit<FeedMovement, 'id' | 'balanceAfterKg'>

/**
 * Builds a movement history that ends exactly at the seeded stock: events are walked backwards from the
 * current balance and stop before a balance would go negative; the rest becomes an opening adjustment.
 */
export function buildMovementSeed(stocks: readonly FeedStockRow[], receipts: readonly FeedReceiptDemoRecord[], feedings: readonly FeedFeedingRecord[]): FeedMovement[] {
  const all: Array<Omit<FeedMovement, 'id'>> = []
  for (const stock of stocks) {
    const events: Event[] = []
    for (const receipt of receipts.filter((row) => row.status === 'POSTED')) {
      for (const row of receipt.lines.filter((item) => item.feedItemId === stock.feedItemId)) {
        events.push({ feedItemId: stock.feedItemId, feedCode: stock.code, movementType: 'RECEIPT', quantityKg: row.kgReceived, unitCost: row.kgReceived ? Math.round(row.lineAmount / row.kgReceived) : null, sourceType: 'RECEIPT', sourceId: receipt.id, sourceCode: receipt.code, occurredAt: `${receipt.receiptDate}T08:00:00` })
      }
    }
    for (const record of feedings) {
      for (const row of record.lines.filter((item) => item.feedItemId === stock.feedItemId && item.actualKg > 0)) {
        events.push({ feedItemId: stock.feedItemId, feedCode: stock.code, movementType: 'FEEDING', quantityKg: -row.actualKg, unitCost: row.unitCost, sourceType: 'FEEDING', sourceId: record.id, sourceCode: `${record.penCode} · cữ ${record.sessionNo}`, occurredAt: record.recordedAt ?? isoAt(0, record.time ?? '08:00') })
      }
    }
    if (stock.averageDailyUseKg > 0) {
      for (let day = 1; day <= 6; day += 1) {
        events.push({ feedItemId: stock.feedItemId, feedCode: stock.code, movementType: 'FEEDING', quantityKg: -stock.averageDailyUseKg, unitCost: FEED_UNIT_COST.get(stock.feedItemId) ?? null, sourceType: 'FEEDING', sourceId: null, sourceCode: 'Nhật ký cho ăn cả ngày', occurredAt: isoAt(-day, '17:30') })
      }
    }
    events.sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    let balance = stock.onHandKg
    const kept: Array<Omit<FeedMovement, 'id'>> = []
    for (const event of events) {
      const before = Math.round((balance - event.quantityKg) * 1000) / 1000
      if (before < 0) break
      kept.push({ ...event, balanceAfterKg: balance })
      balance = before
    }
    if (balance > 0) {
      const oldest = kept[kept.length - 1]?.occurredAt.slice(0, 10)
      const date = oldest ? new Date(`${oldest}T00:00:00`) : new Date()
      date.setDate(date.getDate() - 1)
      const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      kept.push({ feedItemId: stock.feedItemId, feedCode: stock.code, movementType: 'ADJUSTMENT', quantityKg: balance, unitCost: FEED_UNIT_COST.get(stock.feedItemId) ?? null, balanceAfterKg: balance, sourceType: 'OPENING', sourceId: null, sourceCode: 'Tồn đầu kỳ', occurredAt: `${day}T07:00:00` })
    }
    all.push(...kept.reverse())
  }
  return all.map((row, index) => ({ ...row, id: index + 1 }))
}
