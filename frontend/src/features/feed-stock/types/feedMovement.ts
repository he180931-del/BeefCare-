/** Mirrors MovementView (GET /api/farms/{farmId}/feed/stock/{feedId}/movements); sourceCode is a local-demo extra. */
export type FeedMovement = {
  id: number
  feedItemId: number
  feedCode: string
  movementType: string
  quantityKg: number
  unitCost: number | null
  balanceAfterKg: number
  sourceType: string
  sourceId: number | null
  sourceCode?: string | null
  occurredAt: string
}
