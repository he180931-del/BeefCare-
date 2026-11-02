import {
  MSG, PlatformAdminError, allowedAuditDetails, accessText, checkAccountChange, filterAccounts, filterAudit, isActiveSa, paginate,
  planAccessChange, validateAuditRange,
} from '../domain/platformRules'
import type {
  AccountChange, AccountFilters, AccountSummary, AuditActorOption, AuditEntry, AuditFilters, AuditItem, NotificationOpenResult,
  NotificationView, PlatformAccessChange,
} from '../types'
import { createPlatformAdminSeed, type PlatformAdminSeed, type RawAuditEntry } from './platformAdminMock'

const ACCOUNT_PAGE_SIZE = 20
const AUDIT_PAGE_SIZE = 20

export function createPlatformAdminDemoStore(seed: PlatformAdminSeed = createPlatformAdminSeed()) {
  let state = structuredClone(seed)
  let clock = 0
  let seq = 1000

  // Giờ mock cố định theo "hôm nay" của seed để sự kiện mới luôn nằm trong khoảng audit mặc định.
  const nowIso = () => new Date(new Date(`${state.today}T09:00:00`).getTime() + clock++ * 60_000).toISOString()
  const nextId = () => ++seq
  const view = (e: RawAuditEntry): AuditEntry => ({ ...structuredClone(e), details: allowedAuditDetails(e.details) })

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
  const log = (actor: AccountSummary, action: string, target: AccountSummary, before: string, after: string, scope = '') => {
    state.audit.push({
      id: nextId(), loggedAt: nowIso(), actorId: actor.id, actorEmail: actor.email, actorName: actor.fullName, actorRole: actor.platformRole,
      farmName: null, action, targetType: 'ACCOUNT', targetId: target.id, targetLabel: target.fullName, targetRef: `a${String(target.id).padStart(3, '0')}…${String(nextId()).slice(-4)}`,
      details: { before, after, correlationId: `req-${seq.toString(16)}-${(seq * 7919).toString(16).slice(-4)}`, scope },
    })
  }

  function changeStatus(id: number, command: AccountChange, op: 'suspend' | 'restore') {
    const actor = requireSa()
    const target = find(id)
    checkAccountChange(state.accounts, target, actor.id, command, op)
    target.accountStatus = op === 'suspend' ? 'SUSPENDED' : 'ACTIVE'
    target.version += 1
    log(actor, op === 'suspend' ? 'ACCOUNT_SUSPENDED' : 'ACCOUNT_RESTORED', target,
      `status: ${op === 'suspend' ? 'ACTIVE' : 'SUSPENDED'}`, `status: ${target.accountStatus}`)
    return structuredClone(target)
  }

  return {
    today: () => state.today,

    async listAccounts(filters: AccountFilters = {}) {
      requireSa()
      return structuredClone(paginate(filterAccounts(state.accounts, filters), filters.page ?? 1, filters.size ?? ACCOUNT_PAGE_SIZE))
    },
    async getAccount(id: number) { requireSa(); return structuredClone(find(id)) },
    async accountHistory(id: number): Promise<AuditItem[]> {
      requireSa()
      find(id)
      return state.history
        .filter((h) => h.accountId === id)
        .sort((a, b) => b.id - a.id)
        .map((h) => ({ id: h.id, action: h.operation, at: h.at, details: `${h.role} · ${h.reason} · bởi ${h.by}` }))
    },
    async suspendAccount(id: number, command: AccountChange) { return changeStatus(id, command, 'suspend') },
    async restoreAccount(id: number, command: AccountChange) { return changeStatus(id, command, 'restore') },

    async changePlatformAccess(id: number, command: PlatformAccessChange) {
      const actor = requireSa()
      const target = find(id)
      const before = accessText(target.platformRole, target.platformAccessStatus)
      const next = planAccessChange(state.accounts, target, command)
      target.platformRole = next.role
      target.platformAccessStatus = next.status
      target.platformAccessVersion += 1
      state.history.push({ id: nextId(), accountId: id, operation: command.operation, role: next.role, reason: command.reason.trim(), by: actor.fullName, at: nowIso() })
      const action = { GRANT: 'PLATFORM_ACCESS_GRANTED', CHANGE: 'PLATFORM_ACCESS_CHANGED', REVOKE: 'PLATFORM_ACCESS_REVOKED', RESTORE: 'PLATFORM_ACCESS_RESTORED' }[command.operation]
      log(actor, action, target, before, accessText(next.role, next.status), next.role)
      return structuredClone(target)
    },

    async listAudit(filters: AuditFilters) {
      requireSa()
      const error = validateAuditRange(filters)
      if (error) throw new PlatformAdminError('VALIDATION', error)
      const rows = filterAudit(state.audit, filters).map((e) => view(e))
      return paginate(rows, filters.page ?? 1, filters.size ?? AUDIT_PAGE_SIZE)
    },
    async getAuditEntry(id: number) {
      requireSa()
      const found = state.audit.find((e) => e.id === id)
      if (!found) throw new PlatformAdminError('NOT_FOUND', 'Không tìm thấy sự kiện audit.')
      return view(found)
    },
    async listAuditActors(): Promise<AuditActorOption[]> {
      requireSa()
      const people = new Map<number, string>()
      let hasSystem = false
      for (const e of state.audit) {
        if (e.actorId === null) hasSystem = true
        else people.set(e.actorId, `${e.actorName} · ${e.actorRole}`)
      }
      const options = [...people].map(([value, label]) => ({ value: String(value), label })).sort((a, b) => a.label.localeCompare(b.label, 'vi'))
      return hasSystem ? [{ value: 'SYSTEM', label: 'Hệ thống' }, ...options] : options
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
