import { createContext, useContext } from 'react'
import type { AppRole, Session, SessionUser } from './sessionTypes'
export { isFarmRole } from './sessionProfile'

export type { AppRole, FarmRole, PlatformRole, Session, SessionUser } from './sessionTypes'

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
