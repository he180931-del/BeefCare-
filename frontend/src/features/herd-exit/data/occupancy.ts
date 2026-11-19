// Normalize display labels from voucher details to canonical pen codes.
import type { CattleDetail } from '../../../types'
export const penCode = (value: unknown): string => {
  const text = String(value ?? '').trim()
  return text.match(/^([A-Za-z0-9]+)(?:\s*(?:–|-)|\s+|$)/)?.[1] ?? ''
}

export const restoreCounts = (cows: CattleDetail[] = []): Record<string, number> => cows.reduce<Record<string, number>>((counts, cow) => {
  const code = penCode(cow?.barn)
  if (code) counts[code] = (counts[code] ?? 0) + 1
  return counts
}, {})
