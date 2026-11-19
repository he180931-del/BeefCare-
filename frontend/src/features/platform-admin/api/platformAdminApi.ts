import { backendFarmId, backendMode, backendTransport, type BackendMode, type BackendTransport } from '../../../api/backendTransport'
import { backendPending } from '../../../api/backendPending'
import { platformAdminDemoStore, type PlatformAdminDemoStore } from '../data/platformAdminDemoStore'
import { auditToCsv, defaultAuditRange, toYmd } from '../domain/platformRules'
import type { AccountChange, AccountFilters, AuditFilters, PlatformAccessChange } from '../types'

export function createPlatformAdminApi({ mode, farmId, transport, store }: { mode: BackendMode; farmId: string | number; transport: BackendTransport; store: PlatformAdminDemoStore }) {
  // Kept for the later backend hookup; backend mode must never read the mock.
  void farmId
  void transport
  const requireLocal = () => { if (mode === 'backend') throw backendPending('quản trị nền tảng') }
  return {
    // GET /api/platform/accounts ?q,status,page,size (lọc theo vai trò nền tảng: OpenAPI chưa có tham số, lọc phía client)
    async listAccounts(filters: AccountFilters = {}) { requireLocal(); return store.listAccounts(filters) },
    // GET /api/platform/accounts/{id}
    async getAccount(id: number) { requireLocal(); return store.getAccount(id) },
    // GET /api/platform/accounts/{id}/history
    async accountHistory(id: number) { requireLocal(); return store.accountHistory(id) },
    // POST /api/platform/accounts/{id}/suspend  (AccountChange: reason, version = expectedVersion)
    async suspendAccount(id: number, command: AccountChange) { requireLocal(); return store.suspendAccount(id, command) },
    // POST /api/platform/accounts/{id}/restore  (AccountChange: reason, version = expectedVersion)
    async restoreAccount(id: number, command: AccountChange) { requireLocal(); return store.restoreAccount(id, command) },
    // POST /api/platform/accounts/{id}/platform-access  (PlatformAccessRequest: operation, role, reason, version = expectedVersion)
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
