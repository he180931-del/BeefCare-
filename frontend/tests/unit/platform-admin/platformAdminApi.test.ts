import { describe, expect, it, vi } from 'vitest'
import { accountsPath, createPlatformAdminApi } from '../../../src/features/platform-admin/api/platformAdminApi'
import { createPlatformAdminDemoStore } from '../../../src/features/platform-admin/data/platformAdminDemoStore'
import { createPlatformAdminSeed } from '../../../src/features/platform-admin/data/platformAdminMock'

const NOW = new Date('2026-10-18T08:30:00')
const HUNG = 1, HA = 2, NAM = 4, TAI = 6, KHANG = 7, BAO = 9, LOC = 10
const transport = () => ({ get: vi.fn(), command: vi.fn(), farmPath: vi.fn() }) as never

function make() {
  const store = createPlatformAdminDemoStore(createPlatformAdminSeed(NOW))
  return { store, api: createPlatformAdminApi({ mode: 'local', farmId: 1, transport: transport(), store }) }
}

describe('tạm ngưng và khôi phục tài khoản (UC8, D32)', () => {
  it('bắt buộc lý do 5–500 ký tự, đúng phiên bản, ghi audit và không tạm ngưng hai lần', async () => {
    const { api } = make()
    const acc = await api.getAccount(HUNG)
    expect(acc.actions).toEqual(['SUSPEND'])
    await expect(api.suspendAccount(HUNG, { reason: '  ', expectedVersion: acc.version })).rejects.toMatchObject({ code: 'VALIDATION', message: 'Lý do là bắt buộc.' })
    await expect(api.suspendAccount(HUNG, { reason: ' a b c d ', expectedVersion: acc.version })).rejects.toMatchObject({ code: 'VALIDATION', message: /từ 5 đến 500/ })
    await expect(api.suspendAccount(HUNG, { reason: 'x'.repeat(501), expectedVersion: acc.version })).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(api.suspendAccount(HUNG, { reason: 'Nghi ngờ lộ tài khoản', expectedVersion: acc.version + 1 })).rejects.toMatchObject({ code: 'STALE' })
    const done = await api.suspendAccount(HUNG, { reason: 'Nghi ngờ lộ tài khoản', expectedVersion: acc.version })
    expect(done).toMatchObject({ accountStatus: 'SUSPENDED', version: acc.version + 1, actions: ['RESTORE'] })
    // Đã ở trạng thái yêu cầu: MSG-FE03-20 trước lỗi version (D32)
    await expect(api.suspendAccount(HUNG, { reason: 'Lần hai', expectedVersion: acc.version })).rejects.toMatchObject({ code: 'NO_CHANGE' })
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

  it('không tạm ngưng chính mình: A10 không có SUSPEND, lệnh báo MSG-FE03-17 sau khi kiểm lý do', async () => {
    const { api } = make()
    const nam = await api.getAccount(NAM)
    expect(nam.actions).toEqual([])
    await expect(api.suspendAccount(NAM, { reason: 'Thử', expectedVersion: nam.version })).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(api.suspendAccount(NAM, { reason: 'Thử tự tạm ngưng', expectedVersion: nam.version + 9 }))
      .rejects.toMatchObject({ code: 'LAST_SA', message: /Phải luôn còn ít nhất một System Admin/ })
  })
})

describe('quyền nhân viên nền tảng (UC9, D33)', () => {
  it('cấp, đổi, thu hồi, khôi phục: lý do 5–500, giá trị đã có (FE03-20), quyền đã đổi (STALE), accessActions và lịch sử', async () => {
    const { api } = make()
    let acc = await api.getAccount(KHANG)
    expect(acc.accessActions).toEqual(['GRANT'])
    const v = () => acc.platformAccessVersion
    await expect(api.changePlatformAccess(KHANG, { operation: 'GRANT', role: 'CS', reason: '', expectedVersion: v() })).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(api.changePlatformAccess(KHANG, { operation: 'GRANT', role: 'CS', reason: 'a b c d', expectedVersion: v() })).rejects.toMatchObject({ code: 'VALIDATION' })
    acc = await api.changePlatformAccess(KHANG, { operation: 'GRANT', role: 'CS', reason: '  Bổ sung nhân sự hỗ trợ ca chiều  ', expectedVersion: v() })
    expect(acc).toMatchObject({ platformRole: 'CS', platformAccessStatus: 'ACTIVE', accessActions: ['CHANGE', 'REVOKE'] })
    await expect(api.changePlatformAccess(KHANG, { operation: 'GRANT', role: 'CS', reason: 'Cấp lại CS', expectedVersion: v() }))
      .rejects.toMatchObject({ code: 'NO_CHANGE', message: 'Không có thay đổi: khang.nm@beefcare.vn đã ở vai trò này.' })
    await expect(api.changePlatformAccess(KHANG, { operation: 'GRANT', role: 'PM', reason: 'Thêm vai trò PM', expectedVersion: v() })).rejects.toMatchObject({ code: 'STALE' })
    await expect(api.changePlatformAccess(KHANG, { operation: 'CHANGE', role: 'CS', reason: 'Đổi sang CS', expectedVersion: v() })).rejects.toMatchObject({ code: 'NO_CHANGE' })
    await expect(api.changePlatformAccess(KHANG, { operation: 'CHANGE', role: 'PM', reason: 'Đổi sang PM', expectedVersion: (v() ?? 0) - 1 })).rejects.toMatchObject({ code: 'STALE' })
    acc = await api.changePlatformAccess(KHANG, { operation: 'CHANGE', role: 'PM', reason: 'Chuyển sang nhóm đối soát thanh toán', expectedVersion: v() })
    expect(acc.platformRole).toBe('PM')
    acc = await api.changePlatformAccess(KHANG, { operation: 'REVOKE', reason: 'Nghỉ việc', expectedVersion: v() })
    expect(acc).toMatchObject({ platformRole: 'PM', platformAccessStatus: 'REVOKED', accessActions: ['RESTORE'] })
    await expect(api.changePlatformAccess(KHANG, { operation: 'REVOKE', reason: 'Nghỉ việc lần hai', expectedVersion: v() }))
      .rejects.toMatchObject({ code: 'NO_CHANGE', message: 'Không có thay đổi: khang.nm@beefcare.vn đã ở trạng thái này.' })
    acc = await api.changePlatformAccess(KHANG, { operation: 'RESTORE', reason: 'Quay lại làm việc', expectedVersion: v() })
    expect(acc.platformAccessStatus).toBe('ACTIVE')
    await expect(api.changePlatformAccess(KHANG, { operation: 'RESTORE', reason: 'Khôi phục lần hai', expectedVersion: v() })).rejects.toMatchObject({ code: 'NO_CHANGE' })
    const history = await api.accountHistory(KHANG)
    expect(history.map((h) => h.action)).toEqual(['RESTORE', 'REVOKE', 'CHANGE', 'GRANT'])
    expect(history[2]).toMatchObject({ roleBefore: 'CS', statusBefore: 'ACTIVE', roleAfter: 'PM', statusAfter: 'ACTIVE', reason: 'Chuyển sang nhóm đối soát thanh toán', byName: 'Vũ Hoàng Nam' })
    expect(history[3]).toMatchObject({ roleBefore: null, statusBefore: null, reason: 'Bổ sung nhân sự hỗ trợ ca chiều' })
  })

  it('tài khoản của chính mình, chưa xác minh, bị tạm ngưng (D33 Q3, Q4)', async () => {
    const { api } = make()
    const nam = await api.getAccount(NAM)
    expect(nam.accessActions).toEqual([])
    await expect(api.changePlatformAccess(NAM, { operation: 'REVOKE', reason: 'Tự thu hồi thử', expectedVersion: nam.platformAccessVersion }))
      .rejects.toMatchObject({ code: 'FORBIDDEN', message: 'Bạn không thể thay đổi quyền nền tảng của chính mình.' })
    const bao = await api.getAccount(BAO)
    expect(bao.accessActions).toEqual([])
    await expect(api.changePlatformAccess(BAO, { operation: 'GRANT', role: 'CS', reason: 'Bổ sung nhân sự', expectedVersion: bao.platformAccessVersion }))
      .rejects.toMatchObject({ code: 'UNVERIFIED', message: /Chưa có tài khoản BeefCare cho email này/ })
    let ha = await api.getAccount(HA)
    ha = await api.suspendAccount(HA, { reason: 'Nghi ngờ lộ mật khẩu', expectedVersion: ha.version })
    expect(ha.accessActions).toEqual(['REVOKE'])
    await expect(api.changePlatformAccess(HA, { operation: 'CHANGE', role: 'PM', reason: 'Đổi sang PM', expectedVersion: ha.platformAccessVersion }))
      .rejects.toMatchObject({ code: 'SUSPENDED_ACCOUNT', message: 'Tài khoản ha.pt@beefcare.vn đang tạm ngưng. Hãy khôi phục tài khoản trước khi cấp, đổi hoặc khôi phục quyền.' })
    ha = await api.changePlatformAccess(HA, { operation: 'REVOKE', reason: 'Tài khoản nghi bị lộ', expectedVersion: ha.platformAccessVersion })
    expect(ha).toMatchObject({ platformAccessStatus: 'REVOKED', accountStatus: 'SUSPENDED', accessActions: [] })
  })
})

describe('danh sách tài khoản (A9, D31)', () => {
  it('tìm theo tên hoặc email, không phân biệt hoa thường, giữ dấu; không tìm theo SĐT', async () => {
    const { api } = make()
    expect((await api.listAccounts({ q: 'hung' })).content.map((a) => a.id)).toEqual([HUNG]) // khớp email
    expect((await api.listAccounts({ q: '  hồ VĂN ' })).content.map((a) => a.id)).toEqual([TAI])
    expect((await api.listAccounts({ q: 'ho van' })).content).toEqual([]) // giữ dấu: "ho van" không khớp "Hồ Văn"
    expect((await api.listAccounts({ q: '0912345678' })).content).toEqual([])
  })

  it('lọc trạng thái và vai trò nền tảng đang ACTIVE; "Không có" gồm cả vai trò đã thu hồi', async () => {
    const { api } = make()
    expect((await api.listAccounts({ status: 'SUSPENDED' })).content.map((a) => a.id)).toEqual([TAI])
    const cs = (await api.listAccounts({ platformRole: 'CS' })).content.map((a) => a.id)
    expect(cs).toEqual([HA]) // Trịnh Văn Lộc có CS đã thu hồi
    const none = (await api.listAccounts({ platformRole: 'NONE' })).content
    expect(none.map((a) => a.id)).toContain(LOC)
    expect(none.every((a) => a.platformRole === null || a.platformAccessStatus === 'REVOKED')).toBe(true)
  })

  it('xếp theo tên tiếng Việt, đảo chiều, 20 dòng/trang và chỉ trả cột của danh sách', async () => {
    const { api } = make()
    const page = await api.listAccounts()
    expect(page.size).toBe(20)
    expect(page.content.map((a) => a.fullName)).toEqual([
      'Đỗ Minh Quân', 'Hồ Văn Tài', 'Lê Thị Mai', 'Lý Quốc Bảo', 'Ngô Minh Khang', 'Nguyễn Văn Hùng', 'Phạm Thu Hà', 'Trần Thị Hoa', 'Trịnh Văn Lộc', 'Vũ Hoàng Nam',
    ])
    const desc = await api.listAccounts({ dir: 'desc' })
    expect(desc.content.map((a) => a.id)).toEqual([...page.content.map((a) => a.id)].reverse())
    expect((await api.listAccounts({ size: 3, page: 2 })).content).toHaveLength(3)
    expect(Object.keys(page.content[0]).sort()).toEqual(['accountStatus', 'email', 'emailVerified', 'farmCount', 'farmRoles', 'fullName', 'id', 'platformAccessStatus', 'platformRole'])
    const hung = await api.getAccount(HUNG)
    expect(hung).toMatchObject({ farmCount: 3, farmRoles: ['OWNER'], ownedFarms: ['Trại bò Yên Bài – Ba Vì', 'Trại Tản Lĩnh', 'Trại Suối Hai'] })
    expect(hung).not.toHaveProperty('phone')
  })
})

describe('A9 / A10 ở chế độ backend (D31)', () => {
  const row = { id: 12, email: 'an@x.vn', fullName: 'An', accountStatus: 'ACTIVE', platformRole: 'CS', platformAccessStatus: 'REVOKED', emailVerified: true, farmCount: 2, farmRoles: ['MANAGER', 'TECHNICIAN'] }
  const detail = {
    ...row, platformAccessVersion: 3, signInMethods: ['PASSWORD', 'GOOGLE'], createdAt: '2025-01-15T02:30:00Z', lastSignInAt: null,
    ownerRegistrationCompleted: false, ownerRegistrationCompletedAt: null, ownedFarms: [], version: 4, actions: ['SUSPEND'],
    accessActions: ['REVOKE'],
  }
  const backend = (get: (path: string) => Promise<unknown>) => {
    const store = createPlatformAdminDemoStore(createPlatformAdminSeed(NOW))
    const list = vi.spyOn(store, 'listAccounts')
    const one = vi.spyOn(store, 'getAccount')
    const http = { get: vi.fn(get), command: vi.fn(async () => ({ ...detail, accountStatus: 'SUSPENDED', version: 5, actions: ['RESTORE'] })), farmPath: vi.fn() }
    return { api: createPlatformAdminApi({ mode: 'backend', farmId: 1, transport: http as never, store }), http, list, one, store }
  }

  it('gửi bộ lọc, trang từ 0, 20 dòng, sắp theo tên và đổi phong bì sang trang của màn hình', async () => {
    const { api, http, list } = backend(async () => ({ items: [row], total: 21, page: 1, size: 20 }))
    const page = await api.listAccounts({ q: '  an ', status: 'ACTIVE', platformRole: 'NONE', dir: 'desc', page: 2 })
    expect(http.get).toHaveBeenCalledWith('/api/platform/accounts?q=an&status=ACTIVE&platformRole=NONE&page=1&size=20&sort=name&dir=desc')
    expect(page).toEqual({ content: [row], totalElements: 21, totalPages: 2, number: 1, size: 20 })
    expect(accountsPath()).toBe('/api/platform/accounts?page=0&size=20&sort=name&dir=asc')
    expect(list).not.toHaveBeenCalled()
  })

  it('đọc chi tiết theo id và giữ nguyên các trường null', async () => {
    const { api, http, one } = backend(async () => detail)
    await expect(api.getAccount(12)).resolves.toEqual(detail)
    expect(http.get).toHaveBeenCalledWith('/api/platform/accounts/12')
    expect(one).not.toHaveBeenCalled()
  })

  it('báo lỗi khi máy chủ thiếu hoặc sai trường, không tự gán mặc định', async () => {
    for (const broken of [{ ...row, farmCount: undefined }, { ...row, accountStatus: 'BLOCKED' }, { ...row, farmRoles: ['OWNER', 'CS'] }, { ...row, id: 0 }]) {
      const { api } = backend(async () => ({ items: [broken], total: 1, page: 0, size: 20 }))
      await expect(api.listAccounts()).rejects.toThrow('Dữ liệu máy chủ không có')
    }
    for (const broken of [
      { ...detail, createdAt: undefined }, { ...detail, signInMethods: 'GOOGLE' }, { ...detail, ownedFarms: [1] }, { ...detail, version: undefined },
      { ...detail, actions: undefined }, { ...detail, actions: ['DELETE'] }, { ...detail, accessActions: undefined }, { ...detail, accessActions: ['DELETE'] },
    ]) {
      const { api } = backend(async () => broken)
      await expect(api.getAccount(12)).rejects.toThrow('Dữ liệu máy chủ không có')
    }
    const { api } = backend(async () => [row])
    await expect(api.listAccounts()).rejects.toThrow('danh sách tài khoản')
  })

  it('A12 (D32): gửi lý do đã bỏ khoảng trắng, version và Idempotency-Key; đọc phản hồi là A10', async () => {
    const { api, http, store } = backend(async () => detail)
    const suspend = vi.spyOn(store, 'suspendAccount')
    const done = await api.suspendAccount(12, { reason: '  Nghi ngờ lộ mật khẩu  ', expectedVersion: 4 }, 'key-1')
    expect(http.command).toHaveBeenCalledWith('/api/platform/accounts/12/suspend', { reason: 'Nghi ngờ lộ mật khẩu', version: 4 }, { key: 'key-1' })
    expect(done).toMatchObject({ accountStatus: 'SUSPENDED', version: 5, actions: ['RESTORE'] })
    await api.restoreAccount(12, { reason: 'Đã đổi mật khẩu', expectedVersion: 5 }, 'key-2')
    expect(http.command).toHaveBeenLastCalledWith('/api/platform/accounts/12/restore', { reason: 'Đã đổi mật khẩu', version: 5 }, { key: 'key-2' })
    expect(suspend).not.toHaveBeenCalled()
    http.command.mockResolvedValueOnce({ ...detail, actions: undefined } as never)
    await expect(api.suspendAccount(12, { reason: 'Nghi ngờ lộ mật khẩu', expectedVersion: 4 }, 'key-3')).rejects.toThrow('thao tác tài khoản')
  })

  it('A13 (D33): gửi operation, role chỉ khi Cấp / Đổi, lý do đã bỏ khoảng trắng, version và Idempotency-Key; đọc A10', async () => {
    const { api, http, store } = backend(async () => detail)
    const local = vi.spyOn(store, 'changePlatformAccess')
    await api.changePlatformAccess(12, { operation: 'GRANT', role: 'PM', reason: '  Bổ sung nhân sự  ', expectedVersion: null }, 'key-g')
    expect(http.command).toHaveBeenLastCalledWith('/api/platform/accounts/12/platform-access', { operation: 'GRANT', role: 'PM', reason: 'Bổ sung nhân sự', version: null }, { key: 'key-g' })
    await api.changePlatformAccess(12, { operation: 'REVOKE', role: 'PM', reason: 'Nghỉ việc', expectedVersion: 3 }, 'key-r')
    expect(http.command).toHaveBeenLastCalledWith('/api/platform/accounts/12/platform-access', { operation: 'REVOKE', reason: 'Nghỉ việc', version: 3 }, { key: 'key-r' })
    expect(local).not.toHaveBeenCalled()
  })

  it('A11 (D33): đọc lịch sử vai trò, giữ null của dòng không có người làm, báo lỗi khi thiếu trường', async () => {
    const row = { id: 5, action: 'CHANGE', roleBefore: 'CS', statusBefore: 'ACTIVE', roleAfter: 'PM', statusAfter: 'ACTIVE', reason: 'Đổi nhóm', byName: null, byEmail: null, at: '2026-11-01T01:00:00Z' }
    const { api, http } = backend(async () => [row])
    await expect(api.accountHistory(12)).resolves.toEqual([row])
    expect(http.get).toHaveBeenCalledWith('/api/platform/accounts/12/history')
    for (const broken of [{ ...row, action: 'DELETE' }, { ...row, roleAfter: null }, { ...row, reason: '' }]) {
      const { api: next } = backend(async () => [broken])
      await expect(next.accountHistory(12)).rejects.toThrow('Dữ liệu máy chủ không có')
    }
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
  it('các chức năng chưa nối từ chối và không đụng tới store mock', async () => {
    const store = createPlatformAdminDemoStore(createPlatformAdminSeed(NOW))
    const notices = vi.spyOn(store, 'listNotifications')
    const audit = vi.spyOn(store, 'listAudit')
    const api = createPlatformAdminApi({ mode: 'backend', farmId: 1, transport: transport(), store })
    await expect(api.listNotifications()).rejects.toThrow('Chưa tích hợp')
    await expect(api.listAudit({ from: '2026-10-11', to: '2026-10-18' })).rejects.toThrow('Chưa tích hợp')
    expect(notices).not.toHaveBeenCalled()
    expect(audit).not.toHaveBeenCalled()
  })
})
