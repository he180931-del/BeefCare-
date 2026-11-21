import { useQuery } from '../../../shared/hooks/useQuery'
import { useDemoState } from '../../../demo/demoModules'
import { platformAdminApi } from '../api/platformAdminApi'

export function useAdminNotices() {
  const demo = useDemoState()
  const query = useQuery(
    () => (demo === 'load-error' ? Promise.reject(new Error('Không tải được thông báo.')) : platformAdminApi.listNotifications()),
    [demo],
  )

  return {
    ...query,
    openNotification: (id: number) => platformAdminApi.openNotification(id),
    markAllRead: () => platformAdminApi.markAllNotificationsRead(),
  }
}
