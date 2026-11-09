import { useMemo } from 'react'
import { useQuery } from '../../../hooks/useApi'
import { useDemoState } from '../../../hooks/useDemoState'
import { subscriptionApi } from '../api/subscriptionApi'
import { backendMode } from '../../../api/backendTransport'

/** Tổng quan gói của trại; `?demo=price-unavailable` mô phỏng bảng giá không lấy được (frame 2473:8159). */
export function useOverview(farmId: number) {
  const demo = useDemoState()
  const q = useQuery(() => subscriptionApi.getOverview(farmId), [farmId])
  const data = useMemo(
    () => {
      if (q.data?.farmId !== farmId) return null
      return backendMode === 'local' && demo === 'price-unavailable'
        ? { ...q.data, currentPrices: null, eligibility: { ok: false as const, reason: 'PRICE_UNAVAILABLE' as const } } : q.data
    },
    [q.data, demo, farmId],
  )
  return { ...q, data, loading: q.loading || !!(q.data && q.data.farmId !== farmId) }
}
