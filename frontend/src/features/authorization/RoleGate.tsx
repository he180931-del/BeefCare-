import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { homePathFor, useSession, type AppRole } from './sessionContext'

/** Chỉ ẩn màn hình theo vai trò để điều hướng đúng; quyền thật vẫn do backend kiểm tra trên từng lệnh. */
export function RoleGate({ allow, children }: { allow: readonly AppRole[]; children: ReactNode }) {
  const session = useSession()
  if (session && !allow.includes(session.role)) return <Navigate to={homePathFor(session.role)} replace />
  return children
}

export function HomeRedirect() {
  const session = useSession()
  return <Navigate to={homePathFor(session?.role ?? 'OWNER')} replace />
}
