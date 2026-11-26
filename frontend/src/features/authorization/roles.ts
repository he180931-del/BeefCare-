import { isFarmRole, useSession } from '../../app/session/sessionContext'
import type { AppRole, FarmRole, PlatformRole, SessionUser } from '../../app/session/sessionContext'

export type { AppRole, FarmRole, PlatformRole } from '../../app/session/sessionContext'

/**
 * GBR-08, GBR-102, D41: Chủ trại và Quản lý ghi, sửa, hủy dữ liệu chăm sóc, sinh sản và sổ cho ăn; Kỹ thuật viên chỉ xem.
 * Backend vẫn kiểm lại quyền ở mọi lệnh ghi.
 */
export const canRecordCare = (role: AppRole | null | undefined): boolean => role === 'OWNER' || role === 'MANAGER'

/** Như `canRecordCare` cho phiên hiện tại; không có phiên (render ngoài `SessionProvider`) thì không áp quyền theo vai trò. */
export const useCanRecordCare = (): boolean => {
  const session = useSession()
  return session == null || canRecordCare(session.role)
}

/**
 * UC-FE01-02 step 6 / AF4: Complete Owner Profile is the destination only for an account that has no farm and no
 * platform role. A Manager or Technician who joined by invitation enters their farm (UC-FE03-04, D28).
 */
export const needsOwnerRegistration = (session: SessionUser | null | undefined): boolean =>
  session != null && session.ownerRegistrationCompleted !== true && (session.farmCount ?? (session.farmId == null ? 0 : 1)) === 0 && !session.platformRole

export { isFarmRole }

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
