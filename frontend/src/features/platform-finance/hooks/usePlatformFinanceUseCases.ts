import { useQuery } from '../../../shared/hooks/useQuery'
import { financeApi } from '../api/financeApi'
import type { NoticeKind, RecordFields, RecordFilters, ReceiptFilters, ReportCriteria } from '../types'

/**
 * Feature-owned boundary for platform-finance pages and dialogs.
 * Pages keep route/form state; this module owns all finance reads and exposes
 * the feature API for commands so UI components never call the API directly.
 */
export function usePlatformFinanceUseCases() {
  return {
    isBackend: () => financeApi.isBackend(),
    now: () => financeApi.now(),
    defaultDateRange: () => financeApi.defaultDateRange(),
    defaultReportCriteria: () => financeApi.defaultReportCriteria(),
    createDraft: (fields: RecordFields) => financeApi.createDraft(fields),
    saveDraft: (code: string, fields: RecordFields, expectedVersion: number) => financeApi.saveDraft(code, fields, expectedVersion),
    discard: (code: string, expectedVersion: number) => financeApi.discard(code, expectedVersion),
    post: (code: string, expectedVersion: number) => financeApi.post(code, expectedVersion),
    voidRecord: (code: string, expectedVersion: number, reason: string) => financeApi.voidRecord(code, expectedVersion, reason),
    createReplacement: (code: string, expectedVersion: number, overrides?: { amountVnd?: number; description?: string }) => financeApi.createReplacement(code, expectedVersion, overrides),
    runReport: (criteria: ReportCriteria) => financeApi.runReport(criteria),
    exportXlsx: (id: number) => financeApi.exportXlsx(id),
    markNoticeRead: (id: number) => financeApi.markNoticeRead(id),
    markAllNoticesRead: (kind: NoticeKind) => financeApi.markAllNoticesRead(kind),
  }
}

export function useFinanceFarms() {
  return useQuery(() => financeApi.listFarms(), [])
}

export function useFinanceCategories() {
  return useQuery(() => financeApi.listCategories(), [])
}

export function useFinanceRecords(filters: RecordFilters, reloadKey = 0) {
  return useQuery(() => financeApi.listRecords(filters), [filters, reloadKey])
}

export function useFinanceRecord(code: string | null | undefined, reloadKey: unknown = 0) {
  return useQuery(() => code ? financeApi.getRecord(code) : Promise.resolve(null), [code, reloadKey])
}

export function useFinanceBankTransactions(refreshKey: unknown) {
  return useQuery(() => financeApi.listBankTransactions(), [refreshKey])
}

export function useFinanceReceipts(filters: ReceiptFilters) {
  return useQuery(() => financeApi.listReceipts(filters), [filters.search, filters.farmId, filters.from, filters.to, filters.page, filters.size])
}

export function useFinanceReceipt(code: string | null | undefined) {
  return useQuery(() => code ? financeApi.getReceipt(code) : Promise.resolve(null), [code])
}

export function useFinanceCurrentReport() {
  return useQuery(() => financeApi.currentReport(), [])
}

export function useFinanceNotices(kind: NoticeKind) {
  return useQuery(async () => ({ list: await financeApi.listNotices(kind), now: financeApi.now() }), [kind])
}
