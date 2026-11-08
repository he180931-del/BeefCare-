import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { readCurrentFarmId } from '../../api/currentFarm'
import { homePathFor, isFarmRole, useSession, type AppRole } from './sessionContext'

/** Chỉ ẩn màn hình theo vai trò để điều hướng đúng; quyền thật vẫn do backend kiểm tra trên từng lệnh. */
export function RoleGate({ allow, children }: { allow: readonly AppRole[]; children: ReactNode }) {
  const session = useSession()
  if (session && !allow.includes(session.role)) return <Navigate to={homePathFor(session.role)} replace />
  return children
}

/**
 * After sign-in a farm member chooses the farm on Select Farm (UC-FE02-02 trigger; AF4 opens the only one directly),
 * unless this tab already entered one. Platform roles go to their own home.
 */
export function HomeRedirect() {
  const session = useSession()
  const role = session?.role ?? 'OWNER'
  if (isFarmRole(role) && readCurrentFarmId() == null) return <Navigate to="/chon-trai" replace state={{ fromSignIn: true }} />
  return <Navigate to={homePathFor(role)} replace />
}
