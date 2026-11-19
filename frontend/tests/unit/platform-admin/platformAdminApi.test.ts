import { describe, expect, it, vi } from 'vitest'
import { createPlatformAdminApi } from '../../../src/features/platform-admin/api/platformAdminApi'
import { createPlatformAdminDemoStore } from '../../../src/features/platform-admin/data/platformAdminDemoStore'
import { createPlatformAdminSeed } from '../../../src/features/platform-admin/data/platformAdminMock'

const NOW = new Date('2026-10-18T08:30:00')
const HUNG = 1, HA = 2, NAM = 4, TAI = 6, KHANG = 7, BAO = 9
const transport = () => ({ get: vi.fn(), command: vi.fn(), farmPath: vi.fn() }) as never

function make() {
  const store = createPlatformAdminDemoStore(createPlatformAdminSeed(NOW))
  return { store, api: createPlatformAdminApi({ mode: 'local', farmId: 1, transport: transport(), store }) }
}

describe('tạm khóa và mở khóa tài khoản', () => {
  it('bắt buộc lý do, đúng phiên bản, ghi audit và không tạm khóa hai lần', async () => {
    const { api } = make()
    const acc = await api.getAccount(HUNG)
    await expect(api.suspendAccount(HUNG, { reason: '  ', expectedVersion: acc.version })).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(api.suspendAccount(HUNG, { reason: 'Nghi ngờ lộ tài khoản', expectedVersion: acc.version + 1 })).rejects.toMatchObject({ code: 'STALE' })
    const done = await api.suspendAccount(HUNG, { reason: 'Nghi ngờ lộ tài khoản', expectedVersion: acc.version })
    expect(done).toMatchObject({ accountStatus: 'SUSPENDED', version: acc.version + 1 })
    await expect(api.suspendAccount(HUNG, { reason: 'Lần hai', expectedVersion: done.version })).rejects.toMatchObject({ code: 'NO_CHANGE' })
    const audit = await api.listAudit({ from: '2026-10-18', to: '2026-10-18' })
    expect(audit.content[0]).toMatchObject({ action: 'ACCOUNT_SUSPENDED', targetLabel: 'Nguyễn Văn Hùng' })
  })

  it('mở khóa chỉ áp dụng cho tài khoản đang tạm khóa', async () => {
    const { api } = make()
    const tai = await api.getAccount(TAI)
    const restored = await api.restoreAccount(TAI, { reason: 'Đã xác minh danh tính qua ticket TK-1102', expectedVersion: tai.version })
    expect(restored.accountStatus).toBe('ACTIVE')
    await expect(api.restoreAccount(TAI, { reason: 'Lại mở', expectedVersion: restored.version })).rejects.toMatchObject({ code: 'NO_CHANGE' })
  })

  it('không tạm khóa chính mình hoặc System Admin cuối cùng', async () => {
    const { api } = make()
    const nam = await api.getAccount(NAM)
    await expect(api.suspendAccount(NAM, { reason: 'Thử', expectedVersion: nam.version })).rejects.toMatchObject({ code: 'LAST_SA' })
  })
})

