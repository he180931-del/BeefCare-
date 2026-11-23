import { useQuery } from '../../../shared/hooks/useQuery'
import { listFeedSuppliers } from '../api/feedCatalogueApi'
import { listFeedReceipts } from '../api/feedReceiptApi'
import type { FeedSupplier } from '../types/feedCatalogue'
import type { FeedReceipt } from '../types/feedReceipt'

export type FeedReceiptListData = { receipts: FeedReceipt[]; suppliers: FeedSupplier[] | null }

/** Shared receipt-list read boundary; supplier failure is non-blocking for the receipt table. */
export function useFeedReceiptList() {
  const query = useQuery(async (): Promise<FeedReceiptListData> => {
    const [receipts, suppliers] = await Promise.all([listFeedReceipts(), listFeedSuppliers().catch(() => null)])
    return { receipts, suppliers }
  }, [])
  return { ...query, receipts: query.data?.receipts ?? [], suppliers: query.data?.suppliers ?? null }
}
