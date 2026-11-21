import { useQuery } from '../../../shared/hooks/useQuery'
import { penApi } from '../api/penApi'
import type { PenDetail } from '../api/penApi'
import type { Pen } from '../types'

/**
 * Owns the pen catalogue read used by the list screen. The page only decides
 * how to filter and present the returned rows; HTTP/local-mode selection stays
 * behind the feature API boundary.
 */
export function usePenList() {
  const query = useQuery(() => penApi.list(), [])
  return { ...query, pens: query.data ?? [] }
}

/**
 * Loads the selected pen detail and its current cattle. The dependency list
 * mirrors the existing screen contract so a refreshed list invalidates the
 * detail without moving selection or URL policy into the hook.
 */
export function usePenDetail(selected?: Pen | null) {
  return useQuery<PenDetail | null>(
    () => (selected ? penApi.detail(selected) : Promise.resolve(null)),
    [selected?.code, selected?.lockVersion, selected?.count, selected?.status],
  )
}
