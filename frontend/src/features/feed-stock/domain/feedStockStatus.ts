import type { FeedStockStatus } from '../types'

/** Below this many days of cover a feed counts as "Sắp hết" even when stock is above its minimum level (as drawn in Figma). */
export const LOW_COVER_DAYS = 4

/** SRS GBR-104 (stock <= minimum) plus the Figma "running out within days" reading; backend mode shows the server status. */
export function deriveFeedStockStatus(onHandKg: number, minimumStockKg: number | null, averageDailyUseKg = 0): FeedStockStatus {
  if (onHandKg <= 0) return 'OUT_OF_STOCK'
  if (minimumStockKg !== null && onHandKg <= minimumStockKg) return 'LOW'
  if (averageDailyUseKg > 0 && onHandKg / averageDailyUseKg < LOW_COVER_DAYS) return 'LOW'
  return 'SUFFICIENT'
}
