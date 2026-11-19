import { asRows, nullableNumber, numberValue, textValue } from '../../../shared/api/parse'
import { backendFarmId } from '../../../api/backendTransport'
import { backendMode, type BackendMode } from '../../../shared/config/runtime'
import { backendTransport, type BackendTransport } from '../../../shared/api/backendTransport'
import type { FeedStockRow } from '../types'
import { demo } from '../../../demo/demoModules'

export function createFeedStockApi({
  mode,
  farmId,
  transport,
  mockRows,
}: {
  mode: BackendMode
  farmId: string | number
  transport: BackendTransport
  mockRows?: readonly FeedStockRow[]
}) {
  return {
    // GET /api/farms/{farmId}/feed/stock
    async list(): Promise<FeedStockRow[]> {
      if (mode === 'backend') {
        const [stockValue, catalogueValue] = await Promise.all([
          transport.get(transport.farmPath(farmId, '/feed/stock')),
          transport.get(transport.farmPath(farmId, '/feed/catalogue')),
        ])
        const catalogue = new Map(asRows(catalogueValue).map((item) => [numberValue(item.id), item]))
        return asRows(stockValue).map((row) => {
          const feedItemId = numberValue(row.feedItemId)
          const item = catalogue.get(feedItemId)
          if (!item) throw new Error(`Không tìm thấy mặt hàng ${feedItemId} trong danh mục thức ăn.`)
          return {
            feedItemId,
            code: textValue(row.code),
            name: textValue(row.name),
            group: textValue(row.group) as FeedStockRow['group'],
            onHandKg: numberValue(row.onHandKg),
            minimumStockKg: nullableNumber(row.minimumStockKg),
            averageDailyUseKg: numberValue(row.averageDailyUseKg),
            daysOfCover: nullableNumber(row.daysOfCover),
            stockValue: numberValue(row.stockValue),
            status: textValue(row.status) as FeedStockRow['status'],
            version: numberValue(row.version),
            nearestLotNumber: typeof row.nearestLotNumber === 'string' ? row.nearestLotNumber : null,
            nearestLotExpiryDate: typeof row.nearestLotExpiryDate === 'string' ? row.nearestLotExpiryDate : null,
            available: item.available === true,
            purchaseUnit: textValue(item.purchaseUnit),
            kgPerPurchaseUnit: numberValue(item.kgPerPurchaseUnit, 1),
          } satisfies FeedStockRow
        }) as FeedStockRow[]
      }
      if (mockRows) return mockRows.map((row) => ({ ...row }))
      return demo.feedReceipt.listFeedReceiptDemoStock()
    },
  }
}

const feedStockApi = createFeedStockApi({ mode: backendMode, farmId: backendFarmId, transport: backendTransport })

/** Reads the backend projection in backend mode; local demo mode uses the synthetic fixture. */
export const listFeedStock = () => feedStockApi.list()
