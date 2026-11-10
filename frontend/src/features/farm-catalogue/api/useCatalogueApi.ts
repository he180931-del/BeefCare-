import { useMemo } from 'react'
import { backendFarmId, backendMode, backendTransport } from '../../../api/backendTransport'
import { useSession } from '../../authorization'
import { catalogueDemoStore } from '../data/catalogueDemoStore'
import { catalogueApi, createCatalogueApi } from './catalogueApi'

export function useCatalogueApi() {
  const farmId = useSession()?.farmId ?? backendFarmId
  return useMemo(() => backendMode === 'backend'
    ? createCatalogueApi({ mode: backendMode, farmId, transport: backendTransport, store: catalogueDemoStore })
    : catalogueApi, [farmId])
}
