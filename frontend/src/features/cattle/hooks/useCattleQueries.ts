import { useQuery } from '../../../shared/hooks/useQuery'
import {
  listBarns,
  listBreeds,
  listCattleTimeline,
  listCows,
  listCattleReminders,
  listCowsPage,
  listPurposes,
  loadProfile,
  localCattleList,
} from '../api/cattleApi'
import type { CattleEvent, CattleViewModel as CowSeed } from '../types'
import type { CattleListOptions, CattlePage } from '../api/cattleBackendApi'
import { LIFE_STAGE_OPTIONS } from '../api/cattleBackendApi'

export { LIFE_STAGE_OPTIONS }

/** Query orchestration for the Cattle screens. Pages/components only consume these feature-owned results. */
export function useCattleListQueries(options: CattleListOptions & { weightFilter?: string } = {}) {
  const { weightFilter, ...listOptions } = options
  const backend = localCattleList === null
  const listQuery = useQuery(
    () => backend
      ? listCowsPage({ ...listOptions, hasWeight: weightFilter ? weightFilter === 'yes' : undefined })
      : listCows().then((items): CattlePage => ({ items, total: items.length, page: 0, size: items.length, counts: {} })),
    [backend, listOptions.q, listOptions.breedId, listOptions.sex, listOptions.penId, listOptions.purposeId, listOptions.lifeStage, listOptions.health, listOptions.herdStatus, listOptions.herdGroup, listOptions.page, listOptions.sort, weightFilter],
  )
  const barnsQuery = useQuery(listBarns, [])
  const breedsQuery = useQuery(() => listBreeds().catch(() => []), [])
  const purposesQuery = useQuery(() => listPurposes().catch(() => []), [])
  return { backend, local: localCattleList, listQuery, barnsQuery, breedsQuery, purposesQuery }
}

export function useCattleProfileQuery(code: string) {
  return useQuery(() => loadProfile(code), [code])
}

export { useTechnicianHerdQuery } from './useTechnicianHerdQuery'

export function useCattlePurposeQuery() {
  const purposes = useQuery(() => listPurposes(), [])
  return { ...purposes, local: localCattleList }
}

export function useCattleTimelineQuery(cow: CowSeed, showCorrections: boolean) {
  const cattleId = cow.backendId
  const query = useQuery(async () => cattleId != null
    ? { showCorrections, events: await listCattleTimeline(cattleId, showCorrections) }
    : { showCorrections, events: cow.events }, [cattleId, showCorrections, cow.events])
  const events: CattleEvent[] = cattleId != null && query.data?.showCorrections === showCorrections
    ? query.data.events
    : cow.events
  return { ...query, cattleId, events }
}

/** SCR-19 #22 / #13: backend reminders of the cattle; a failure stays inside the reminders block. */
export function useCattleRemindersQuery(cow: CowSeed | undefined) {
  const cattleId = cow?.backendId
  return useQuery(async () => (cattleId != null ? listCattleReminders(cattleId) : null), [cattleId])
}
