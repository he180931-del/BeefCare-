import { useRef } from 'react'
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

type IntentKeyState = { fingerprint: string; key: string }

function intentKey(
  state: { current?: IntentKeyState },
  input: unknown,
  options: FeedCommandOptions | undefined,
  scope: string,
): FeedCommandOptions {
  if (options?.key !== undefined) return options
  const fingerprint = JSON.stringify(input)
  if (!state.current || state.current.fingerprint !== fingerprint) {
    state.current = { fingerprint, key: newFeedCommandKey(scope) }
  }
  return { ...options, key: state.current.key }
}

/** Semantic boundary for catalogue reads and commands used by SCR-84. */
export function useFeedCatalogue() {
  const query = useQuery<FeedCatalogueData>(async () => {
    const [items, suppliers, stock] = await Promise.all([listFeedCatalogue(), listFeedSuppliers(), listFeedStock()])
    return { items, suppliers, stock }
  }, [])
  const saveFeedKey = useRef<IntentKeyState>()
  const saveSupplierKey = useRef<IntentKeyState>()
  const supplierStatusKey = useRef<IntentKeyState>()
  const saveFeed = useMutation<SaveFeedPayload, FeedCatalogueItem>(({ input, options }) => saveFeedCatalogueItem(input, intentKey(saveFeedKey, input, options, 'feed-catalogue')))
  const saveSupplier = useMutation<SaveSupplierPayload, FeedSupplier>(({ input, options }) => saveFeedSupplier(input, intentKey(saveSupplierKey, input, options, 'feed-supplier')))
  const setSupplierActive = useMutation<SupplierStatusPayload, FeedSupplier>(({ id, active, version, options }) => setFeedSupplierActive(id, active, version, intentKey(supplierStatusKey, { id, active, version }, options, 'feed-supplier-status')))

  const saveFeedCommand = async (payload: SaveFeedPayload) => {
    const result = await saveFeed.mutate(payload)
    if (payload.options?.key === undefined) saveFeedKey.current = undefined
    return result
  }
  const saveSupplierCommand = async (payload: SaveSupplierPayload) => {
    const result = await saveSupplier.mutate(payload)
    if (payload.options?.key === undefined) saveSupplierKey.current = undefined
    return result
  }
  const setSupplierActiveCommand = async (payload: SupplierStatusPayload) => {
    const result = await setSupplierActive.mutate(payload)
    if (payload.options?.key === undefined) supplierStatusKey.current = undefined
    return result
  }
  return {
    ...query,
    items: query.data?.items ?? [],
    suppliers: query.data?.suppliers ?? [],
    stock: query.data?.stock ?? [],
    saveFeed: saveFeedCommand,
    saveSupplier: saveSupplierCommand,
    setSupplierActive: setSupplierActiveCommand,
    saving: saveFeed.loading || saveSupplier.loading || setSupplierActive.loading,
    commandError: saveFeed.error ?? saveSupplier.error ?? setSupplierActive.error,
  }
}
