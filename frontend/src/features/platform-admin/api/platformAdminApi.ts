import { asRecord, backendFarmId, backendMode, backendTransport, type BackendMode, type BackendTransport } from '../../../api/backendTransport'
import { backendPending } from '../../../api/backendPending'
import { platformAdminDemoStore, type PlatformAdminDemoStore } from '../data/platformAdminDemoStore'
import { auditToCsv, defaultAuditRange, toYmd } from '../domain/platformRules'
import type {
  AccountChange, AccountDetail, AccountFilters, AccountListItem, AccountStatusAction, AuditFilters, FarmRole, PageResult,
  PlatformAccessChange, PlatformAccessStatus, PlatformRole, SignInMethod,
} from '../types'

const ACCOUNTS_PATH = '/api/platform/accounts'
const PAGE_SIZE = 20

const invalid = (field: string) => new Error(`Dữ liệu máy chủ không có ${field} hợp lệ.`)
const requiredId = (value: unknown, field: string) => {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return value
  throw invalid(field)
}
const requiredCount = (value: unknown, field: string) => {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return value
  throw invalid(field)
}
const requiredString = (value: unknown, field: string) => {
  if (typeof value === 'string') return value
  throw invalid(field)
}
const requiredText = (value: unknown, field: string) => {
  if (typeof value === 'string' && value.trim()) return value
  throw invalid(field)
}
const requiredBoolean = (value: unknown, field: string) => {
  if (typeof value === 'boolean') return value
  throw invalid(field)
}
const requiredOneOf = <T extends string>(value: unknown, values: readonly T[], field: string): T => {
  if (typeof value === 'string' && values.includes(value as T)) return value as T
  throw invalid(field)
}
const nullableOneOf = <T extends string>(value: unknown, values: readonly T[], field: string): T | null =>
  value === null || value === undefined ? null : requiredOneOf(value, values, field)
const nullableText = (value: unknown, field: string) => (value === null || value === undefined ? null : requiredText(value, field))
const oneOfList = <T extends string>(value: unknown, values: readonly T[], field: string): T[] => {
  if (!Array.isArray(value)) throw invalid(field)
  return value.map((item) => requiredOneOf(item, values, field))
}

const accountStatuses = ['ACTIVE', 'SUSPENDED'] as const
const platformRoles = ['CS', 'PM', 'SA'] as const satisfies readonly PlatformRole[]
const accessStatuses = ['ACTIVE', 'REVOKED'] as const satisfies readonly PlatformAccessStatus[]
const farmRoles = ['OWNER', 'MANAGER', 'TECHNICIAN'] as const satisfies readonly FarmRole[]
const signInMethods = ['PASSWORD', 'GOOGLE'] as const satisfies readonly SignInMethod[]
const statusActions = ['SUSPEND', 'RESTORE'] as const satisfies readonly AccountStatusAction[]

/** A9 row (D31): ids, status, roles and counts come from the server; a missing one is an error, never a silent default. */
export function accountListItem(value: unknown): AccountListItem {
  const row = asRecord(value)
  return {
    id: requiredId(row.id, 'mã tài khoản'),
    email: requiredText(row.email, 'email tài khoản'),
    // An account may have no name yet: the screen shows the email instead (D31).
    fullName: requiredString(row.fullName, 'họ tên tài khoản'),
    accountStatus: requiredOneOf(row.accountStatus, accountStatuses, 'trạng thái tài khoản'),
    platformRole: nullableOneOf(row.platformRole, platformRoles, 'vai trò nền tảng'),
    platformAccessStatus: nullableOneOf(row.platformAccessStatus, accessStatuses, 'trạng thái quyền nền tảng'),
    emailVerified: requiredBoolean(row.emailVerified, 'trạng thái xác minh email'),
    farmCount: requiredCount(row.farmCount, 'số trại tham gia'),
    farmRoles: oneOfList(row.farmRoles, farmRoles, 'vai trò trong trại'),
  }
}

/** A10 (D31): the account detail of SCR-16; also the response of suspend / restore / platform access. */
export function accountDetail(value: unknown): AccountDetail {
  const row = asRecord(value)
  const accessVersion = row.platformAccessVersion
  if (accessVersion !== null && accessVersion !== undefined && !(typeof accessVersion === 'number' && Number.isSafeInteger(accessVersion))) {
    throw invalid('phiên bản quyền nền tảng')
  }
  if (!Array.isArray(row.ownedFarms) || row.ownedFarms.some((name) => typeof name !== 'string')) throw invalid('danh sách trại sở hữu')
  return {
    ...accountListItem(value),
    platformAccessVersion: typeof accessVersion === 'number' ? accessVersion : null,
    signInMethods: oneOfList(row.signInMethods, signInMethods, 'cách đăng nhập'),
    createdAt: requiredText(row.createdAt, 'thời điểm tạo tài khoản'),
    lastSignInAt: nullableText(row.lastSignInAt, 'thời điểm đăng nhập cuối'),
    ownerRegistrationCompleted: requiredBoolean(row.ownerRegistrationCompleted, 'trạng thái đăng ký Chủ trại'),
    ownerRegistrationCompletedAt: nullableText(row.ownerRegistrationCompletedAt, 'thời điểm đăng ký Chủ trại'),
    ownedFarms: row.ownedFarms as string[],
    version: requiredCount(row.version, 'phiên bản tài khoản'),
    actions: oneOfList(row.actions, statusActions, 'thao tác tài khoản'),
  }
}

