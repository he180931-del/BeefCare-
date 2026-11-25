import type { HerdEntry } from '../types'

export const ENTRY_PAGE_SIZE = 10
export type EntrySortField = 'code' | 'date'
export type EntrySort = { field: EntrySortField; descending: boolean }
export const DEFAULT_ENTRY_SORT: EntrySort = { field: 'date', descending: true }

/** SCR-23 #11/#12: sort by voucher code or entry date (ties: newest code first), then page client-side. */
export function sortEntryRows(rows: readonly HerdEntry[], sort: EntrySort): HerdEntry[] {
  const direction = sort.descending ? -1 : 1
  const byCode = (a: HerdEntry, b: HerdEntry) => a.id.localeCompare(b.id, 'vi', { numeric: true })
  return [...rows].sort((a, b) => sort.field === 'code'
    ? byCode(a, b) * direction
    : ((a.date ?? '').localeCompare(b.date ?? '') * direction) || -byCode(a, b))
}

export function entryPage<T>(rows: readonly T[], page: number, size = ENTRY_PAGE_SIZE) {
  const pageCount = Math.max(1, Math.ceil(rows.length / size))
  const current = Math.min(Math.max(1, page), pageCount)
  const start = (current - 1) * size
  return { rows: rows.slice(start, start + size), page: current, pageCount, first: rows.length ? start + 1 : 0, last: Math.min(start + size, rows.length), total: rows.length }
}
