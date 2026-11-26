import { asRecord, asRows, numberValue, textValue } from '../../shared/api/parse'
import type { AppRole, FarmRole, PlatformRole, SessionFarm, SessionUser } from './sessionTypes'

const PLATFORM_ROLES: readonly PlatformRole[] = ['CS', 'PM', 'SA']
const FARM_ROLES: readonly FarmRole[] = ['OWNER', 'MANAGER', 'TECHNICIAN']

export const isPlatformRole = (role: string): role is PlatformRole => PLATFORM_ROLES.includes(role as PlatformRole)

/** A profile fact, not an authorization policy: recognizes a farm membership role returned by the server. */
export const isFarmRole = (role: string): role is FarmRole => FARM_ROLES.includes(role as FarmRole)

/**
 * Normalizes GET /api/account/profile into session facts. The caller owns the selected tab farm;
 * this function never reads browser storage or makes navigation/permission decisions.
 */
export function sessionFromProfile(value: unknown, selectedFarmId: number | null): SessionUser {
  const row = asRecord(value)
  const farms = asRows(row.farms)
  const sessionFarms: SessionFarm[] = farms
    .map((item) => {
      const role = textValue(item.role)
      return {
        id: numberValue(item.farmId),
        name: textValue(item.farmName),
        role: (isFarmRole(role) ? role : 'OWNER') as FarmRole,
        serviceStatus: textValue(item.serviceStatus, 'ACTIVE'),
      }
    })
  const farm = selectedFarmId == null ? undefined : farms.find((item) => Number(item.farmId) === selectedFarmId)
  const platformRole = textValue(row.platformRole)
  const farmRole = farm ? textValue(farm.role) : FARM_ROLES.find((role) => farms.some((item) => textValue(item.role) === role)) ?? ''
  // Tài khoản mới chưa có trại vẫn là chủ trại đang hoàn tất đăng ký (SCR-07 → SCR-10).
  const role = (isPlatformRole(platformRole) ? platformRole : isFarmRole(farmRole) ? farmRole : 'OWNER') as AppRole

  return {
    id: numberValue(row.id),
    role,
    fullName: textValue(row.fullName),
    email: textValue(row.email),
    farmId: farm ? numberValue(farm.farmId) : null,
    farmName: farm ? textValue(farm.farmName) : null,
    ownerRegistrationCompleted: row.ownerRegistrationCompleted === true,
    googleSignInLinked: row.googleSignInLinked === true,
    termsAccepted: row.termsAccepted === true,
    platformRole: isPlatformRole(platformRole) ? platformRole : null,
    activeFarmCount: farms.filter((item) => textValue(item.serviceStatus, 'ACTIVE') === 'ACTIVE').length,
    farmCount: farms.length,
    farmRoles: Object.fromEntries(farms
      .filter((item) => isFarmRole(textValue(item.role)))
      .map((item) => [numberValue(item.farmId), textValue(item.role) as AppRole])),
    farms: sessionFarms,
  }
}
