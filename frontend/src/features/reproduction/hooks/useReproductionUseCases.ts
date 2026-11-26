import { useCallback } from 'react'
import { useQuery } from '../../../shared/hooks/useQuery'
import { reproductionApi } from '../api/reproductionApi'
import type {
  CalvingCommand,
  CalvingRecord,
  ReproductionCommand,
  ReproductionEvent,
  ReproductionFemale,
  ReproductionRole,
  WorklistFilters,
} from '../types'

export type ReproductionUseCaseScope = 'profile' | 'worklist'

export interface ReproductionUseCaseInput {
  cattleCode?: string
  role?: ReproductionRole
  scope?: ReproductionUseCaseScope
}

/**
 * Feature orchestration boundary for reproduction screens.
 *
 * Pages and tabs own presentation state only. Reads, refresh state, and
 * commands stay here so the API adapter remains the only HTTP/demo boundary
 * and all mutation responses update the profile consistently.
 */
export function useReproductionUseCases({ cattleCode, role, scope = cattleCode ? 'profile' : 'worklist' }: ReproductionUseCaseInput = {}) {
  const profileEnabled = scope === 'profile' && !!cattleCode
  const worklistEnabled = scope === 'worklist'
  const profile = useQuery<ReproductionFemale | undefined>(
    () => profileEnabled ? reproductionApi.getProfile(cattleCode as string) : Promise.resolve(undefined),
    [cattleCode, profileEnabled],
  )
  const worklist = useQuery<ReproductionFemale[]>(
    () => worklistEnabled ? reproductionApi.listWorklist() : Promise.resolve([]),
    [worklistEnabled],
  )

  const requireCattleCode = () => {
    if (!cattleCode) throw new Error('Thiếu mã bò để thực hiện thao tác sinh sản.')
    return cattleCode
  }
  const requireRole = () => role ?? 'TECHNICIAN'

  const recordEvent = useCallback(async (command: ReproductionCommand) => {
    const result = await reproductionApi.recordEvent(requireCattleCode(), command, requireRole())
    profile.setData(result)
    return result
  }, [cattleCode, role, profile.setData])

  const recordCalving = useCallback(async (command: CalvingCommand) => {
    const result = await reproductionApi.recordCalving(requireCattleCode(), command, requireRole())
    profile.setData(result)
    return result
  }, [cattleCode, role, profile.setData])

  const correctEvent = useCallback(async (eventId: string, patch: Partial<ReproductionEvent>, reason: string) => {
    const result = await reproductionApi.correctEvent(requireCattleCode(), eventId, patch, reason, requireRole())
    profile.setData(result)
    return result
  }, [cattleCode, role, profile.setData])

  const voidEvent = useCallback(async (eventId: string, reason: string) => {
    const result = await reproductionApi.voidEvent(requireCattleCode(), eventId, reason, requireRole())
    profile.setData(result)
    return result
  }, [cattleCode, role, profile.setData])

  const correctCalving = useCallback(async (calvingId: string, patch: Partial<CalvingRecord>, reason: string) => {
    const result = await reproductionApi.correctCalving(requireCattleCode(), calvingId, patch, reason, requireRole())
    profile.setData(result)
    return result
  }, [cattleCode, role, profile.setData])

  const voidCalving = useCallback(async (calvingId: string, reason: string) => {
    const result = await reproductionApi.voidCalving(requireCattleCode(), calvingId, reason, requireRole())
    profile.setData(result)
    return result
  }, [cattleCode, role, profile.setData])

  const voidCalf = useCallback(async (calvingId: string, calfId: string, reason: string) => {
    const result = await reproductionApi.voidCalf(requireCattleCode(), calvingId, calfId, reason, requireRole())
    profile.setData(result)
    return result
  }, [cattleCode, role, profile.setData])

  return {
    profile: profile.data,
    profileLoading: profile.loading,
    profileError: profile.error,
    refetchProfile: profile.refetch,
    setProfile: profile.setData,
    rows: worklist.data,
    worklistLoading: worklist.loading,
    worklistError: worklist.error,
    refetchWorklist: worklist.refetch,
    now: reproductionApi.now,
    listWorklist: (filters?: WorklistFilters) => reproductionApi.listWorklist(filters),
    getProfile: (code = requireCattleCode()) => reproductionApi.getProfile(code),
    recordEvent,
    recordCalving,
    correctEvent,
    voidEvent,
    correctCalving,
    voidCalving,
    voidCalf,
  }
}
