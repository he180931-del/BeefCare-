import { rationRows } from './technicianFixtures'

const STORAGE_KEY = 'beefcare-technician-rations.v1'

export type RationRow = typeof rationRows[number]

function readRows(): RationRow[] {
  if (typeof window === 'undefined') return rationRows
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]') as unknown
    return Array.isArray(stored) && stored.length ? stored as RationRow[] : rationRows
  } catch {
    return rationRows
  }
}

function writeRows(rows: RationRow[]) {
  if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
}

/** Dữ liệu khẩu phần tạm thời, tách khỏi component để thay thế API sau này. */
export function loadRations() { return readRows() }

export function markRationCompleted(pen: string) {
  const next = readRows().map((row) => row.pen === pen ? { ...row, status: 'Đã hoàn tất' } : row)
  writeRows(next)
  return next
}
