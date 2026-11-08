import { backendFarmId, backendMode, backendTransport, type BackendMode, type BackendTransport } from '../../../api/backendTransport'
import { backendPending } from '../../../api/backendPending'
import { financeDemoStore, type FinanceDemoStore } from '../data/financeDemoStore'
import type { NoticeKind, ReceiptFilters, RecordFields, RecordFilters, ReportCriteria } from '../types'
import { createFinanceBackendApi } from './financeBackendApi'

export function createFinanceApi({ mode, farmId, transport, store }: { mode: BackendMode; farmId: string | number; transport: BackendTransport; store: FinanceDemoStore }) {
  // Backend mode is always remote; local mode is the only mode allowed to read the demo store.
  void farmId
  const backend = createFinanceBackendApi(transport)
  const requireLocal = () => { if (mode === 'backend') throw backendPending('tài chính nền tảng') }
  return {
    now() { return store.now() },
    async listFarms() { return mode === 'backend' ? backend.listFarms() : store.listFarms() },
    // GET /api/platform/finance/categories
    async listCategories() { return mode === 'backend' ? backend.listCategories() : store.listCategories() },

    // chưa có API (danh sách biên nhận gói; chỉ có chi tiết trong báo cáo)
    async listReceipts(filters: ReceiptFilters = {}) { return mode === 'backend' ? backend.listReceipts(filters) : store.listReceipts(filters) },
    async getReceipt(code: string) { return mode === 'backend' ? backend.getReceipt(code) : store.getReceipt(code) },

    // GET /api/platform/finance/records
    async listRecords(filters: RecordFilters = {}) { return mode === 'backend' ? backend.listRecords(filters) : store.listRecords(filters) },
    // GET /api/platform/finance/records/{id}
    async getRecord(code: string) { return mode === 'backend' ? backend.getRecord(code) : store.getRecord(code) },
    // GET /api/platform/finance/bank-transactions
    async listBankTransactions() { return mode === 'backend' ? backend.listBankTransactions() : store.listBankTransactions() },
    // POST /api/platform/finance/records
    async createDraft(fields: RecordFields) { return mode === 'backend' ? backend.createDraft(fields) : store.createDraft(fields) },
    // PUT /api/platform/finance/records/{id} (VersionedRecord.version)
    async saveDraft(code: string, fields: RecordFields, expectedVersion: number) { return mode === 'backend' ? backend.saveDraft(code, fields, expectedVersion) : store.saveDraft(code, fields, expectedVersion) },
    // POST /api/platform/finance/records/{id}/discard
    async discard(code: string, expectedVersion: number) { return mode === 'backend' ? backend.discard(code, expectedVersion) : store.discard(code, expectedVersion) },
    // POST /api/platform/finance/records/{id}/post
    async post(code: string, expectedVersion: number) { return mode === 'backend' ? backend.post(code, expectedVersion) : store.post(code, expectedVersion) },
    // POST /api/platform/finance/records/{id}/void
    async voidRecord(code: string, expectedVersion: number, reason: string) { return mode === 'backend' ? backend.voidRecord(code, expectedVersion, reason) : store.voidRecord(code, expectedVersion, reason) },
    // POST /api/platform/finance/records/{id}/replacement
    async createReplacement(code: string, expectedVersion: number, overrides: { amountVnd?: number; description?: string } = {}) { return mode === 'backend' ? backend.createReplacement(code, expectedVersion, overrides) : store.createReplacement(code, expectedVersion, overrides) },

    // chưa có API (bản chốt đang xem gần nhất; backend chỉ có POST/GET theo id)
    async currentReport() { return mode === 'backend' ? backend.currentReport() : store.currentReport() },
    // GET /api/platform/finance/reports/{id}
    async getReport(id: number) { return mode === 'backend' ? backend.getReport(id) : store.getReport(id) },
    // POST /api/platform/finance/reports
    async runReport(criteria: ReportCriteria) { return mode === 'backend' ? backend.runReport(criteria) : store.runReport(criteria) },
    // GET /api/platform/finance/reports/{id}/xlsx
    async exportXlsx(id: number) { return mode === 'backend' ? backend.exportXlsx(id) : store.exportXlsx(id) },

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
