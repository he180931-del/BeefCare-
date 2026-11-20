import { asRecord } from '../../../shared/api/parse'
import { activeFarmId } from '../../../app/session/currentFarm'
import { backendMode, type BackendMode } from '../../../shared/config/runtime'
import { backendTransport, type BackendTransport } from '../../../shared/api/backendTransport'
import type { PlatformAdminDemoStore } from '../data/platformAdminDemoStore'
import { AUDIT_TARGET_TYPE_VALUES, MSG, PlatformAdminError, auditActorQuery, defaultAuditRange, platformDay } from '../domain/platformRules'
import type {
  AccessHistoryItem, AccountChange, AccountDetail, AccountFilters, AccountListItem, AccountStatusAction, AuditActionOption, AuditActor, AuditDetail, NotificationOpenResult, NotificationView,
  AuditFilters, AuditRow, FarmRole, PageResult, PlatformAccessChange, PlatformAccessOperation, PlatformAccessStatus, PlatformRole, SignInMethod,
} from '../types'
import { demo } from '../../../demo/demoModules'
import { lazyObject } from '../../../shared/lib/lazyObject'

const ACCOUNTS_PATH = '/api/platform/accounts'
const AUDIT_PATH = '/api/platform/audit'
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
const noticeCategories = ['SUPPORT'] as const
const noticeTargets = ['INTERNAL_REQUEST'] as const
const statusActions = ['SUSPEND', 'RESTORE'] as const satisfies readonly AccountStatusAction[]
const accessOperations = ['GRANT', 'CHANGE', 'REVOKE', 'RESTORE'] as const satisfies readonly PlatformAccessOperation[]

/** SCR-46 SA inbox: only a support notice for an internal request belongs on this screen. */
function supportRequestNotification(value: unknown): NotificationView {
  const row = asRecord(value)
  const targetId = requiredId(row.targetId, 'mã yêu cầu nội bộ')
  return {
    id: requiredId(row.id, 'mã thông báo'),
    category: requiredOneOf(row.category, noticeCategories, 'nhóm thông báo'),
    title: requiredText(row.title, 'tiêu đề thông báo'),
    summary: row.summary === null || row.summary === undefined ? '' : requiredString(row.summary, 'tóm tắt thông báo'),
    targetType: requiredOneOf(row.targetType, noticeTargets, 'loại đích thông báo'),
    targetId,
    createdTime: requiredText(row.createdTime, 'thời điểm tạo thông báo'),
    readTime: nullableText(row.readTime, 'thời điểm đọc thông báo'),
    targetCode: String(targetId),
  }
}

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
    accessActions: oneOfList(row.accessActions, accessOperations, 'thao tác quyền nền tảng'),
  }
}

/** A11 row (D33): every field is checked; a missing one is an error. Rows copied from the old audit may have no actor. */
export function accessHistoryItem(value: unknown): AccessHistoryItem {
  const row = asRecord(value)
  return {
    id: requiredId(row.id, 'mã lịch sử'),
    action: requiredOneOf(row.action, accessOperations, 'hành động quyền nền tảng'),
    roleBefore: nullableOneOf(row.roleBefore, platformRoles, 'vai trò trước'),
    statusBefore: nullableOneOf(row.statusBefore, accessStatuses, 'trạng thái trước'),
    roleAfter: requiredOneOf(row.roleAfter, platformRoles, 'vai trò sau'),
    statusAfter: requiredOneOf(row.statusAfter, accessStatuses, 'trạng thái sau'),
    reason: requiredText(row.reason, 'lý do'),
    byName: nullableText(row.byName, 'người thực hiện'),
    byEmail: nullableText(row.byEmail, 'email người thực hiện'),
    at: requiredText(row.at, 'thời điểm'),
  }
}

/** A13 body (D33): the trimmed reason, the role only for GRANT / CHANGE, and the platform access version shown in A10. */
export const accessBody = ({ operation, role, reason, expectedVersion }: PlatformAccessChange) => ({
  operation,
  ...(operation === 'GRANT' || operation === 'CHANGE' ? { role } : {}),
  reason: reason.trim(),
  version: expectedVersion,
})

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

/** A1/A2 actor (D34): `null` is "System"; `role` may be null for entries written before D34. */
function auditActor(value: unknown): AuditActor | null {
  if (value === null || value === undefined) return null
  const row = asRecord(value)
  return {
    id: requiredId(row.id, 'mã người thực hiện'),
    name: requiredText(row.name, 'tên người thực hiện'),
    initials: requiredText(row.initials, 'chữ viết tắt người thực hiện'),
    role: nullableText(row.role, 'vai trò người thực hiện'),
  }
}

