import { asRecord, asRows } from '../../../shared/api/parse'
import { businessDate } from '../../../shared/lib/date/farmTime'
import { activeFarmId } from '../../../app/session/currentFarm'
import { backendMode, type BackendMode } from '../../../shared/config/runtime'
import { backendTransport, type BackendTransport } from '../../../shared/api/backendTransport'
import { createFeedFeedingApi } from './feedFeedingApi'
import { createFeedReceiptApi } from './feedReceiptApi'
import { createFeedRationApi } from './feedRationApi'
import { createFeedStockAdjustmentApi } from './feedStockAdjustmentApi'
import { createFeedCatalogueApi } from './feedCatalogueApi'
import type {
  FeedConsumptionApiResult,
  FeedConsumptionBackendReport,
  FeedConsumptionBackendRow,
  FeedConsumptionReportGroupedRow,
  FeedConsumptionRange,
  FeedConsumptionSupportingData,
  FeedConsumptionGroupBy,
} from '../types/feedConsumption'

export type FeedConsumptionDataLoader = (range: FeedConsumptionRange) => Promise<FeedConsumptionSupportingData>

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

function parseConsumptionReport(value: unknown): FeedConsumptionBackendReport {
  const body = asRecord(value)
  if (typeof body.from !== 'string' || typeof body.to !== 'string' || !['HERD_GROUP', 'PEN', 'FEED'].includes(String(body.groupBy))
    || !asRecord(body.tiles) || !asRecord(body.total) || !Array.isArray(body.rows) || !Array.isArray(body.rawRows) || !Array.isArray(body.costByFeed)
    || !asRecord(body.adjustmentLosses)) {
    throw new Error('Dữ liệu báo cáo tiêu thụ từ máy chủ không hợp lệ.')
  }
  const rawRows: FeedConsumptionBackendRow[] = asRows(body.rawRows).map((row) => {
    if (!isFiniteNumber(row.penId) || typeof row.penCode !== 'string' || typeof row.herdGroup !== 'string'
      || !isFiniteNumber(row.feedItemId) || typeof row.feedCode !== 'string'
      || !isFiniteNumber(row.plannedKg) || !isFiniteNumber(row.actualKg)
      || (row.varianceRatio !== null && !isFiniteNumber(row.varianceRatio))
      || (row.totalCost !== null && !isFiniteNumber(row.totalCost))) {
      throw new Error('Một dòng báo cáo tiêu thụ từ máy chủ không hợp lệ.')
    }
    return {
      penId: row.penId,
      penCode: row.penCode,
      herdGroup: row.herdGroup,
      feedItemId: row.feedItemId,
      feedCode: row.feedCode,
      plannedKg: row.plannedKg,
      actualKg: row.actualKg,
      varianceRatio: row.varianceRatio as number | null,
      totalCost: row.totalCost as number | null,
    }
  })
  const groupedRows: FeedConsumptionReportGroupedRow[] = asRows(body.rows).map((row) => {
    if (typeof row.group !== 'string' || !isFiniteNumber(row.avgHead) || !isFiniteNumber(row.kg) || !isFiniteNumber(row.kgPerHeadDay)
      || !isFiniteNumber(row.cost) || !isFiniteNumber(row.costPerHeadDay) || (row.variancePct !== null && !isFiniteNumber(row.variancePct))
      || !Array.isArray(row.notes) || row.notes.some((note) => typeof note !== 'string')) throw new Error('Một dòng nhóm báo cáo tiêu thụ từ máy chủ không hợp lệ.')
    return { group: row.group, avgHead: row.avgHead, kg: row.kg, kgPerHeadDay: row.kgPerHeadDay, cost: row.cost, costPerHeadDay: row.costPerHeadDay, variancePct: row.variancePct as number | null, notes: row.notes as string[] }
  })
  const numberFields = ['kg', 'cost', 'averageKgPerHeadDay', 'averageCostPerHeadDay', 'days', 'headDays', 'receivedKg', 'receiptCount', 'receivedAmount']
  const tiles = asRecord(body.tiles); const total = asRecord(body.total)
  if (numberFields.some((field) => !isFiniteNumber(tiles[field])) || ['kg', 'cost', 'kgPerHeadDay', 'costPerHeadDay', 'days', 'headDays'].some((field) => !isFiniteNumber(total[field]))) throw new Error('Tổng hợp báo cáo tiêu thụ từ máy chủ không hợp lệ.')
  const costByFeed = asRows(body.costByFeed).map((row) => { if (typeof row.feedCode !== 'string' || typeof row.feedName !== 'string' || !isFiniteNumber(row.kg) || !isFiniteNumber(row.cost)) throw new Error('Chi phí theo thức ăn từ máy chủ không hợp lệ.'); return { feedCode: row.feedCode, feedName: row.feedName, kg: row.kg, cost: row.cost } })
  const adjustmentLosses = asRecord(body.adjustmentLosses)
  const adjustmentLossKg = adjustmentLosses.kg == null ? null : isFiniteNumber(adjustmentLosses.kg) ? adjustmentLosses.kg : NaN
  const adjustmentLossValue = adjustmentLosses.value == null ? null : isFiniteNumber(adjustmentLosses.value) ? adjustmentLosses.value : NaN
  if ((adjustmentLossKg !== null && !Number.isFinite(adjustmentLossKg))
    || (adjustmentLossValue !== null && !Number.isFinite(adjustmentLossValue))) {
    throw new Error('Dữ liệu tổn thất trong báo cáo không hợp lệ.')
  }
  return {
    from: body.from,
    to: body.to,
    groupBy: body.groupBy as FeedConsumptionBackendReport['groupBy'],
    tiles: tiles as FeedConsumptionBackendReport['tiles'],
    rows: groupedRows,
    total: total as FeedConsumptionBackendReport['total'],
    costByFeed,
    adjustmentLosses: { kg: adjustmentLossKg, value: adjustmentLossValue },
    rawRows,
    adjustmentLossKg,
    adjustmentLossValue,
    generatedAt: typeof body.generatedAt === 'string' ? body.generatedAt : null,
  }
}

