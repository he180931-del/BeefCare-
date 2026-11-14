import { createContext, useContext } from 'react'

export type FarmRole = 'OWNER' | 'MANAGER' | 'TECHNICIAN'
export type PlatformRole = 'CS' | 'PM' | 'SA'
export type AppRole = FarmRole | PlatformRole

export interface SessionUser {
  /** ID tài khoản do backend cấp; dùng cho các kiểm tra quyền theo người được giao. */
  id?: number
  role: AppRole
  fullName: string
  email: string
  farmId: number | null
  farmName: string | null
  /** Server-authoritative onboarding and membership facts used only for initial routing. */
  ownerRegistrationCompleted?: boolean
  platformRole?: PlatformRole | null
  activeFarmCount?: number
}

export type Session = SessionUser & { logout: () => Promise<void> }

export const SessionContext = createContext<Session | null>(null)

/** Null khi trang được render ngoài `SessionProvider` (vd. test từng trang): khi đó không áp quyền theo vai trò. */
export const useSession = () => useContext(SessionContext)

/**
 * UC-FE01-02 step 6 / AF4: Complete Owner Profile is the destination only for an account that has no farm and no
 * platform role. A Manager or Technician who joined by invitation enters their farm (UC-FE03-04, D28).
 */
export const needsOwnerRegistration = (session: SessionUser | null | undefined): boolean =>
  session?.ownerRegistrationCompleted === false && session.farmId == null && !session.platformRole

/** Optimistic session update after the server accepts the Owner profile form. */
export const markOwnerRegistrationCompleted = <T extends SessionUser>(session: T): T => ({ ...session, ownerRegistrationCompleted: true })

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

/** SCR-02 priority after a successful sign-in; requested/invitation routes are retained by the router before this is reached. */
export function homePathForSession(session: SessionUser): string {
  if (needsOwnerRegistration(session)) return '/owner-registration'
  if (session.platformRole || ['CS', 'PM', 'SA'].includes(session.role)) return homePathFor(session.role)
  if ((session.activeFarmCount ?? (session.farmId == null ? 0 : 1)) !== 1) return '/chon-trai'
  return homePathFor(session.role)
}
