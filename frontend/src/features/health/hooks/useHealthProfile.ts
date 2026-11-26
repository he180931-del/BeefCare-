import { useQuery } from '../../../shared/hooks/useQuery'
import { healthApi } from '../api/healthApi'

/** Feature-owned profile and form-option query boundaries for health tabs. */
export function useHealthProfile(cattleCode: string, caseId: string | null, demoMode?: string | null) {
  return useQuery(
    () => demoMode === 'load-error'
      ? Promise.reject(new Error('Không tải được dữ liệu sức khỏe.'))
      : healthApi.getProfile(cattleCode, caseId ?? undefined),
    [cattleCode, caseId, demoMode],
  )
}

export function useHealthFormOptions() {
  return useQuery(() => healthApi.formOptions(), [])
}