describe('quyền nhân sự nền tảng', () => {
  it('cấp, đổi, thu hồi, khôi phục có lý do, phiên bản và lịch sử', async () => {
    const { api } = make()
    let acc = await api.getAccount(KHANG)
    const v = () => acc.platformAccessVersion
    await expect(api.changePlatformAccess(KHANG, { operation: 'GRANT', role: 'CS', reason: '', expectedVersion: v() })).rejects.toMatchObject({ code: 'VALIDATION' })
    acc = await api.changePlatformAccess(KHANG, { operation: 'GRANT', role: 'CS', reason: 'Bổ sung nhân sự hỗ trợ ca chiều', expectedVersion: v() })
    expect(acc).toMatchObject({ platformRole: 'CS', platformAccessStatus: 'ACTIVE' })
    await expect(api.changePlatformAccess(KHANG, { operation: 'GRANT', role: 'PM', reason: 'x', expectedVersion: v() })).rejects.toMatchObject({ code: 'INVALID_STATE' })
    await expect(api.changePlatformAccess(KHANG, { operation: 'CHANGE', role: 'CS', reason: 'x', expectedVersion: v() })).rejects.toMatchObject({ code: 'NO_CHANGE' })
    const stale = v() - 1
    await expect(api.changePlatformAccess(KHANG, { operation: 'CHANGE', role: 'PM', reason: 'x', expectedVersion: stale })).rejects.toMatchObject({ code: 'STALE' })
    acc = await api.changePlatformAccess(KHANG, { operation: 'CHANGE', role: 'PM', reason: 'Chuyển sang nhóm đối soát thanh toán', expectedVersion: v() })
    expect(acc.platformRole).toBe('PM')
    acc = await api.changePlatformAccess(KHANG, { operation: 'REVOKE', reason: 'Nghỉ việc', expectedVersion: v() })
    expect(acc).toMatchObject({ platformRole: 'PM', platformAccessStatus: 'REVOKED' })
    acc = await api.changePlatformAccess(KHANG, { operation: 'RESTORE', reason: 'Quay lại làm việc', expectedVersion: v() })
    expect(acc.platformAccessStatus).toBe('ACTIVE')
    await expect(api.changePlatformAccess(KHANG, { operation: 'RESTORE', reason: 'x', expectedVersion: v() })).rejects.toMatchObject({ code: 'NO_CHANGE' })
    const history = await api.accountHistory(KHANG)
    expect(history.map((h) => h.action)).toEqual(['RESTORE', 'REVOKE', 'CHANGE', 'GRANT'])
  })

  it('chỉ email đã xác minh mới nhận được quyền nền tảng', async () => {
    const { api } = make()
    const bao = await api.getAccount(BAO)
    await expect(api.changePlatformAccess(BAO, { operation: 'GRANT', role: 'CS', reason: 'Thử', expectedVersion: bao.platformAccessVersion })).rejects.toMatchObject({ code: 'UNVERIFIED' })
  })

  it('luôn còn ít nhất một System Admin đang hoạt động', async () => {
    const { api } = make()
    let nam = await api.getAccount(NAM)
    await expect(api.changePlatformAccess(NAM, { operation: 'REVOKE', reason: 'Thử', expectedVersion: nam.platformAccessVersion })).rejects.toMatchObject({ code: 'LAST_SA' })
    await expect(api.changePlatformAccess(NAM, { operation: 'CHANGE', role: 'PM', reason: 'Thử', expectedVersion: nam.platformAccessVersion })).rejects.toMatchObject({ code: 'LAST_SA' })
    let khang = await api.getAccount(KHANG)
    khang = await api.changePlatformAccess(KHANG, { operation: 'GRANT', role: 'SA', reason: 'Dự phòng SA', expectedVersion: khang.platformAccessVersion })
    khang = await api.changePlatformAccess(KHANG, { operation: 'REVOKE', reason: 'Hết nhiệm vụ', expectedVersion: khang.platformAccessVersion })
    expect(khang.platformAccessStatus).toBe('REVOKED')
    nam = await api.getAccount(NAM)
    await expect(api.changePlatformAccess(NAM, { operation: 'REVOKE', reason: 'Thử', expectedVersion: nam.platformAccessVersion })).rejects.toMatchObject({ code: 'LAST_SA' })
  })
})

describe('danh sách tài khoản', () => {
  it('lọc theo tên hoặc email không dấu, trạng thái và vai trò nền tảng', async () => {
    const { api } = make()
    expect((await api.listAccounts({ q: 'hung' })).content.map((a) => a.id)).toEqual([HUNG])
    expect((await api.listAccounts({ q: 'ho van' })).content.map((a) => a.id)).toEqual([TAI])
    expect((await api.listAccounts({ status: 'SUSPENDED' })).content.map((a) => a.id)).toEqual([TAI])
    expect((await api.listAccounts({ platformRole: 'CS' })).content.map((a) => a.id)).toContain(HA)
    const none = await api.listAccounts({ platformRole: 'NONE' })
    expect(none.content.every((a) => a.platformRole === null)).toBe(true)
    expect((await api.listAccounts({ size: 3, page: 2 })).content).toHaveLength(3)
  })
})

