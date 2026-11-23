import type { ReactNode } from 'react'
import { Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { parseFarmId, readCurrentFarmId, sectionPath, type SelectFarmState } from '../../app/session/currentFarm'
import { roleInFarm, useSession } from '../../app/session/sessionContext'
import { homePathFor, isFarmRole, needsOwnerRegistration, type AppRole } from './roles'

/**
 * Chỉ ẩn màn hình theo vai trò để điều hướng đúng; quyền thật vẫn do backend kiểm tra trên từng lệnh. The role is the one
 * in the farm named in the address (`farmParam`), else in the farm of this tab. Without either, a farm role is only the
 * account's strongest one: a screen another of its farm roles may open asks for the farm first, then comes back.
 */
export function RoleGate({ allow, farmParam, children }: { allow: readonly AppRole[]; farmParam?: 'farm' | 'farmId'; children: ReactNode }) {
  const session = useSession()
  const [search] = useSearchParams()
  const location = useLocation()
  const params = useParams()
  if (needsOwnerRegistration(session)) return <Navigate to="/owner-registration" replace />
  if (!session) return children
  const named = farmParam ? parseFarmId(search.get(farmParam)) : null
  const role = roleInFarm(session, named)
  if (allow.includes(role)) return children
  const heldElsewhere = Object.values(session.farmRoles ?? {}).some((held) => allow.includes(held))
  if (isFarmRole(role) && named == null && readCurrentFarmId() == null && heldElsewhere) {
    const state: SelectFarmState = { fromSignIn: true, returnTo: sectionPath(location.pathname, params) }
    return <Navigate to="/chon-trai" replace state={state} />
  }
  return <Navigate to={homePathFor(role)} replace />
}

/**
 * After sign-in a farm member chooses the farm on Select Farm (UC-FE02-02 trigger; AF4 opens the only one directly),
 * unless this tab already entered one. Platform roles go to their own home.
 */
export function HomeRedirect() {
  const session = useSession()
  const role = session?.role ?? 'OWNER'
  if (needsOwnerRegistration(session)) return <Navigate to="/owner-registration" replace />
  if (isFarmRole(role) && readCurrentFarmId() == null) return <Navigate to="/chon-trai" replace state={{ fromSignIn: true }} />
  return <Navigate to={homePathFor(role)} replace />
}

/** Keeps the account-modal query when an OAuth callback returns through the retired account page. */
export function AccountRouteRedirect() {
  const session = useSession()
  const location = useLocation()
  const role = session?.role ?? 'OWNER'
  const pathname = needsOwnerRegistration(session)
    ? '/owner-registration'
    : isFarmRole(role) && readCurrentFarmId() == null
      ? '/chon-trai'
      : homePathFor(role)
  return <Navigate to={{ pathname, search: location.search }} replace />
}
