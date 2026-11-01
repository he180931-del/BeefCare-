import { asRows, backendFarmId, backendMode, backendTransport, numberValue, textValue, type BackendMode, type BackendTransport } from '../../../api/backendTransport'
import { listFeedReceiptDemoStock } from '../data/feedReceiptDemoStore'
import type { FeedStockRow } from '../types'

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
    async list(): Promise<FeedStockRow[]> {
      if (mode === 'backend') {
        const [stockValue, catalogueValue] = await Promise.all([
          transport.get(transport.farmPath(farmId, '/feed/stock')),
          transport.get(transport.farmPath(farmId, '/feed/catalogue')),
        ])
        const catalogue = new Map(asRows(catalogueValue).map((item) => [numberValue(item.id), item]))
        return asRows(stockValue).map((row) => {
          const item = catalogue.get(numberValue(row.feedItemId))
          return {
            ...row,
            available: item?.available === true,
            purchaseUnit: textValue(item?.purchaseUnit),
            kgPerPurchaseUnit: numberValue(item?.kgPerPurchaseUnit, 1),
          }
        }) as FeedStockRow[]
      }
      if (mockRows) return mockRows.map((row) => ({ ...row }))
      return listFeedReceiptDemoStock()
    },
  }
}

const feedStockApi = createFeedStockApi({ mode: backendMode, farmId: backendFarmId, transport: backendTransport })

/** Reads the backend projection in backend mode; local demo mode uses the synthetic fixture. */
export const listFeedStock = () => feedStockApi.list()
