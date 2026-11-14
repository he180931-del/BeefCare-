import {
  AUDIT_ACTIONS, MSG, PlatformAdminError, accessActionsOf, allowedAuditChange, checkAccountChange, filterAccounts, filterAudit, initials, isActiveSa,
  paginate, planAccessChange, statusActions, validateAuditRange,
} from '../domain/platformRules'
import type {
  AccessHistoryItem, AccountChange, AccountDetail, AccountFilters, AccountListItem, AccountRecord, AuditActionOption, AuditDetail, AuditFilters, AuditRow,
  NotificationOpenResult, NotificationView, PageResult, PlatformAccessChange,
} from '../types'
import { createPlatformAdminSeed, type PlatformAdminSeed, type RawAuditEntry } from './platformAdminMock'

const ACCOUNT_PAGE_SIZE = 20

/** A9 chỉ trả các cột của danh sách; chi tiết đọc riêng bằng A10 (D31). */
const listItem = (a: AccountRecord): AccountListItem => ({
  id: a.id, email: a.email, fullName: a.fullName, accountStatus: a.accountStatus, platformRole: a.platformRole,
  platformAccessStatus: a.platformAccessStatus, emailVerified: a.emailVerified, farmCount: a.farmCount, farmRoles: [...a.farmRoles],
})
const AUDIT_PAGE_SIZE = 20

