import { useQuery } from '../../../shared/hooks/useQuery'
import { healthApi } from '../api/healthApi'
import type { HealthCaseFilters } from '../types'

/** Feature-owned query boundary for the health case list page. */
export function useHealthCases(filters: HealthCaseFilters, demoMode: string | null) {
  return useQuery(
    () => demoMode === 'load-error'
      ? Promise.reject(new Error('Không tải được danh sách ca sức khỏe.'))
      : healthApi.listCases(filters),
    [filters.tab, filters.search, filters.severity, filters.penCode, filters.from, filters.to, filters.sort, filters.dir, demoMode],
  )
}
