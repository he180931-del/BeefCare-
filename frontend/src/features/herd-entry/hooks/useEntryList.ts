import { useQuery } from '../../../shared/hooks/useQuery'
import { herdEntryApi, listEntrySellers, listPendingEntryCalves } from '../api'
import type { EntryListView } from '../api/herdEntryBackendApi'
import type { EntryCalf } from '../types'

export type EntryListPageFilters = {
  tab: string
  type: string
  source?: { id: string; name: string }
  from: string
  to: string
}

type EntryListSummary = {
  tiles: Record<string, unknown>
  counts: Record<string, number>
  totalRows: number
  ready: boolean
}

const backendSellerId = (source?: EntryListPageFilters['source']): number | undefined => {
  if (!source || !/^\d+$/.test(source.id)) return undefined
  return Number(source.id)
}

export function useEntryList(filters: EntryListPageFilters) {
  const type = filters.type === 'Bê sinh tại trại' ? 'FARM_BORN' : filters.type === 'Mua ngoài' ? 'PURCHASE' : undefined
  const sellerId = backendSellerId(filters.source)
  const { data: pendingCalves } = useQuery<EntryCalf[]>(() => listPendingEntryCalves(), [])
  const { data: sellers } = useQuery(() => listEntrySellers(), [])
  const sellerName = filters.source?.name || sellers?.find((seller) => seller.id === filters.source?.id)?.name
  const query = useQuery<EntryListView>(() => herdEntryApi.listView({ type, from: filters.from, to: filters.to, sellerId, sellerName }), [type, filters.from, filters.to, sellerId, sellerName])
  const view = query.data
  const imports = view?.rows ?? []
  const rows = imports.filter((row) => (
    (filters.tab === 'Tất cả' || row.status === filters.tab) &&
    (row.date ?? '') >= filters.from &&
    (row.date ?? '') <= filters.to
  ))

  return {
    rows,
    loading: query.loading,
    error: query.error,
    refetch: query.refetch,
    pendingCalves,
    sellers,
    summary: {
      tiles: view?.tiles ?? {},
      counts: view?.counts ?? {},
      totalRows: imports.length,
      ready: Boolean(view),
    } satisfies EntryListSummary,
  }
}
