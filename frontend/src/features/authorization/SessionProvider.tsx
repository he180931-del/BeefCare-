import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { asRecord, asRows, backendTransport, numberValue, textValue } from '../../api/backendTransport'
import { clearCurrentFarmId, pageLoader, readCurrentFarmId } from '../../api/currentFarm'
import { userFacingError } from '../../api/userFacingError'
import { useAuth } from '../authentication/AuthContext'
import { demoUserFor, readMockUserEmail } from '../authentication/demoUsers'
import { markOwnerRegistrationCompleted, SessionContext, type AppRole, type Session, type SessionUser } from './sessionContext'

export const OWNER_REGISTRATION_COMPLETED_EVENT = 'beefcare:owner-registration-completed'

const PLATFORM_ROLES: readonly string[] = ['CS', 'PM', 'SA']
const FARM_ROLES: readonly string[] = ['OWNER', 'MANAGER', 'TECHNICIAN']

/** GET /api/account/profile (ProfileResponse): vai trò nền tảng ưu tiên, sau đó là vai trò trong trại hiện tại. */
export function sessionFromProfile(value: unknown): SessionUser {
  const row = asRecord(value)
  const farms = asRows(row.farms)
  const selectedFarm = readCurrentFarmId()
  const farm = farms.find((item) => Number(item.farmId) === selectedFarm) ?? farms[0]
  const platformRole = textValue(row.platformRole)
  const farmRole = textValue(farm?.role)
  // Tài khoản mới chưa có trại vẫn là chủ trại đang hoàn tất đăng ký (SCR-07 → SCR-10).
  const role = (PLATFORM_ROLES.includes(platformRole) ? platformRole : FARM_ROLES.includes(farmRole) ? farmRole : 'OWNER') as AppRole
  return {
    id: numberValue(row.id),
    role,
    fullName: textValue(row.fullName),
    email: textValue(row.email),
    farmId: farm ? numberValue(farm.farmId) : null,
    farmName: farm ? textValue(farm.farmName) : null,
    ownerRegistrationCompleted: row.ownerRegistrationCompleted === true,
    platformRole: PLATFORM_ROLES.includes(platformRole) ? platformRole as 'CS' | 'PM' | 'SA' : null,
    activeFarmCount: farms.filter((item) => textValue(item.serviceStatus, 'ACTIVE') === 'ACTIVE').length,
  }
}

/** UC-FE02-02 E1: the farm entered in this tab is no longer one of the account's farms (membership ended or changed). */
export function isStaleFarmSelection(profile: unknown, selected: number | null): boolean {
  if (selected == null) return false
  return !asRows(asRecord(profile).farms).some((farm) => numberValue(farm.farmId) === selected)
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const { mode, logout } = useAuth()
  const [user, setUser] = useState<SessionUser | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    if (mode === 'mock') {
      setUser(demoUserFor(readMockUserEmail()))
      return undefined
    }
    const loadProfile = () => backendTransport.get('/api/account/profile').then(
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
        setUser(sessionFromProfile(profile))
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
  }, [mode])

  const session = useMemo<Session | null>(() => user && { ...user, logout }, [user, logout])

  if (error) return <div role="alert" className="grid min-h-screen place-items-center px-4 text-center text-sm text-err-fg">{error}</div>
  if (!session) return <div className="grid min-h-screen place-items-center text-sm text-subtle">Đang tải hồ sơ…</div>
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
}
