import { createContext, useContext } from 'react'

export type FarmRole = 'OWNER' | 'MANAGER' | 'TECHNICIAN'
export type PlatformRole = 'CS' | 'PM' | 'SA'
export type AppRole = FarmRole | PlatformRole

export interface SessionUser {
  role: AppRole
  fullName: string
  email: string
  farmId: number | null
  farmName: string | null
}

export type Session = SessionUser & { logout: () => Promise<void> }

export const SessionContext = createContext<Session | null>(null)

/** Null khi trang được render ngoài `SessionProvider` (vd. test từng trang): khi đó không áp quyền theo vai trò. */
export const useSession = () => useContext(SessionContext)

const FARM_ROLES: readonly string[] = ['OWNER', 'MANAGER', 'TECHNICIAN']
export const isFarmRole = (role: AppRole): role is FarmRole => FARM_ROLES.includes(role)

export function homePathFor(role: AppRole): string {
  switch (role) {
    case 'TECHNICIAN': return '/kt'
    case 'CS': return '/nen-tang/ho-tro'
    case 'PM': return '/nen-tang/dich-vu'
    case 'SA': return '/nen-tang/tai-khoan'
    default: return '/tong-quan'
  }
}