/** A9 envelope `{items, total, page (from 0), size}` → the page shape of the screen (page from 1). */
export function accountPage(value: unknown): PageResult<AccountListItem> {
  const body = asRecord(value)
  if (!Array.isArray(body.items)) throw invalid('danh sách tài khoản')
  const total = requiredCount(body.total, 'tổng số tài khoản')
  const size = requiredId(body.size, 'cỡ trang')
  return {
    content: body.items.map(accountListItem),
    totalElements: total,
    totalPages: Math.max(1, Math.ceil(total / size)),
    number: requiredCount(body.page, 'số trang'),
    size,
  }
}

/** A12 body (D32): the trimmed reason and the version of the account shown in A10. */
export const statusBody = ({ reason, expectedVersion }: AccountChange) => ({ reason: reason.trim(), version: expectedVersion })

/** GET /api/platform/accounts query (D31); page in the screen starts at 1, in the API at 0. */
export function accountsPath({ q = '', status = '', platformRole = '', dir = 'asc', page = 1, size = PAGE_SIZE }: AccountFilters = {}) {
  const query = new URLSearchParams()
  if (q.trim()) query.set('q', q.trim())
  if (status) query.set('status', status)
  if (platformRole) query.set('platformRole', platformRole)
  query.set('page', String(Math.max(0, page - 1)))
  query.set('size', String(size))
  query.set('sort', 'name')
  query.set('dir', dir)
  return `${ACCOUNTS_PATH}?${query.toString()}`
}

export function createPlatformAdminApi({ mode, farmId, transport, store }: { mode: BackendMode; farmId: string | number; transport: BackendTransport; store: PlatformAdminDemoStore }) {
  // Platform screens are not farm-scoped; backend mode must never read the mock.
  void farmId
  const requireLocal = () => { if (mode === 'backend') throw backendPending('quản trị nền tảng') }
  return {
    // A9 GET /api/platform/accounts ?q,status,platformRole,page,size,sort,dir (UC-FE03-07, D31)
    async listAccounts(filters: AccountFilters = {}): Promise<PageResult<AccountListItem>> {
      if (mode !== 'backend') return store.listAccounts(filters)
      // STAFF (every account that has or had a role) only backs the mock "Quyền nhân sự" page until FE-03 Q5 / UC9.
      if (filters.platformRole === 'STAFF') throw backendPending('danh sách nhân sự nền tảng')
      return accountPage(await transport.get(accountsPath(filters)))
    },
    // A10 GET /api/platform/accounts/{id} (UC-FE03-07, D31)
    async getAccount(id: number): Promise<AccountDetail> {
      if (mode !== 'backend') return store.getAccount(id)
      return accountDetail(await transport.get(`${ACCOUNTS_PATH}/${requiredId(id, 'mã tài khoản')}`))
    },
    // GET /api/platform/accounts/{id}/history (UC-FE03-09, chưa nối)
    async accountHistory(id: number) { requireLocal(); return store.accountHistory(id) },
    // A12 POST /api/platform/accounts/{id}/suspend (UC-FE03-08, D32): {reason, version} + Idempotency-Key → A10
    async suspendAccount(id: number, command: AccountChange, key?: string): Promise<AccountDetail> {
      if (mode !== 'backend') return store.suspendAccount(id, command)
      return accountDetail(await transport.command(`${ACCOUNTS_PATH}/${requiredId(id, 'mã tài khoản')}/suspend`, statusBody(command), { key }))
    },
    // A12 POST /api/platform/accounts/{id}/restore (UC-FE03-08, D32): {reason, version} + Idempotency-Key → A10
    async restoreAccount(id: number, command: AccountChange, key?: string): Promise<AccountDetail> {
      if (mode !== 'backend') return store.restoreAccount(id, command)
      return accountDetail(await transport.command(`${ACCOUNTS_PATH}/${requiredId(id, 'mã tài khoản')}/restore`, statusBody(command), { key }))
    },
    // POST /api/platform/accounts/{id}/platform-access  (UC-FE03-09, chưa nối; PlatformAccessRequest: operation, role, reason, version)
    async changePlatformAccess(id: number, command: PlatformAccessChange) { requireLocal(); return store.changePlatformAccess(id, command) },

    // GET /api/platform/audit ?from,to,action,targetType,actorId,page,size
    async listAudit(filters: AuditFilters) { requireLocal(); return store.listAudit(filters) },
    // GET /api/platform/audit/{id}
    async getAuditEntry(id: number) { requireLocal(); return store.getAuditEntry(id) },
    // chưa có API (danh sách người thực hiện để lọc; backend lọc theo actorId)
    async listAuditActors() { requireLocal(); return store.listAuditActors() },
    // chưa có API (xuất CSV theo bộ lọc đang xem; hiện dựng từ danh sách audit)
    async exportAuditCsv(filters: AuditFilters) {
      requireLocal()
      return auditToCsv((await store.listAudit({ ...filters, page: 1, size: 10_000 })).content)
    },
    // chưa có API (mặc định 7 ngày gần nhất; mock lấy "hôm nay" của dữ liệu mẫu)
    auditDefaultRange() { return defaultAuditRange(mode === 'backend' ? toYmd(new Date()) : store.today()) },

    // GET /api/notifications/mine
    async listNotifications() { requireLocal(); return store.listNotifications() },
    // PUT /api/notifications/{id}/read  (kiểm tra lại giao việc trước khi mở: chưa có API riêng)
    async openNotification(id: number) { requireLocal(); return store.openNotification(id) },
    // PUT /api/notifications/read-all
    async markAllNotificationsRead() { requireLocal(); return store.markAllNotificationsRead() },
  }
}
export type PlatformAdminApi = ReturnType<typeof createPlatformAdminApi>
export const platformAdminApi = createPlatformAdminApi({ mode: backendMode, farmId: backendFarmId, transport: backendTransport, store: platformAdminDemoStore })
