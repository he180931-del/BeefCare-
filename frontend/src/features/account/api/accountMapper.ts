import { asRecord, asRows, numberValue, textValue } from '../../../shared/api/parse'
import type { AccountProfile, FarmPermissions } from '../types'

/** ProfileResponse (GET /api/account/profile) → AccountProfile. */
export function mapAccountProfile(value: unknown): AccountProfile {
  const row = asRecord(value)
  return {
    id: numberValue(row.id), email: textValue(row.email), fullName: textValue(row.fullName), phone: textValue(row.contactPhone ?? row.phone),
    emailVerified: row.emailVerified === true, passwordSignInEnabled: row.passwordSignInEnabled === true,
    googleSignInLinked: row.googleSignInLinked === true, ownerRegistrationCompleted: row.ownerRegistrationCompleted === true,
    termsAccepted: row.termsAccepted === true,
    status: textValue(row.status, 'ACTIVE'),
    signInMethods: Array.isArray(row.signInMethods) ? row.signInMethods.filter((item): item is string => typeof item === 'string') : [],
    hasPassword: row.hasPassword === true || row.passwordSignInEnabled === true,
    platformRole: typeof row.platformRole === 'string' ? row.platformRole : null,
    farms: asRows(row.farms).map((farm) => ({
      farmId: numberValue(farm.farmId), farmName: textValue(farm.farmName), role: textValue(farm.role),
      serviceStatus: textValue(farm.serviceStatus),
      permissions: Array.isArray(farm.permissions) ? farm.permissions.filter((item): item is string => typeof item === 'string') : [],
    })),
  }
}

/** GET /api/farms/{farmId}/my-permissions → FarmPermissions; an unknown role or level is an error, never a guess. */
export function mapFarmPermissions(value: unknown): FarmPermissions {
  const row = asRecord(value)
  const role = textValue(row.role)
  if (role !== 'OWNER' && role !== 'MANAGER' && role !== 'TECHNICIAN') throw new Error('Máy chủ không trả vai trò trại hợp lệ.')
  return {
    role,
    permissions: asRows(row.permissions).map((item) => {
      const value = textValue(item.value)
      if (value !== 'FULL' && value !== 'RESTRICTED' && value !== 'NO') throw new Error('Máy chủ không trả quyền trại hợp lệ.')
      return { area: textValue(item.area), value }
    }),
  }
}