describe('audit nền tảng', () => {
  it('mặc định 7 ngày, mới nhất trước, chỉ trả trường được phép và lọc theo hành động', async () => {
    const { api, store } = make()
    const range = api.auditDefaultRange()
    expect(range).toEqual({ from: '2026-10-11', to: '2026-10-18' })
    const page = await api.listAudit(range)
    expect(page.content.map((e) => e.action)).toEqual(['PLATFORM_ACCESS_GRANTED', 'PAYMENT_CONFIRMED', 'FARM_SERVICE_RESTORED', 'ACCOUNT_SUSPENDED', 'MEMBERSHIP_ROLE_CHANGED'])
    const wide = await api.listAudit({ from: '2026-10-01', to: '2026-10-18' })
    expect(wide.content).toHaveLength(8)
    const closed = wide.content.find((e) => e.action === 'TICKET_CLOSED')!
    expect(JSON.stringify(closed)).not.toContain('Nội dung ticket')
    expect(Object.keys(closed.details).sort()).toEqual(['after', 'before', 'correlationId', 'scope'])
    expect((await api.listAudit({ ...range, action: 'ACCOUNT_SUSPENDED' })).content).toHaveLength(1)
    expect((await api.listAudit({ ...range, actorId: 'SYSTEM' })).content.map((e) => e.action)).toEqual(['PAYMENT_CONFIRMED'])
    await expect(api.listAudit({ from: '2025-01-01', to: '2026-10-18' })).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(store.getAuditEntry(999)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('xuất CSV theo bộ lọc đang xem', async () => {
    const { api } = make()
    const csv = await api.exportAuditCsv({ from: '2026-10-11', to: '2026-10-18', action: 'ACCOUNT_SUSPENDED' })
    const lines = csv.split('\r\n')
    expect(lines).toHaveLength(2)
    expect(lines[1]).toContain('ACCOUNT_SUSPENDED')
    expect(lines[1]).toContain('Vũ Hoàng Nam')
  })
})

describe('thông báo của SA', () => {
  it('mở thông báo đánh dấu đã đọc, kiểm tra lại giao việc và đánh dấu tất cả', async () => {
    const { api } = make()
    let list = await api.listNotifications()
    expect(list.filter((n) => !n.readTime)).toHaveLength(2)
    const opened = await api.openNotification(list[0].id)
    expect(opened.path).toBe('/nen-tang/yeu-cau/IR-081')
    list = await api.listNotifications()
    expect(list.filter((n) => !n.readTime)).toHaveLength(1)
    const cancelled = list.find((n) => n.targetCode === 'IR-076')!
    await expect(api.openNotification(cancelled.id)).rejects.toMatchObject({ code: 'NOT_ASSIGNED' })
    expect(await api.markAllNotificationsRead()).toBe(1)
    expect((await api.listNotifications()).every((n) => n.readTime)).toBe(true)
  })
})

describe('chế độ backend', () => {
  it('từ chối và không đụng tới store mock', async () => {
    const store = createPlatformAdminDemoStore(createPlatformAdminSeed(NOW))
    const spy = vi.spyOn(store, 'listAccounts')
    const suspend = vi.spyOn(store, 'suspendAccount')
    const api = createPlatformAdminApi({ mode: 'backend', farmId: 1, transport: transport(), store })
    await expect(api.listAccounts()).rejects.toThrow('Chưa tích hợp')
    await expect(api.suspendAccount(HUNG, { reason: 'x', expectedVersion: 1 })).rejects.toThrow('Chưa tích hợp')
    expect(spy).not.toHaveBeenCalled()
    expect(suspend).not.toHaveBeenCalled()
  })
})
