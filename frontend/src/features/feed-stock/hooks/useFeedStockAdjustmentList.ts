import { useQuery } from '../../../shared/hooks/useQuery'
import { listFeedStockAdjustments } from '../api/feedStockAdjustmentApi'
import type { FeedStockAdjustment } from '../types/feedStockAdjustment'

/** Shared read boundary for the stock-adjustment history screen. */
export function useFeedStockAdjustmentList() {
  const query = useQuery<FeedStockAdjustment[]>(() => listFeedStockAdjustments(), [])
  return { ...query, adjustments: query.data ?? [] }
}
