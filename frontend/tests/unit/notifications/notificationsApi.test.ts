import { describe, expect, it, vi } from 'vitest'
import { createNotificationsApi } from '../../../src/features/notifications/api/notificationsApi'
import { createNotificationsDemoStore } from '../../../src/features/notifications/data/notificationsDemoStore'
import { notificationTarget, relativeTime, countByTab, filterByTab } from '../../../src/features/notifications/domain/notificationRules'

const transport = () => ({ get: vi.fn(), command: vi.fn(), farmPath: vi.fn() })
function setup() {
  const store = createNotificationsDemoStore()
  return { store, api: createNotificationsApi({ mode: 'local', farmId: 1, transport: transport(), store }) }
}

describe('notificationsApi (SCR-45)', () => {
  it('trả thông báo của tôi mới nhất trước, đếm theo tab', async () => {
    const { api } = setup()
    const list = await api.listMine()
    expect(list).toHaveLength(9)
    expect(list[0].title).toBe('Yêu cầu thanh toán BCF7K2Q9 đang chờ chuyển khoản')
    expect(countByTab(list)).toEqual({ ALL: 9, SUBSCRIPTION_PAYMENT: 5, SUPPORT: 4 })
    expect(filterByTab(list, 'SUPPORT').every((n) => n.category === 'SUPPORT')).toBe(true)
    expect(list.filter((n) => n.readTime === null)).toHaveLength(2)
  })

  it('đánh dấu một thông báo đã đọc, không đổi thời điểm khi đọc lại', async () => {
    const { api } = setup()
    const first = (await api.listMine())[0]
    const read = await api.markRead(first.id)
    expect(read?.readTime).toEqual(expect.any(String))
    expect((await api.markRead(first.id))?.readTime).toBe(read?.readTime)
    expect((await api.listMine()).filter((n) => n.readTime === null)).toHaveLength(1)
    await expect(api.markRead(424242)).rejects.toThrow('Không tìm thấy thông báo')
  })

  it('đánh dấu tất cả đã đọc trả về số thông báo vừa đổi', async () => {
    const { api } = setup()
    expect(await api.markAllRead()).toBe(2)
    expect(await api.markAllRead()).toBe(0)
    expect((await api.listMine()).every((n) => n.readTime !== null)).toBe(true)
  })

  it('chế độ backend đọc và ghi notification qua API thật, không đụng tới store', async () => {
    const store = createNotificationsDemoStore()
    const spy = vi.spyOn(store, 'listMine')
    const http = transport()
    http.get.mockResolvedValue([{ id: 9, category: 'SUPPORT', targetType: 'SUPPORT_TICKET', targetId: 42, title: 'Cập nhật', summary: 'Nội dung', createdTime: '2026-11-01T10:00:00Z', readTime: null }])
    http.command.mockResolvedValue(1)
    const api = createNotificationsApi({ mode: 'backend', farmId: 1, transport: http, store })
    await expect(api.listMine()).resolves.toMatchObject([{ id: 9, category: 'SUPPORT', targetType: 'TICKET' }])
    // The backend writes the target type as "SUBSCRIPTION", "Farm" or "Payment" (NotificationService callers).
    http.get.mockResolvedValue([
      { id: 1, category: 'subscription', targetType: 'SUBSCRIPTION', targetId: 1151, title: 'a', summary: '', createdTime: '2026-11-20T01:00:00Z', readTime: null },
      { id: 2, category: 'service', targetType: 'Farm', targetId: 1152, title: 'b', summary: '', createdTime: '2026-11-20T01:00:00Z', readTime: null },
      { id: 3, category: 'subscription', targetType: 'Payment', targetId: 2001, farmId: 1153, title: 'c', summary: '', createdTime: '2026-11-20T01:00:00Z', readTime: null },
    ])
    await expect(api.listMine()).resolves.toMatchObject([
      { id: 1, targetType: 'SUBSCRIPTION', targetId: 1151 }, { id: 2, targetType: 'FARM_SERVICE', targetId: 1152 }, { id: 3, targetType: 'PAYMENT_REQUEST', targetId: 2001, farmId: 1153 },
    ])
    // /mine also returns feed, announcement and internal-request notices: not shown here, never as a payment.
    http.get.mockResolvedValue([
      { id: 4, category: 'feed', targetType: 'FEED_RECEIPT', targetId: 5, title: 'd', summary: '', createdTime: '2026-11-20T01:00:00Z', readTime: null },
      { id: 5, category: 'announcement', targetType: 'ANNOUNCEMENT_VERSION', targetId: 6, title: 'e', summary: '', createdTime: '2026-11-20T01:00:00Z', readTime: null },
      { id: 6, category: 'SUPPORT', targetType: 'INTERNAL_REQUEST', targetId: 7, title: 'f', summary: '', createdTime: '2026-11-20T01:00:00Z', readTime: null },
      { id: 7, category: 'subscription', targetType: 'Farm', targetId: 1153, title: 'g', summary: '', createdTime: '2026-11-20T01:00:00Z', readTime: null },
    ])
    await expect(api.listMine()).resolves.toMatchObject([{ id: 7, targetType: 'FARM_SERVICE', targetId: 1153 }])
    await api.markRead(9)
    await api.markAllRead()
    expect(spy).not.toHaveBeenCalled()
    expect(http.get).toHaveBeenCalledWith('/api/notifications/mine')
    expect(http.command).toHaveBeenCalledWith('/api/notifications/9/read', undefined, { method: 'PUT' })
    expect(http.command).toHaveBeenCalledWith('/api/notifications/read-all', undefined, { method: 'PUT' })
  })
})

