import { useQuery } from '../../../shared/hooks/useQuery'
import { financeApi } from '../api/financeApi'
import type { RecordFilters, ReceiptFilters, NoticeKind } from '../types'

/**
 * Feature-owned boundary for platform-finance pages and dialogs.
 * Pages keep route/form state; this module owns all finance reads and exposes
 * the feature API for commands so UI components never call the API directly.
 */
export function usePlatformFinance() {
  return financeApi
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
