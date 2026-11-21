import { useMutation } from '../../../shared/hooks/useMutation'
import { useQuery } from '../../../shared/hooks/useQuery'
import { listFeedCatalogue, listFeedSuppliers, saveFeedCatalogueItem, saveFeedSupplier, setFeedSupplierActive } from '../api/feedCatalogueApi'
import { listFeedStock } from '../api/feedStockApi'
import { newFeedCommandKey, type FeedCommandOptions } from '../api/command'
import type { FeedCatalogueItem, FeedCatalogueSaveInput, FeedSupplier, FeedSupplierInput } from '../types/feedCatalogue'
import type { FeedStockRow } from '../types'

export type FeedCatalogueData = { items: FeedCatalogueItem[]; suppliers: FeedSupplier[]; stock: FeedStockRow[] }

type SaveFeedPayload = { input: FeedCatalogueSaveInput; options?: FeedCommandOptions }
type SaveSupplierPayload = { input: FeedSupplierInput; options?: FeedCommandOptions }
type SupplierStatusPayload = { id: number; active: boolean; version?: number; options?: FeedCommandOptions }

function withKey(options: FeedCommandOptions | undefined, scope: string): FeedCommandOptions {
  return { ...options, key: options?.key ?? newFeedCommandKey(scope) }
}

/** Semantic boundary for catalogue reads and commands used by SCR-84. */
export function useFeedCatalogue() {
  const query = useQuery<FeedCatalogueData>(async () => {
    const [items, suppliers, stock] = await Promise.all([listFeedCatalogue(), listFeedSuppliers(), listFeedStock()])
    return { items, suppliers, stock }
  }, [])
  const saveFeed = useMutation<SaveFeedPayload, FeedCatalogueItem>(({ input, options }) => saveFeedCatalogueItem(input, withKey(options, 'feed-catalogue')))
  const saveSupplier = useMutation<SaveSupplierPayload, FeedSupplier>(({ input, options }) => saveFeedSupplier(input, withKey(options, 'feed-supplier')))
  const setSupplierActive = useMutation<SupplierStatusPayload, FeedSupplier>(({ id, active, version, options }) => setFeedSupplierActive(id, active, version, withKey(options, 'feed-supplier-status')))
  return {
    ...query,
    items: query.data?.items ?? [],
    suppliers: query.data?.suppliers ?? [],
    stock: query.data?.stock ?? [],
    saveFeed: saveFeed.mutate,
    saveSupplier: saveSupplier.mutate,
    setSupplierActive: setSupplierActive.mutate,
    saving: saveFeed.loading || saveSupplier.loading || setSupplierActive.loading,
    commandError: saveFeed.error ?? saveSupplier.error ?? setSupplierActive.error,
  }
}
