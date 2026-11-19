import { businessDateTime, parseBusinessTime } from '../../../shared/lib/date/farmTime'
import { newestFirst } from '../domain/notificationRules'
import { NOTIFICATIONS_DEMO_NOW, NOTIFICATIONS_SEED } from './notificationsMock'

const localIso = businessDateTime

/** Store trong bộ nhớ: mỗi thông báo có một người nhận; đọc lại không đổi thời điểm đã đọc. */
export function createNotificationsDemoStore(seed = NOTIFICATIONS_SEED, options: { now?: () => Date } = {}) {
  let rows = structuredClone(seed)
  const now = () => options.now?.() ?? new Date(parseBusinessTime(NOTIFICATIONS_DEMO_NOW))
  return {
    now,
    async listMine() {
      return structuredClone(newestFirst(rows))
    },
    async markRead(id: number) {
      const row = rows.find((x) => x.id === id)
      if (!row) throw new Error('Không tìm thấy thông báo.')
      if (row.readTime === null) row.readTime = localIso(now())
      return structuredClone(row)
    },
    async markAllRead() {
      const unread = rows.filter((x) => x.readTime === null)
      for (const row of unread) row.readTime = localIso(now())
      return unread.length
    },
    async reset() {
      rows = structuredClone(seed)
    },
  }
}
export type NotificationsDemoStore = ReturnType<typeof createNotificationsDemoStore>
export const notificationsDemoStore = createNotificationsDemoStore()
