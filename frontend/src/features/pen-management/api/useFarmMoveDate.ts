import { backendFarmId, backendMode, backendTransport } from '../../../api/backendTransport'
import { createFarmTimeZone, DEFAULT_FARM_TIME_ZONE, toFarmLocal } from '../../../api/farmTimeZone'
import { useQuery } from '../../../hooks/useApi'

const getFarmTimeZone = createFarmTimeZone(backendTransport, backendFarmId)

export function useFarmMoveDate(localDate: string, fixedDate?: string) {
  const useBackendZone = backendMode === 'backend' && fixedDate === undefined
  const zone = useQuery(() => useBackendZone ? getFarmTimeZone() : Promise.resolve(DEFAULT_FARM_TIME_ZONE), [useBackendZone])
  const today = fixedDate ?? (useBackendZone ? (zone.data ? toFarmLocal(new Date().toISOString(), zone.data).slice(0, 10) : '') : localDate)
  return { today, error: zone.error, retry: zone.refetch }
}