/** A1 row (D34): every column of SCR-51 comes from the server; a missing one is an error. */
export function auditRow(value: unknown): AuditRow {
  const row = asRecord(value)
  return {
    id: requiredId(row.id, 'mã mục audit'),
    time: requiredText(row.time, 'thời điểm'),
    actor: auditActor(row.actor),
    action: requiredText(row.action, 'mã hành động'),
    targetType: requiredOneOf(row.targetType, AUDIT_TARGET_TYPE_VALUES, 'loại đối tượng'),
    targetLabel: requiredText(row.targetLabel, 'đối tượng'),
  }
}

/** Before / after values: an object of text values only (GBR-86 allowlist applied by the server). */
const textMap = (value: unknown, field: string): Record<string, string> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw invalid(field)
  const out: Record<string, string> = {}
  for (const [key, text] of Object.entries(value)) out[key] = requiredString(text, field)
  return out
}

/** A2 (D34): the SCR-51 detail. */
export function auditDetail(value: unknown): AuditDetail {
  const row = asRecord(value)
  const farm = row.farm === null || row.farm === undefined ? null : asRecord(row.farm)
  return {
    ...auditRow(value),
    farm: farm && { id: requiredId(farm.id, 'mã trang trại'), name: requiredText(farm.name, 'tên trang trại') },
    targetId: requiredId(row.targetId, 'mã đối tượng'),
    before: textMap(row.before, 'giá trị trước'),
    after: textMap(row.after, 'giá trị sau'),
    correlationId: nullableText(row.correlationId, 'mã truy vết'),
  }
}

/** A1 envelope `{items, total, page (from 0), size}` → the page shape of the screen (page from 1). */
export function auditPage(value: unknown): PageResult<AuditRow> {
  const body = asRecord(value)
  if (!Array.isArray(body.items)) throw invalid('lịch sử audit')
  const total = requiredCount(body.total, 'tổng số mục audit')
  const size = requiredId(body.size, 'cỡ trang')
  return {
    content: body.items.map(auditRow),
    totalElements: total,
    totalPages: Math.max(1, Math.ceil(total / size)),
    number: requiredCount(body.page, 'số trang'),
    size,
  }
}

/** A3 row (D34). */
export function auditActionOption(value: unknown): AuditActionOption {
  const row = asRecord(value)
  return { code: requiredText(row.code, 'mã hành động'), targetType: requiredOneOf(row.targetType, AUDIT_TARGET_TYPE_VALUES, 'loại đối tượng') }
}

