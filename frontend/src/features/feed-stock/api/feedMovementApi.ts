import { asRows, backendFarmId, backendMode, backendTransport, nullableNumber, numberValue, textValue, type BackendMode, type BackendTransport } from '../../../api/backendTransport'
import { latestFeedMovementDemo, listFeedMovementsDemo } from '../data/feedReceiptDemoStore'
import type { FeedMovement } from '../types/feedMovement'

export function createFeedMovementApi({ mode, farmId, transport }: { mode: BackendMode; farmId: string | number; transport: BackendTransport }) {
  return {
    // GET /api/farms/{farmId}/feed/stock/{feedId}/movements
    async list(feedItemId: number): Promise<FeedMovement[]> {
      if (mode !== 'backend') return listFeedMovementsDemo(feedItemId)
      const rows = asRows(await transport.get(transport.farmPath(farmId, `/feed/stock/${feedItemId}/movements`)))
      return rows.map((row) => ({
        id: numberValue(row.id),
        feedItemId: numberValue(row.feedItemId, feedItemId),
        feedCode: textValue(row.feedCode),
        movementType: textValue(row.movementType),
        quantityKg: numberValue(row.quantityKg),
        unitCost: nullableNumber(row.unitCost),
        balanceAfterKg: numberValue(row.balanceAfterKg),
        sourceType: textValue(row.sourceType),
        sourceId: nullableNumber(row.sourceId),
        occurredAt: textValue(row.occurredAt),
      })).sort((left, right) => right.occurredAt.localeCompare(left.occurredAt) || right.id - left.id)
    },
    /** Time of the latest stock movement; the backend has no single endpoint for it, so backend mode returns null. */
    async updatedAt(): Promise<string | null> {
      return mode === 'backend' ? null : latestFeedMovementDemo()
    },
  }
}

const api = createFeedMovementApi({ mode: backendMode, farmId: backendFarmId, transport: backendTransport })
export const listFeedMovements = (feedItemId: number) => api.list(feedItemId)
export const getFeedStockUpdatedAt = () => api.updatedAt()
