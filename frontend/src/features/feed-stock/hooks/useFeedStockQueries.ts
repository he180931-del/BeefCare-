import { useQuery } from '../../../shared/hooks/useQuery'
import { getFeedStockUpdatedAt, listFeedMovements } from '../api/feedMovementApi'
import { listFeedStock } from '../api/feedStockApi'
import { businessDate } from '../../../shared/lib/date/farmTime'
import { listFeedFeedingRecords } from '../api/feedFeedingApi'
import { listFeedRationPens, listFeedRations } from '../api/feedRationApi'
import { summarizeTodaySessions } from '../domain/feedTodayRations'
import type { FeedMovement } from '../types/feedMovement'
import type { FeedStockRow } from '../types'

/** Shared read boundary for the stock page and its freshness indicator. */
export function useFeedStock() {
  const query = useQuery<FeedStockRow[]>(() => listFeedStock(), [])
  return { ...query, rows: query.data ?? [] }
}

/** Freshness is best-effort because backend mode has no single timestamp endpoint. */
export function useFeedStockUpdatedAt() {
  return useQuery<string | null>(() => getFeedStockUpdatedAt().catch(() => null), [])
}

/** Shared read boundary for one feed item's movement history. */
export function useFeedMovements(feedItemId: number) {
  const query = useQuery<FeedMovement[]>(() => listFeedMovements(feedItemId), [feedItemId])
  return { ...query, movements: query.data ?? [] }
}

/** Complete read boundary for SCR-77, including the non-blocking dashboard hint. */
export function useFeedStockOverview() {
  const stock = useFeedStock()
  const updated = useFeedStockUpdatedAt()
  const side = useQuery(async () => {
    const date = businessDate()
    const [pens, rations, records] = await Promise.all([
      listFeedRationPens(),
      listFeedRations(),
      listFeedFeedingRecords({ from: date, to: date }),
    ])
    return {
      headCount: pens.filter((pen) => pen.status === 'ACTIVE').reduce((sum, pen) => sum + pen.headcount, 0),
      sessions: summarizeTodaySessions({ pens, rations, records, stock: [], date }),
    }
  }, [])
  return { stock, updated, side }
}
