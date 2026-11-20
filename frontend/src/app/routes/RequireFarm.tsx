import type { ReactNode } from 'react'
import { Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { parseFarmId, readCurrentFarmId, sectionPath, type SelectFarmState } from '../session/currentFarm'

/**
 * Farm screens work in one farm and never in a default one (UC-FE02-02): the farm named in the address (`param`, for
 * the Owner pages reached from Select Farm before the farm can be entered), else the farm entered in this tab. Without
 * either they open Select Farm, which opens the only ACTIVE farm directly (AF4) and comes back to the requested section
 * (not to a record: its code may name another animal in the farm entered). It runs before RoleGate: the role is known
 * only once the farm is.
 */
export function RequireFarm({ param, children }: { param?: 'farm' | 'farmId'; children: ReactNode }) {
  const [search] = useSearchParams()
  const location = useLocation()
  const params = useParams()
  const named = param ? parseFarmId(search.get(param)) : null
  if (named == null && readCurrentFarmId() == null) {
    const state: SelectFarmState = { fromSignIn: true, returnTo: sectionPath(location.pathname, params) }
    return <Navigate to="/chon-trai" replace state={state} />
  }
  return children
}
