import { useState } from 'react'
import { useQuery } from '../../../shared/hooks/useQuery'
import { catalogueApiForFarm } from '../api/catalogueApi'
import { useCatalogueApi } from './useCatalogueApi'
import { useCanEdit } from './useCanEdit'
import { useCatalogueEditor, type EditorItem } from './useCatalogueEditor'
import type { AvailabilityFilter, CatalogueFilters } from '../types'

type CatalogueApi = ReturnType<typeof catalogueApiForFarm>

interface Config<I extends EditorItem, D extends { available: boolean }> {
  list: (filters: CatalogueFilters) => Promise<I[]>
  newDraft: () => D
  toDraft: (item: I) => D
  save: (item: I | null, draft: D) => Promise<I>
  usage: (item: I) => number
  remove?: (item: I) => Promise<unknown>
}

/**
 * Owns the read/query and editor orchestration for the four catalogue item
 * screens. Pages remain responsible for rendering fields and tables only.
 */
export function useCatalogueItemPage<I extends EditorItem, D extends { available: boolean }>(
  configure: (api: CatalogueApi) => Config<I, D>,
) {
  const api = useCatalogueApi()
  const canEdit = useCanEdit()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<AvailabilityFilter>('')
  const config = configure(api)
  const list = useQuery(() => config.list({ q, status }), [q, status])
  const editor = useCatalogueEditor<I, D>({
    items: list.data,
    canEdit,
    newDraft: config.newDraft,
    toDraft: config.toDraft,
    refetch: list.refetch,
    usage: config.usage,
    save: config.save,
  })
  return { ...list, ...editor, canEdit, q, setQ, status, setStatus, remove: config.remove }
}
