import { useSession } from '../../authorization'

/** Chủ trại và Quản lý được sửa; vai trò khác (nếu có vào được) chỉ xem. Không có phiên thì coi như Chủ trại. */
export function useCanEdit(): boolean {
  const role = useSession()?.role ?? 'OWNER'
  return role === 'OWNER' || role === 'MANAGER'
}
