// @ts-nocheck
// Normalize display labels from voucher details to canonical pen codes.
export const penCode = (value) => {
  const text = String(value ?? '').trim()
  return text.match(/^([A-Za-z0-9]+)(?:\s*(?:–|-)|\s+|$)/)?.[1] ?? ''
}

export const restoreCounts = (cows = []) => cows.reduce((counts, cow) => {
  const code = penCode(cow?.barn)
  if (code) counts[code] = (counts[code] ?? 0) + 1
  return counts
}, {})
