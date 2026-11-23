import { asRows, nullableNumber, numberValue, textValue } from '../../../shared/api/parse'
import { activeFarmId } from '../../../app/session/currentFarm'
import { backendMode, type BackendMode } from '../../../shared/config/runtime'
import { backendTransport, type BackendTransport } from '../../../shared/api/backendTransport'
import type { FeedMovement } from '../types/feedMovement'
import { demo } from '../../../demo/demoModules'

export function createFeedMovementApi({ mode, farmId, transport }: { mode: BackendMode; farmId: string | number | null; transport: BackendTransport }) {
  return {
    // GET /api/farms/{farmId}/feed/stock/{feedId}/movements
    async list(feedItemId: number): Promise<FeedMovement[]> {
      if (mode !== 'backend') return demo.feedReceipt.listFeedMovementsDemo(feedItemId)
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
      return mode === 'backend' ? null : demo.feedReceipt.latestFeedMovementDemo()
    },
  }
}

const api = createFeedMovementApi({ mode: backendMode, farmId: activeFarmId, transport: backendTransport })
export const listFeedMovements = (feedItemId: number) => api.list(feedItemId)
export const getFeedStockUpdatedAt = () => api.updatedAt()
