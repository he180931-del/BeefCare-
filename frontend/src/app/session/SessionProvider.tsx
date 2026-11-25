import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { asRecord, asRows, numberValue } from '../../shared/api/parse'
import { clearCurrentFarmId, pageLoader, readCurrentFarmId } from './currentFarm'
import { userFacingError } from '../../shared/api/userFacingError'
import { TermsAcceptancePage, useAuth, useAuthenticationUseCase } from '../../features/authentication'
import { demo } from '../../demo/demoModules'
import { markOwnerRegistrationCompleted, SessionContext } from './sessionContext'
import { OWNER_REGISTRATION_COMPLETED_EVENT } from './sessionLifecycle'
import { sessionFromProfile } from './sessionProfile'
import type { Session, SessionUser } from './sessionTypes'

/** UC-FE02-02 E1: the farm entered in this tab is no longer one of the account's farms (membership ended or changed). */
export function isStaleFarmSelection(profile: unknown, selected: number | null): boolean {
  if (selected == null) return false
  return !asRows(asRecord(profile).farms).some((farm) => numberValue(farm.farmId) === selected)
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const { mode, logout } = useAuth()
  const { loadSessionProfile, acceptTerms } = useAuthenticationUseCase()
  const [user, setUser] = useState<SessionUser | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    if (mode === 'mock') {
      // Same rule as the server profile: the demo user names its farm only once this tab has entered one.
      const user = demo.demoUsers.demoUserFor(demo.demoUsers.readMockUserEmail())
      const farmCount = user.farmId == null ? 0 : 1
      const farmRoles = user.farmId == null ? {} : { [user.farmId]: user.role }
      setUser(readCurrentFarmId() == null ? { ...user, farmId: null, farmName: null, farmCount, farmRoles } : { ...user, farmCount, farmRoles })
      return undefined
    }
    const loadProfile = () => loadSessionProfile().then(
      (profile) => {
        if (!active) return
        // Every feature API of this page already points at the stale farm, so forget it and reload into Select Farm.
        // Reload only once the stale id is really gone, so a storage that refuses to forget it cannot loop.
        if (isStaleFarmSelection(profile, readCurrentFarmId())) {
          clearCurrentFarmId()
          if (readCurrentFarmId() == null) {
            pageLoader.load('/chon-trai')
            return
          }
        }
        setUser(sessionFromProfile(profile, readCurrentFarmId()))
      },
      (cause: unknown) => { if (active) setError(userFacingError(cause, 'Không tải được hồ sơ người dùng.')) },
    )
    void loadProfile()
    const markCompleted = () => {
      setUser((current) => current ? markOwnerRegistrationCompleted(current) : current)
      void loadProfile()
    }
    window.addEventListener(OWNER_REGISTRATION_COMPLETED_EVENT, markCompleted)
    return () => {
      active = false
      window.removeEventListener(OWNER_REGISTRATION_COMPLETED_EVENT, markCompleted)
    }
  }, [loadSessionProfile, mode])

  const session = useMemo<Session | null>(() => user && { ...user, logout }, [user, logout])

  const acceptGoogleTerms = async () => {
    await acceptTerms()
    const profile = await loadSessionProfile()
    const nextSession = sessionFromProfile(profile, readCurrentFarmId())
    setUser(nextSession)
  }

  if (error) return <div role="alert" className="grid min-h-screen place-items-center px-4 text-center text-sm text-err-fg">{error}</div>
  if (!session) return <div className="grid min-h-screen place-items-center text-sm text-subtle">Đang tải hồ sơ…</div>
  if (session.googleSignInLinked && !session.termsAccepted) {
    return <TermsAcceptancePage onAccept={acceptGoogleTerms} onLogout={logout} />
  }
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
}
