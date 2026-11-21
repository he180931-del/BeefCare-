import { useCallback } from 'react'
import { useQuery } from '../../../shared/hooks/useQuery'
import { growthApi } from '../api/growthApi'
import type { CorrectGrowthCommand, GrowthFilters, RecordGrowthCommand } from '../types'

/**
 * Feature-owned query and command boundary for the growth screens.
 *
 * Pages and components keep route/form/presentation state.  They consume these
 * hooks instead of reaching into the growth API adapter directly, while the
 * adapter remains the single place that switches between backend and local
 * demo implementations.
 */
export function useGrowthHerd(filters: GrowthFilters, demoMode: string | null) {
  const options = useQuery(() => growthApi.filterOptions(), [])
  const herd = useQuery(
    () => demoMode === 'load-error' ? Promise.reject(new Error('demo')) : growthApi.listHerd(filters),
    [filters.q, filters.penCode, filters.herdGroup, filters.lifeStage, filters.windowDays, filters.dir, filters.page, demoMode],
  )
  return { options, herd }
}

export function useGrowthProfile(cattleCode: string) {
  return useQuery(() => growthApi.getProfile(cattleCode), [cattleCode])
}

export function useGrowthFormOptions(cattleCode: string) {
  return useQuery(() => growthApi.formOptions(cattleCode), [cattleCode])
}

export function useGrowthCommands() {
  const record = useCallback((cattleCode: string, command: RecordGrowthCommand) => growthApi.record(cattleCode, command), [])
  const correct = useCallback((cattleCode: string, recordId: number, command: CorrectGrowthCommand) => growthApi.correct(cattleCode, recordId, command), [])
  return { record, correct }
}
