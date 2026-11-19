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
    expect(read.readTime).not.toBeNull()
    expect((await api.markRead(first.id)).readTime).toBe(read.readTime)
    expect((await api.listMine()).filter((n) => n.readTime === null)).toHaveLength(1)
    await expect(api.markRead(424242)).rejects.toThrow('Không tìm thấy thông báo')
  })

  it('đánh dấu tất cả đã đọc trả về số thông báo vừa đổi', async () => {
    const { api } = setup()
    expect(await api.markAllRead()).toBe(2)
    expect(await api.markAllRead()).toBe(0)
    expect((await api.listMine()).every((n) => n.readTime !== null)).toBe(true)
  })

  it('chế độ backend từ chối và không đụng tới store', async () => {
    const store = createNotificationsDemoStore()
    const spy = vi.spyOn(store, 'listMine')
    const api = createNotificationsApi({ mode: 'backend', farmId: 1, transport: transport(), store })
    await expect(api.listMine()).rejects.toThrow()
    await expect(api.markAllRead()).rejects.toThrow()
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('notificationRules', () => {
  it('thời gian tương đối', () => {
    const now = new Date('2026-10-18T09:52:00')
    expect(relativeTime('2026-10-18T09:47:00', now)).toBe('5 phút trước')
    expect(relativeTime('2026-10-18T09:51:40', now)).toBe('Vừa xong')
    expect(relativeTime('2026-10-18T06:10:00', now)).toBe('Hôm nay 06:10')
    expect(relativeTime('2026-10-17T16:05:00', now)).toBe('Hôm qua 16:05')
    expect(relativeTime('2026-10-03T21:10:00', now)).toBe('03/10 21:10')
    expect(relativeTime('2025-11-15T10:05:00', now)).toBe('15/11/2025 10:05')
  })

  it('đích mở theo loại', () => {
    expect(notificationTarget({ targetType: 'TICKET', targetId: 1031 })).toBe('/ho-tro/1031')
    expect(notificationTarget({ targetType: 'PAYMENT_REQUEST', targetId: 7 })).toBe('/goi-dich-vu')
  })
})
