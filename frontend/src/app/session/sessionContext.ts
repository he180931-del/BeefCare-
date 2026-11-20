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
  /** Every farm the account belongs to, whatever its service status. */
  farmCount?: number
  /** The account's role in each of its farms, by farm id. */
  farmRoles?: Readonly<Record<number, AppRole>>
}

export type Session = SessionUser & { logout: () => Promise<void> }

export const SessionContext = createContext<Session | null>(null)

/** Null khi trang được render ngoài `SessionProvider` (vd. test từng trang): khi đó không áp quyền theo vai trò. */
export const useSession = () => useContext(SessionContext)

/**
 * The role on a page that works on `farmId` (the farm named in its address): the account's role in that farm, else the
 * session role (the farm of this tab). Only for routing and showing actions; the backend checks every command.
 */
export const roleInFarm = (session: SessionUser, farmId: number | null | undefined): AppRole =>
  (farmId == null ? undefined : session.farmRoles?.[farmId]) ?? session.role

/** Optimistic session update after the server accepts the Owner profile form. */
export const markOwnerRegistrationCompleted = <T extends SessionUser>(session: T): T => ({ ...session, ownerRegistrationCompleted: true })
