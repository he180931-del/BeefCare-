import { dmy, kg } from '../../../shared/lib/format'
import { toFarmLocal } from '../../../shared/lib/date/farmTime'
import type { ExitCattleDetail, ExitHistoryEntry, HerdExit } from '../types'

/** Instant → "dd/mm/yyyy HH:mm" at farm time; empty when unknown. */
export function farmDateTime(instant: string | undefined): string {
  const local = toFarmLocal(instant)
  return local ? `${dmy(local.slice(0, 10))} ${local.slice(11, 16)}` : ''
}

/** SCR-41 #13 / SCR-76 total weight: kg with "~" when any line is estimated; "—" when unknown. */
export function exitWeightLabel(row: Pick<HerdExit, 'weightKg' | 'weightEstimated' | 'weight'>): string {
  if (row.weightKg !== undefined) return row.weightKg == null ? '—' : `${row.weightEstimated ? '~' : ''}${kg(row.weightKg)}`
  // Local drafts saved by the exit form still carry the legacy display text.
  if (typeof row.weight === 'number') return kg(row.weight)
  return row.weight || '—'
}

/** SCR-76 #3 exit weight + basis: "352 kg · Đo" / "~180 kg · UT". */
export function cattleWeightLabel(cow: Pick<ExitCattleDetail, 'weight' | 'estimated' | 'weightBasis'>): string {
  if (cow.weight == null || cow.weight === 0 && !cow.weightBasis) return '—'
  const estimated = cow.weightBasis ? cow.weightBasis === 'ESTIMATED' : Boolean(cow.estimated)
  return estimated ? `~${kg(cow.weight)} · UT` : `${kg(cow.weight)} · Đo`
}

/** History entries persisted by older local data were plain strings. */
export function historyEntries(value: ReadonlyArray<ExitHistoryEntry | string> | undefined): ExitHistoryEntry[] {
  return (value ?? []).map((item) => typeof item === 'string' ? { text: item } : item).filter((item) => item.text)
}

/** "dd/mm HH:mm · actor · text" (SCR-76 #7). */
export function historyLine(entry: ExitHistoryEntry): string {
  const time = farmDateTime(entry.time)
  return [time ? `${time.slice(0, 5)} ${time.slice(11)}` : '', entry.actor, entry.text].filter(Boolean).join(' · ')
}
