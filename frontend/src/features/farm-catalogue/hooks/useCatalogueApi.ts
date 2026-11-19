import { useMemo } from 'react'
import { backendFarmId } from '../../../api/backendTransport'
import { useSession } from '../../authorization'
import { catalogueApiForFarm } from '../api/catalogueApi'

export function useCatalogueApi() {
  const farmId = useSession()?.farmId ?? backendFarmId
  return useMemo(() => catalogueApiForFarm(farmId), [farmId])
}