export function createPlatformAdminDemoStore(seed: PlatformAdminSeed = createPlatformAdminSeed()) {
  let state = structuredClone(seed)
  let clock = 0
  let seq = 1000

  // Giờ mock cố định theo "hôm nay" của seed để sự kiện mới luôn nằm trong khoảng audit mặc định.
  const nowIso = () => new Date(new Date(`${state.today}T09:00:00`).getTime() + clock++ * 60_000).toISOString()
  const nextId = () => ++seq
  /** A1: chỉ các cột của danh sách. */
  const row = (e: RawAuditEntry): AuditRow => ({
    id: e.id, time: e.time, actor: e.actor && { ...e.actor }, action: e.action, targetType: e.targetType, targetLabel: e.targetLabel,
  })
  /** A2: giá trị trước / sau trong danh sách cho phép (GBR-86); lý do, nội dung ticket, chứng từ bị bỏ như máy chủ. */
  const detail = (e: RawAuditEntry): AuditDetail => {
    const { details, actorEmail: _actorEmail, ...rest } = structuredClone(e)
    return { ...rest, ...allowedAuditChange(details) }
  }

  const find = (id: number) => {
    const found = state.accounts.find((a) => a.id === id)
    if (!found) throw new PlatformAdminError('NOT_FOUND', 'Không tìm thấy tài khoản.')
    return found
  }
  const requireSa = () => {
    const actor = state.accounts.find((a) => a.id === state.currentUserId)
    if (!actor || !isActiveSa(actor)) throw new PlatformAdminError('FORBIDDEN', MSG.forbidden)
    return actor
  }
  /** Như AuditService (D34): vai trò lúc thực hiện, mã truy vết của "request", trước / sau theo trường. */
  const log = (
    actor: AccountRecord, action: string, targetType: 'ACCOUNT' | 'PLATFORM_ACCESS', target: AccountRecord,
    before: Record<string, string>, after: Record<string, string>,
  ) => {
    const id = nextId()
    state.audit.push({
      id, time: nowIso(), actor: { id: actor.id, name: actor.fullName, initials: initials(actor.fullName), role: actor.platformRole }, actorEmail: actor.email,
      action, targetType, targetId: target.id, targetLabel: target.fullName || target.email, farm: null,
      correlationId: `req-${id.toString(16)}-${(id * 7919).toString(16).slice(-4)}`, details: { before, after },
    })
  }

  /** A10 như máy chủ trả (D32, D33): `actions` và `accessActions` tính theo SA đang xem. */
  const detailOf = (a: AccountRecord): AccountDetail => ({
    ...structuredClone(a), actions: statusActions(a, state.currentUserId), accessActions: accessActionsOf(a, state.currentUserId),
  })

  function changeStatus(id: number, command: AccountChange, op: 'suspend' | 'restore') {
    const actor = requireSa()
    const target = find(id)
    checkAccountChange(state.accounts, target, actor.id, command, op)
    target.accountStatus = op === 'suspend' ? 'SUSPENDED' : 'ACTIVE'
    target.version += 1
    log(actor, op === 'suspend' ? 'ACCOUNT_SUSPENDED' : 'ACCOUNT_RESTORED', 'ACCOUNT', target,
      { status: op === 'suspend' ? 'ACTIVE' : 'SUSPENDED' }, { status: target.accountStatus })
    return detailOf(target)
  }

  return {
    today: () => state.today,

    async listAccounts(filters: AccountFilters = {}) {
      requireSa()
      return paginate(filterAccounts(state.accounts, filters).map(listItem), filters.page ?? 1, filters.size ?? ACCOUNT_PAGE_SIZE)
    },
    async getAccount(id: number) { requireSa(); return detailOf(find(id)) },
    /** A11 (D33): lịch sử vai trò, mới nhất trước. */
    async accountHistory(id: number): Promise<AccessHistoryItem[]> {
      requireSa()
      find(id)
      return state.history
        .filter((h) => h.accountId === id)
        .sort((a, b) => b.id - a.id)
        .map(({ accountId: _accountId, ...item }) => structuredClone(item))
    },
    async suspendAccount(id: number, command: AccountChange) { return changeStatus(id, command, 'suspend') },
    async restoreAccount(id: number, command: AccountChange) { return changeStatus(id, command, 'restore') },

    async changePlatformAccess(id: number, command: PlatformAccessChange) {
      const actor = requireSa()
      const target = find(id)
      const roleBefore = target.platformRole
      const statusBefore = target.platformAccessStatus
      const next = planAccessChange(state.accounts, target, actor.id, command)
      target.platformRole = next.role
      target.platformAccessStatus = next.status
      target.platformAccessVersion = (target.platformAccessVersion ?? 0) + 1
      state.history.push({
        id: nextId(), accountId: id, action: command.operation, roleBefore, statusBefore, roleAfter: next.role, statusAfter: next.status,
        reason: command.reason.trim(), byName: actor.fullName, byEmail: actor.email, at: nowIso(),
      })
      const action = { GRANT: 'PLATFORM_ACCESS_GRANTED', CHANGE: 'PLATFORM_ACCESS_CHANGED', REVOKE: 'PLATFORM_ACCESS_REVOKED', RESTORE: 'PLATFORM_ACCESS_RESTORED' }[command.operation]
      const before: Record<string, string> = {}
      if (roleBefore) before.role = roleBefore
      if (statusBefore) before.status = statusBefore
      log(actor, action, 'PLATFORM_ACCESS', target, before, { role: next.role, status: next.status })
      return detailOf(target)
    },

    /** A1 (D34). */
    async listAudit(filters: AuditFilters): Promise<PageResult<AuditRow>> {
      requireSa()
      const error = validateAuditRange(filters)
      if (error) throw new PlatformAdminError('VALIDATION', error)
      return paginate(filterAudit(state.audit, filters).map(row), filters.page ?? 1, filters.size ?? AUDIT_PAGE_SIZE)
    },
    /** A2 (D34): mục không tồn tại là MSG-COM-08. */
    async getAuditEntry(id: number): Promise<AuditDetail> {
      requireSa()
      const found = state.audit.find((e) => e.id === id)
      if (!found) throw new PlatformAdminError('NOT_FOUND', MSG.gone)
      return detail(found)
    },
    /** A3 (D34). */
    async listAuditActions(): Promise<AuditActionOption[]> {
      requireSa()
      return AUDIT_ACTIONS.map((a) => ({ ...a }))
    },
    async listNotifications(): Promise<NotificationView[]> {
      requireSa()
      return state.notifications
        .map(({ targetAssigned: _assigned, ...n }) => structuredClone(n))
        .sort((a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime())
    },
    /** GBR-64: mở thông báo kiểm tra lại giao việc; yêu cầu không còn giao cho SA thì từ chối (MSG-FE20-19). */
    async openNotification(id: number): Promise<NotificationOpenResult> {
      requireSa()
      const found = state.notifications.find((n) => n.id === id)
      if (!found) throw new PlatformAdminError('NOT_FOUND', 'Không tìm thấy thông báo.')
      if (!found.readTime) found.readTime = new Date().toISOString()
      if (!found.targetAssigned) throw new PlatformAdminError('NOT_ASSIGNED', MSG.noLongerAssigned)
      return { path: `/nen-tang/yeu-cau/${found.targetCode}` }
    },
    async markAllNotificationsRead() {
      requireSa()
      const unread = state.notifications.filter((n) => !n.readTime)
      const at = new Date().toISOString()
      unread.forEach((n) => { n.readTime = at })
      return unread.length
    },

    async reset() { state = structuredClone(seed); clock = 0; seq = 1000 },
  }
}
export type PlatformAdminDemoStore = ReturnType<typeof createPlatformAdminDemoStore>
export const platformAdminDemoStore = createPlatformAdminDemoStore()
