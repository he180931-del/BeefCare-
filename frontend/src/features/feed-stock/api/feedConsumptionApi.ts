import { asRecord, asRows, backendFarmId, backendMode, backendTransport, type BackendMode, type BackendTransport } from '../../../api/backendTransport'
import { createFeedFeedingApi } from './feedFeedingApi'
import { createFeedReceiptApi } from './feedReceiptApi'
import { createFeedRationApi } from './feedRationApi'
import { createFeedStockAdjustmentApi } from './feedStockAdjustmentApi'
import { createFeedCatalogueApi } from './feedCatalogueApi'
import type {
  FeedConsumptionApiResult,
  FeedConsumptionBackendReport,
  FeedConsumptionBackendRow,
  FeedConsumptionRange,
  FeedConsumptionSupportingData,
} from '../types/feedConsumption'

export type FeedConsumptionDataLoader = (range: FeedConsumptionRange) => Promise<FeedConsumptionSupportingData>

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

function parseConsumptionReport(value: unknown): FeedConsumptionBackendReport {
  const body = asRecord(value)
  if (typeof body.from !== 'string' || typeof body.to !== 'string' || !Array.isArray(body.rows)) {
    throw new Error('Dữ liệu báo cáo tiêu thụ từ máy chủ không hợp lệ.')
  }
  const rows: FeedConsumptionBackendRow[] = asRows(body.rows).map((row) => {
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
  const adjustmentLossKg = body.adjustmentLossKg === null || body.adjustmentLossKg === undefined
    ? null : isFiniteNumber(body.adjustmentLossKg) ? body.adjustmentLossKg : NaN
  const adjustmentLossValue = body.adjustmentLossValue === null || body.adjustmentLossValue === undefined
    ? null : isFiniteNumber(body.adjustmentLossValue) ? body.adjustmentLossValue : NaN
  if ((adjustmentLossKg !== null && !Number.isFinite(adjustmentLossKg))
    || (adjustmentLossValue !== null && !Number.isFinite(adjustmentLossValue))) {
    throw new Error('Dữ liệu tổn thất trong báo cáo không hợp lệ.')
  }
  return {
    from: body.from,
    to: body.to,
    rows,
    adjustmentLossKg,
    adjustmentLossValue,
    generatedAt: typeof body.generatedAt === 'string' ? body.generatedAt : null,
  }
}

function createSupportingDataLoader(mode: BackendMode, farmId: string | number, transport: BackendTransport): FeedConsumptionDataLoader {
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
  farmId: string | number
  transport: BackendTransport
  loadDemoData?: FeedConsumptionDataLoader
  loadBackendData?: FeedConsumptionDataLoader
}) {
  const readDemoData = loadDemoData ?? createSupportingDataLoader('local', farmId, transport)
  const readBackendData = loadBackendData ?? createSupportingDataLoader('backend', farmId, transport)

  return {
    async load(range: FeedConsumptionRange): Promise<FeedConsumptionApiResult> {
      if (mode === 'backend') {
        const path = transport.farmPath(farmId, '/feed/reports/consumption')
        const [report, supporting] = await Promise.all([
          transport.command(path, range, { method: 'POST' }),
          readBackendData(range),
        ])
        return { ...supporting, source: 'backend', backendReport: parseConsumptionReport(report) }
      }
      const supporting = await readDemoData(range)
      return { ...supporting, source: 'demo', backendReport: null }
    },
  }
}

const api = createFeedConsumptionApi({ mode: backendMode, farmId: backendFarmId, transport: backendTransport })

export const loadFeedConsumptionReport = (range: FeedConsumptionRange) => api.load(range)