describe('notificationRules', () => {
  it('thời gian tương đối', () => {
    const now = new Date('2026-10-18T09:52:00+07:00')
    expect(relativeTime('2026-10-18T09:47:00', now)).toBe('5 phút trước')
    expect(relativeTime('2026-10-18T09:51:40', now)).toBe('Vừa xong')
    expect(relativeTime('2026-10-18T06:10:00', now)).toBe('Hôm nay 06:10')
    expect(relativeTime('2026-10-17T16:05:00', now)).toBe('Hôm qua 16:05')
    expect(relativeTime('2026-10-03T21:10:00', now)).toBe('03/10 21:10')
    expect(relativeTime('2025-11-15T10:05:00', now)).toBe('15/11/2025 10:05')
  })

  it('đích mở theo loại', () => {
    expect(notificationTarget({ targetType: 'TICKET', targetId: 1031 })).toBe('/ho-tro/1031')
    // targetId names the farm for SUBSCRIPTION and FARM_SERVICE; a payment request carries its own farm context.
    expect(notificationTarget({ targetType: 'SUBSCRIPTION', targetId: 1151 })).toBe('/goi-dich-vu?farm=1151')
    expect(notificationTarget({ targetType: 'FARM_SERVICE', targetId: 3 })).toBe('/goi-dich-vu?farm=3')
    expect(notificationTarget({ targetType: 'PAYMENT_REQUEST', targetId: 7, farmId: 22 })).toBe('/goi-dich-vu/lich-su/7?farm=22')
    expect(notificationTarget({ targetType: 'PAYMENT_REQUEST', targetId: 7, farmId: null })).toBe('/goi-dich-vu/lich-su/7')
  })

  it('mở mỗi payment notification tới đúng payment và farm của nó', () => {
    const notices = [
      { targetType: 'PAYMENT_REQUEST' as const, targetId: 701, farmId: 17 },
      { targetType: 'PAYMENT_REQUEST' as const, targetId: 702, farmId: 29 },
    ]
    expect(notices.map(notificationTarget)).toEqual([
      '/goi-dich-vu/lich-su/701?farm=17',
      '/goi-dich-vu/lich-su/702?farm=29',
    ])
  })
})
