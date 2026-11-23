import { useCallback, useMemo } from 'react'
import { useQuery } from '../../../shared/hooks/useQuery'
import type { CatalogueApi } from '../api/catalogueApi'
import type { CatalogueFilters, ParameterVersionCommand } from '../types'
import { useCatalogueApi } from './useCatalogueApi'

/** Feature-owned boundary for catalogue reads and commands. */
export type CatalogueUseCase = Pick<CatalogueApi,
  'listBreeds' | 'saveBreed' | 'listVaccines' | 'saveVaccine' | 'deleteVaccine'
  | 'listMedicines' | 'saveMedicine' | 'listPurposes' | 'savePurpose'
  | 'listParameterVersions' | 'saveParameterVersion'
>

export function useCatalogueUseCase(): CatalogueUseCase {
  const api = useCatalogueApi()
  return useMemo(() => ({
    listBreeds: (filters: CatalogueFilters = {}) => api.listBreeds(filters),
    saveBreed: api.saveBreed,
    listVaccines: (filters: CatalogueFilters = {}) => api.listVaccines(filters),
    saveVaccine: api.saveVaccine,
    deleteVaccine: api.deleteVaccine,
    listMedicines: (filters: CatalogueFilters = {}) => api.listMedicines(filters),
    saveMedicine: api.saveMedicine,
    listPurposes: (filters: CatalogueFilters = {}) => api.listPurposes(filters),
    savePurpose: api.savePurpose,
    listParameterVersions: api.listParameterVersions,
    saveParameterVersion: api.saveParameterVersion,
  }), [api])
}

/** Query and command boundary for the parameter-version screen. */
export function useCatalogueParametersUseCase() {
  const useCase = useCatalogueUseCase()
  const versions = useQuery(() => useCase.listParameterVersions(), [])
  const saveParameterVersion = useCallback(
    (command: ParameterVersionCommand, author?: string) => useCase.saveParameterVersion(command, author),
    [useCase],
  )
  return { ...versions, saveParameterVersion }
}
