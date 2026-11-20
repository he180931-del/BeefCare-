import type { ReactNode } from 'react'
import { Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { parseFarmId, readCurrentFarmId, type SelectFarmState } from '../session/currentFarm'

/**
 * Farm screens work in one farm and never in a default one (UC-FE02-02): the farm named in the address (`param`, for
 * the Owner pages reached from Select Farm before the farm can be entered), else the farm entered in this tab. Without
 * either they open Select Farm, which opens the only ACTIVE farm directly (AF4) and comes back to the requested screen.
 */
export function RequireFarm({ param, children }: { param?: 'farm' | 'farmId'; children: ReactNode }) {
  const [search] = useSearchParams()
  const location = useLocation()
  const named = param ? parseFarmId(search.get(param)) : null
  if (named == null && readCurrentFarmId() == null) {
    const state: SelectFarmState = { fromSignIn: true, returnTo: location.pathname + location.search }
    return <Navigate to="/chon-trai" replace state={state} />
  }
  return children
}
