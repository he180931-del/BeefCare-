import { activeFarmId } from '../../../app/session/currentFarm'
import { backendTransport, type BackendTransport } from '../../../shared/api/backendTransport'
import { asRecord } from '../../../shared/api/parse'

export type CashFlowSource = 'HERD_EXIT' | 'HERD_ENTRY' | 'FEED_RECEIPT' | 'SUBSCRIPTION'
export type CashFlowDirection = 'IN' | 'OUT'
export type CashFlowFilters = {
  from: string
  to: string
  source: CashFlowSource | ''
  direction: CashFlowDirection | ''
  page: number
  size: number
}
export type CashFlowItem = {
  id: string
  source: CashFlowSource
  direction: CashFlowDirection
  cashDate: string
  amountVnd: number
  documentId: number
  documentCode: string | null
  method: string | null
}
export type FarmCashFlowView = {
  generatedAt: string
  totalIncome: number
  totalExpense: number
  netCashFlow: number
  totalElements: number
  items: CashFlowItem[]
}

const SOURCES = new Set<CashFlowSource>(['HERD_EXIT', 'HERD_ENTRY', 'FEED_RECEIPT', 'SUBSCRIPTION'])
const DIRECTIONS = new Set<CashFlowDirection>(['IN', 'OUT'])

const requiredText = (record: Record<string, unknown>, key: string) => {
  const value = record[key]
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`Dữ liệu báo cáo thiếu ${key}.`)
  return value
}
const amount = (record: Record<string, unknown>, key: string) => {
  const value = record[key]
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error(`Dữ liệu báo cáo không hợp lệ tại ${key}.`)
  return value
}

function mapCashFlow(body: unknown): FarmCashFlowView {
  const record = asRecord(body)
  const items = record.items
  if (!Array.isArray(items)) throw new Error('Dữ liệu báo cáo thiếu items.')
  const mappedItems = items.map((value): CashFlowItem => {
    const row = asRecord(value)
    const source = requiredText(row, 'source') as CashFlowSource
    const direction = requiredText(row, 'direction') as CashFlowDirection
    const documentId = row.documentId
    const method = row.method
    const documentCode = row.documentCode
    if (!SOURCES.has(source) || !DIRECTIONS.has(direction)) throw new Error('Dữ liệu báo cáo có loại khoản không hợp lệ.')
    if (typeof documentId !== 'number' || !Number.isSafeInteger(documentId) || documentId < 1) throw new Error('Dữ liệu báo cáo thiếu documentId.')
    if (method !== null && method !== undefined && typeof method !== 'string') throw new Error('Dữ liệu báo cáo có hình thức không hợp lệ.')
    if (documentCode !== null && documentCode !== undefined && typeof documentCode !== 'string') throw new Error('Dữ liệu báo cáo có chứng từ không hợp lệ.')
    return {
      id: requiredText(row, 'id'), source, direction, cashDate: requiredText(row, 'cashDate'),
      amountVnd: amount(row, 'amountVnd'), documentId,
      documentCode: typeof documentCode === 'string' ? documentCode : null,
      method: typeof method === 'string' ? method : null,
    }
  })
  const totalElements = record.totalElements
  if (typeof totalElements !== 'number' || !Number.isSafeInteger(totalElements) || totalElements < 0) throw new Error('Dữ liệu báo cáo có tổng số khoản không hợp lệ.')
  return {
    generatedAt: requiredText(record, 'generatedAt'),
    totalIncome: amount(record, 'totalIncome'),
    totalExpense: amount(record, 'totalExpense'),
    netCashFlow: typeof record.netCashFlow === 'number' && Number.isFinite(record.netCashFlow) ? record.netCashFlow : (() => { throw new Error('Dữ liệu báo cáo thiếu netCashFlow.') })(),
    totalElements,
    items: mappedItems,
  }
}

export function createCashFlowReportApi({ farmId, transport }: { farmId: number | string | null; transport: BackendTransport }) {
  const path = (filters: CashFlowFilters) => {
    const query = new URLSearchParams({ from: filters.from, to: filters.to })
    if (filters.source) query.set('source', filters.source)
    if (filters.direction) query.set('direction', filters.direction)
    query.set('page', String(filters.page))
    query.set('size', String(filters.size))
    return transport.farmPath(farmId, `/dashboard/cash-flow?${query.toString()}`)
  }
  return {
    async getReport(filters: CashFlowFilters): Promise<FarmCashFlowView> {
      return mapCashFlow(await transport.get(path(filters)))
    },
  }
}

/** This feature is backend-only: a failed farm request is surfaced instead of falling back to sample money. */
export const cashFlowReportApi = createCashFlowReportApi({ farmId: activeFarmId, transport: backendTransport })
