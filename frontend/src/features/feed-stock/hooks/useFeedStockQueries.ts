import { useQuery } from '../../../shared/hooks/useQuery'
import { getFeedStockUpdatedAt, listFeedMovements } from '../api/feedMovementApi'
import { listFeedStock } from '../api/feedStockApi'
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