function createSupportingDataLoader(mode: BackendMode, farmId: string | number | null, transport: BackendTransport): FeedConsumptionDataLoader {
  const feedingApi = createFeedFeedingApi({ mode, farmId, transport })
  const receiptApi = createFeedReceiptApi({ mode, farmId, transport })
  const adjustmentApi = createFeedStockAdjustmentApi({ mode, farmId, transport })
  const catalogueApi = createFeedCatalogueApi({ mode, farmId, transport })
  const rationApi = createFeedRationApi({ mode, farmId, transport })
  return async (range) => {
    const [feedings, receipts, adjustments, catalogue, rations] = await Promise.all([
      feedingApi.list(range),
      receiptApi.list(),
      adjustmentApi.list(),
      catalogueApi.listFeeds(),
      rationApi.list(),
    ])
    return { feedings, receipts, adjustments, catalogue, rations }
  }
}

export function createFeedConsumptionApi({
  mode,
  farmId,
  transport,
  loadDemoData,
  loadBackendData,
}: {
  mode: BackendMode
  farmId: string | number | null
  transport: BackendTransport
  loadDemoData?: FeedConsumptionDataLoader
  loadBackendData?: FeedConsumptionDataLoader
}) {
  const readDemoData = loadDemoData ?? createSupportingDataLoader('local', farmId, transport)
  const readBackendData = loadBackendData ?? createSupportingDataLoader('backend', farmId, transport)

  return {
    async load(range: FeedConsumptionRange & { groupBy?: FeedConsumptionGroupBy }): Promise<FeedConsumptionApiResult> {
      if (mode === 'backend') {
        const path = transport.farmPath(farmId, '/feed/reports/consumption')
        const request = { from: range.from, to: range.to, groupBy: range.groupBy ?? 'HERD_GROUP' }
        const [report, supporting] = await Promise.all([
          transport.command(path, request, { method: 'POST' }),
          readBackendData(range),
        ])
        return { ...supporting, source: 'backend', backendReport: parseConsumptionReport(report) }
      }
      const supporting = await readDemoData(range)
      return { ...supporting, source: 'demo', backendReport: null }
    },
  }
}

const api = createFeedConsumptionApi({ mode: backendMode, farmId: activeFarmId, transport: backendTransport })

export const loadFeedConsumptionReport = (range: FeedConsumptionRange & { groupBy?: FeedConsumptionGroupBy }) => api.load(range)

/** Một số chỉ số của máy chủ có thể thiếu nguồn số liệu; bản mô phỏng luôn đủ. */
export const feedConsumptionMayLackSources = backendMode === 'backend'

/** Kỳ mở đầu của báo cáo: SRS GBR-66 quy định từ đầu tháng đến hôm nay. */
export function defaultFeedConsumptionPeriod(): { from: string; to: string } {
  const today = businessDate()
  return { from: today.slice(0, 7) + '-01', to: today }
}
