import { asRecord, asRows, backendFarmId, backendMode, backendTransport, numberValue, textValue, type BackendMode, type BackendTransport } from '../../../api/backendTransport'
import { financeDemoStore, type FinanceDemoStore } from '../data/financeDemoStore'
import type { NoticeKind, ReceiptFilters, RecordFields, RecordFilters, ReportCriteria } from '../types'
import { createFinanceBackendApi } from './financeBackendApi'
import type { PmNotice } from '../types'

const mapNotice = (value: unknown): PmNotice => {
  const row = asRecord(value)
  const category = textValue(row.category).toUpperCase()
  const targetType = textValue(row.targetType).toUpperCase()
  const targetId = numberValue(row.targetId)
  const kind = category === 'SUPPORT' ? 'SUPPORT' : 'RECON'
  const href = targetType === 'SUPPORT_TICKET' ? `/nen-tang/ho-tro/${targetId}`
    : targetType === 'INTERNAL_REQUEST' ? `/nen-tang/yeu-cau/${targetId}`
      : '/nen-tang/thanh-toan'
  const actionLabel = targetType === 'INTERNAL_REQUEST' ? 'Mở yêu cầu' : targetType === 'SUPPORT_TICKET' ? 'Mở ticket' : 'Xem xét'
  return { id: numberValue(row.id), kind, title: textValue(row.title), summary: textValue(row.summary), createdTime: textValue(row.createdTime), readTime: row.readTime == null ? null : textValue(row.readTime), actionLabel, href }
}

export function createFinanceApi({ mode, farmId, transport, store }: { mode: BackendMode; farmId: string | number; transport: BackendTransport; store: FinanceDemoStore }) {
  // Backend mode is always remote; local mode is the only mode allowed to read the demo store.
  void farmId
  const backend = createFinanceBackendApi(transport)
  return {
    now() { return mode === 'backend' ? new Date().toISOString().slice(0, 10) : store.now().slice(0, 10) },
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

    // GET /api/notifications/mine (lọc nhóm nền tảng ở client)
    async listNotices(kind: NoticeKind) {
      if (mode === 'local') return store.listNotices(kind)
      return asRows(await transport.get('/api/notifications/mine')).map(mapNotice).filter((notice) => notice.kind === kind)
    },
    // PUT /api/notifications/{id}/read
    async markNoticeRead(id: number) {
      if (mode === 'local') return store.markNoticeRead(id)
      return mapNotice(await transport.command(`/api/notifications/${id}/read`, undefined, { method: 'PUT' }))
    },
    // Backend endpoint đọc tất cả không có filter; chỉ đánh dấu các notice cùng nhóm để không làm đổi tab khác.
    async markAllNoticesRead(kind: NoticeKind) {
      if (mode === 'local') return store.markAllNoticesRead(kind)
      const rows = asRows(await transport.get('/api/notifications/mine')).map(mapNotice).filter((notice) => notice.kind === kind && notice.readTime == null)
      await Promise.all(rows.map((notice) => transport.command(`/api/notifications/${notice.id}/read`, undefined, { method: 'PUT' })))
      return rows.length
    },
  }
}
export type FinanceApi = ReturnType<typeof createFinanceApi>
export const financeApi = createFinanceApi({ mode: backendMode, farmId: backendFarmId, transport: backendTransport, store: financeDemoStore })
