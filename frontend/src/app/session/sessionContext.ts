import { createContext, useContext } from 'react'
import type { AppRole, PlatformRole } from '../../features/authorization'

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

/** Optimistic session update after the server accepts the Owner profile form. */
export const markOwnerRegistrationCompleted = <T extends SessionUser>(session: T): T => ({ ...session, ownerRegistrationCompleted: true })
