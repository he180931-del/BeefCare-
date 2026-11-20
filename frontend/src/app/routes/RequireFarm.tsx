import type { ReactNode } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { parseFarmId, readCurrentFarmId } from '../session/currentFarm'

/**
 * Farm screens work in one farm and never in a default one (UC-FE02-02): the farm named in the address (`param`, for
 * the Owner pages reached from Select Farm before the farm can be entered), else the farm entered in this tab. Without
 * either they open Select Farm.
 */
export function RequireFarm({ param, children }: { param?: 'farm' | 'farmId'; children: ReactNode }) {
  const [search] = useSearchParams()
  const named = param ? parseFarmId(search.get(param)) : null
  if (named == null && readCurrentFarmId() == null) return <Navigate to="/chon-trai" replace />
  return children
}
