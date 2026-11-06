import { backendFarmId, backendMode, backendTransport, type BackendMode, type BackendTransport } from '../../../api/backendTransport'
import { backendPending } from '../../../api/backendPending'
import { financeDemoStore, type FinanceDemoStore } from '../data/financeDemoStore'
import type { NoticeKind, ReceiptFilters, RecordFields, RecordFilters, ReportCriteria } from '../types'

export function createFinanceApi({ mode, farmId, transport, store }: { mode: BackendMode; farmId: string | number; transport: BackendTransport; store: FinanceDemoStore }) {
  // Kept for the later backend hookup; backend mode must never read the mock.
  void farmId
  void transport
  const requireLocal = () => { if (mode === 'backend') throw backendPending('tài chính nền tảng') }
  return {
    now() { return store.now() },
    // chưa có API (danh sách trại cho bộ lọc)
    async listFarms() { requireLocal(); return store.listFarms() },
    // GET /api/platform/finance/categories
    async listCategories() { requireLocal(); return store.listCategories() },

    // chưa có API (danh sách biên nhận gói; chỉ có chi tiết trong báo cáo)
    async listReceipts(filters: ReceiptFilters = {}) { requireLocal(); return store.listReceipts(filters) },
    // chưa có API
    async getReceipt(code: string) { requireLocal(); return store.getReceipt(code) },

    // GET /api/platform/finance/records
    async listRecords(filters: RecordFilters = {}) { requireLocal(); return store.listRecords(filters) },
    // GET /api/platform/finance/records/{id}
    async getRecord(code: string) { requireLocal(); return store.getRecord(code) },
    // GET /api/platform/finance/bank-transactions
    async listBankTransactions() { requireLocal(); return store.listBankTransactions() },
    // POST /api/platform/finance/records
    async createDraft(fields: RecordFields) { requireLocal(); return store.createDraft(fields) },
    // PUT /api/platform/finance/records/{id} (VersionedRecord.version)
    async saveDraft(code: string, fields: RecordFields, expectedVersion: number) { requireLocal(); return store.saveDraft(code, fields, expectedVersion) },
    // POST /api/platform/finance/records/{id}/discard
    async discard(code: string, expectedVersion: number) { requireLocal(); return store.discard(code, expectedVersion) },
    // POST /api/platform/finance/records/{id}/post
    async post(code: string, expectedVersion: number) { requireLocal(); return store.post(code, expectedVersion) },
    // POST /api/platform/finance/records/{id}/void
    async voidRecord(code: string, expectedVersion: number, reason: string) { requireLocal(); return store.voidRecord(code, expectedVersion, reason) },
    // POST /api/platform/finance/records/{id}/replacement
    async createReplacement(code: string, expectedVersion: number, overrides: { amountVnd?: number; description?: string } = {}) { requireLocal(); return store.createReplacement(code, expectedVersion, overrides) },

    // chưa có API (bản chốt đang xem gần nhất; backend chỉ có POST/GET theo id)
    async currentReport() { requireLocal(); return store.currentReport() },
    // GET /api/platform/finance/reports/{id}
    async getReport(id: number) { requireLocal(); return store.getReport(id) },
    // POST /api/platform/finance/reports
    async runReport(criteria: ReportCriteria) { requireLocal(); return store.runReport(criteria) },
    // GET /api/platform/finance/reports/{id}/xlsx
    async exportXlsx(id: number) { requireLocal(); return store.exportXlsx(id) },

    // GET /api/notifications/mine (lọc theo loại ở client)
    async listNotices(kind: NoticeKind) { requireLocal(); return store.listNotices(kind) },
    // PUT /api/notifications/{id}/read
    async markNoticeRead(id: number) { requireLocal(); return store.markNoticeRead(id) },
    // PUT /api/notifications/read-all
    async markAllNoticesRead(kind: NoticeKind) { requireLocal(); return store.markAllNoticesRead(kind) },
  }
}
export type FinanceApi = ReturnType<typeof createFinanceApi>
export const financeApi = createFinanceApi({ mode: backendMode, farmId: backendFarmId, transport: backendTransport, store: financeDemoStore })
