import { asRecord, asRows, backendFarmId, backendMode, backendTransport, textValue, numberValue, type BackendMode, type BackendTransport } from '../../../api/backendTransport'
import { notificationsDemoStore, type NotificationsDemoStore } from '../data/notificationsDemoStore'
import type { NotificationView } from '../types'

export const mapBackendNotification = (value: unknown): NotificationView => {
  const row = asRecord(value)
  const category = textValue(row.category).toUpperCase() === 'SUPPORT' ? 'SUPPORT' : 'SUBSCRIPTION_PAYMENT'
  const rawTarget = textValue(row.targetType).toUpperCase()
  const targetType = category === 'SUPPORT'
    ? 'TICKET'
    : rawTarget === 'PAYMENT_REQUEST' ? 'PAYMENT_REQUEST' : rawTarget === 'SUBSCRIPTION' ? 'SUBSCRIPTION' : 'FARM_SERVICE'
  return {
    id: numberValue(row.id), category, title: textValue(row.title), summary: textValue(row.summary), targetType,
    targetId: numberValue(row.targetId), createdTime: textValue(row.createdTime), readTime: row.readTime == null ? null : textValue(row.readTime),
  }
}

export function createNotificationsApi({ mode, farmId, transport, store }: { mode: BackendMode; farmId: string | number; transport: BackendTransport; store: NotificationsDemoStore }) {
  void farmId
  return {
    // chưa có API (giờ máy chủ để tính "n phút trước"; backend dùng đồng hồ trình duyệt)
    now() {
      return mode === 'backend' ? new Date() : store.now()
    },
    // GET /api/notifications/mine
    async listMine() {
      return mode === 'backend' ? asRows(await transport.get('/api/notifications/mine')).map(mapBackendNotification) : store.listMine()
    },
    // PUT /api/notifications/{id}/read
    async markRead(id: number) {
      return mode === 'backend' ? mapBackendNotification(await transport.command(`/api/notifications/${id}/read`, undefined, { method: 'PUT' })) : store.markRead(id)
    },
    // PUT /api/notifications/read-all
    async markAllRead() {
      return mode === 'backend' ? numberValue(await transport.command('/api/notifications/read-all', undefined, { method: 'PUT' })) : store.markAllRead()
    },
  }
}
export type NotificationsApi = ReturnType<typeof createNotificationsApi>
export const notificationsApi = createNotificationsApi({ mode: backendMode, farmId: backendFarmId, transport: backendTransport, store: notificationsDemoStore })
