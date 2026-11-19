import { useMemo } from 'react'
import { backendFarmId } from '../../../api/backendTransport'
import { backendMode } from '../../../shared/config/runtime'
import { backendTransport } from '../../../shared/api/backendTransport'
import { useSession } from '../../authorization'
import { catalogueDemoStore } from '../data/catalogueDemoStore'
import { catalogueApi, createCatalogueApi } from '../api/catalogueApi'

export function useCatalogueApi() {
  const farmId = useSession()?.farmId ?? backendFarmId
  return useMemo(() => backendMode === 'backend'
    ? createCatalogueApi({ mode: backendMode, farmId, transport: backendTransport, store: catalogueDemoStore })
    : catalogueApi, [farmId])
}
