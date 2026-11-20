import { useMemo } from 'react'
import { activeFarmId } from '../../../app/session/currentFarm'
import { useSession } from '../../../app/session/sessionContext'
import { catalogueApiForFarm } from '../api/catalogueApi'

export function useCatalogueApi() {
  const farmId = useSession()?.farmId ?? activeFarmId
  return useMemo(() => catalogueApiForFarm(farmId), [farmId])
}