/** GET /api/platform/audit query (D34): days yyyy-mm-dd; "Hệ thống" / "System" becomes `system=true`; page from 1 → from 0. */
export function auditPath({ from, to, actor = '', action = '', targetType = '', dir = 'desc', page = 1, size = PAGE_SIZE }: AuditFilters) {
  const query = new URLSearchParams({ from, to })
  const who = auditActorQuery(actor)
  if (who.system) query.set('system', 'true')
  if (who.actor) query.set('actor', who.actor)
  if (action) query.set('action', action)
  if (targetType) query.set('targetType', targetType)
  query.set('dir', dir)
  query.set('page', String(Math.max(0, page - 1)))
  query.set('size', String(size))
  return `${AUDIT_PATH}?${query.toString()}`
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

export function createPlatformAdminApi({ mode, farmId, transport, store }: { mode: BackendMode; farmId: string | number | null; transport: BackendTransport; store: PlatformAdminDemoStore }) {
  // Platform screens are not farm-scoped; backend mode must never read the mock.
  void farmId
  return {
    // A9 GET /api/platform/accounts ?q,status,platformRole,page,size,sort,dir (UC-FE03-07, D31)
    async listAccounts(filters: AccountFilters = {}): Promise<PageResult<AccountListItem>> {
      if (mode !== 'backend') return store.listAccounts(filters)
      return accountPage(await transport.get(accountsPath(filters)))
    },
    // A10 GET /api/platform/accounts/{id} (UC-FE03-07, D31)
    async getAccount(id: number): Promise<AccountDetail> {
      if (mode !== 'backend') return store.getAccount(id)
      return accountDetail(await transport.get(`${ACCOUNTS_PATH}/${requiredId(id, 'mã tài khoản')}`))
    },
    // A11 GET /api/platform/accounts/{id}/history (UC-FE03-09, D33): lịch sử vai trò, mới nhất trước
    async accountHistory(id: number): Promise<AccessHistoryItem[]> {
      if (mode !== 'backend') return store.accountHistory(id)
      const rows = await transport.get(`${ACCOUNTS_PATH}/${requiredId(id, 'mã tài khoản')}/history`)
      if (!Array.isArray(rows)) throw invalid('lịch sử vai trò')
      return rows.map(accessHistoryItem)
    },
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
    // A13 POST /api/platform/accounts/{id}/platform-access (UC-FE03-09, D33): {operation, role?, reason, version} + Idempotency-Key → A10
    async changePlatformAccess(id: number, command: PlatformAccessChange, key?: string): Promise<AccountDetail> {
      if (mode !== 'backend') return store.changePlatformAccess(id, command)
      return accountDetail(await transport.command(`${ACCOUNTS_PATH}/${requiredId(id, 'mã tài khoản')}/platform-access`, accessBody(command), { key }))
    },

    // A1 GET /api/platform/audit ?from,to,actor|system,action,targetType,dir,page,size (UC-FE17-01, D34)
    async listAudit(filters: AuditFilters): Promise<PageResult<AuditRow>> {
      if (mode !== 'backend') return store.listAudit(filters)
      return auditPage(await transport.get(auditPath(filters)))
    },
    // A2 GET /api/platform/audit/{id} (D34): giá trị trước / sau trong danh sách cho phép, mã truy vết
    async getAuditEntry(id: number): Promise<AuditDetail> {
      if (mode !== 'backend') return store.getAuditEntry(id)
      return auditDetail(await transport.get(`${AUDIT_PATH}/${requiredId(id, 'mã mục audit')}`))
    },
    // A3 GET /api/platform/audit/actions (D34): mã của bộ lọc Hành động
    async listAuditActions(): Promise<AuditActionOption[]> {
      if (mode !== 'backend') return store.listAuditActions()
      const rows = await transport.get(`${AUDIT_PATH}/actions`)
      if (!Array.isArray(rows)) throw invalid('danh sách mã hành động')
      return rows.map(auditActionOption)
    },
    // Mặc định 7 ngày gần nhất gồm hôm nay (D34); mock lấy "hôm nay" của dữ liệu mẫu
    auditDefaultRange() { return defaultAuditRange(mode === 'backend' ? platformDay(new Date().toISOString()) : store.today()) },

    // SCR-46 / GET /api/notifications/mine: this page only presents assigned internal requests.
    async listNotifications(): Promise<NotificationView[]> {
      if (mode !== 'backend') return store.listNotifications()
      const rows = await transport.get('/api/notifications/mine')
      if (!Array.isArray(rows)) throw invalid('danh sách thông báo')
      return rows
        .filter((value) => {
          const row = asRecord(value)
          return row.category === 'SUPPORT' && row.targetType === 'INTERNAL_REQUEST'
        })
        .map(supportRequestNotification)
    },
    // PUT /api/notifications/{id}/read checks current assignment on the server before returning the target.
    async openNotification(id: number): Promise<NotificationOpenResult> {
      if (mode !== 'backend') return store.openNotification(id)
      const noticeId = requiredId(id, 'mã thông báo')
      let response: unknown
      try {
        response = await transport.command(`/api/notifications/${noticeId}/read`, undefined, { method: 'PUT' })
      } catch (error) {
        const code = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined
        if (code === 'MSG-FE20-19') throw new PlatformAdminError('NOT_ASSIGNED', MSG.noLongerAssigned)
        throw error
      }
      const notice = supportRequestNotification(response)
      if (notice.id !== noticeId) throw invalid('mã thông báo phản hồi')
      return { path: `/nen-tang/yeu-cau/${notice.targetId}` }
    },
    // PUT /api/notifications/read-all applies the backend's current-recipient and target-access checks.
    async markAllNotificationsRead(): Promise<number> {
      if (mode !== 'backend') return store.markAllNotificationsRead()
      return requiredCount(await transport.command('/api/notifications/read-all', undefined, { method: 'PUT' }), 'số thông báo đã đọc')
    },
  }
}
export type PlatformAdminApi = ReturnType<typeof createPlatformAdminApi>
export const platformAdminApi = createPlatformAdminApi({ mode: backendMode, farmId: activeFarmId, transport: backendTransport, store: lazyObject(() => demo.platformAdmin.platformAdminDemoStore) })
