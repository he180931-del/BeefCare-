import { backendFarmId, backendMode, backendTransport, type BackendMode, type BackendTransport } from '../../../api/backendTransport'
import { backendPending } from '../../../api/backendPending'
import { notificationsDemoStore, type NotificationsDemoStore } from '../data/notificationsDemoStore'

export function createNotificationsApi({ mode, farmId, transport, store }: { mode: BackendMode; farmId: string | number; transport: BackendTransport; store: NotificationsDemoStore }) {
  // Kept for the later backend hookup; backend mode must never read the mock.
  void farmId
  void transport
  const requireLocal = () => {
    if (mode === 'backend') throw backendPending('thông báo')
  }
  return {
    // chưa có API (giờ máy chủ để tính "n phút trước"; backend dùng đồng hồ trình duyệt)
    now() {
      return mode === 'backend' ? new Date() : store.now()
    },
    // GET /api/notifications/mine
    async listMine() {
      requireLocal()
      return store.listMine()
    },
    // PUT /api/notifications/{id}/read
    async markRead(id: number) {
      requireLocal()
      return store.markRead(id)
    },
    // PUT /api/notifications/read-all
    async markAllRead() {
      requireLocal()
      return store.markAllRead()
    },
  }
}
export type NotificationsApi = ReturnType<typeof createNotificationsApi>
export const notificationsApi = createNotificationsApi({ mode: backendMode, farmId: backendFarmId, transport: backendTransport, store: notificationsDemoStore })
