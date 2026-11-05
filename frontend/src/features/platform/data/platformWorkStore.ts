import { expandLocalTable, isStressGenerated, stripStressRows, type StressGeneratedRow } from '../../../app/localStressData'
import type { PlatformWorkRow } from './platformFixtures'

const STORAGE_KEY = 'beefcare-platform-work-preview.v1'

export type PreviewPlatformWorkRow = PlatformWorkRow & StressGeneratedRow

type PlatformWorkStore = Record<string, PlatformWorkRow[]>

function readStore(): PlatformWorkStore {
  if (typeof window === 'undefined') return {}
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}') as unknown
    return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored as PlatformWorkStore : {}
  } catch {
    return {}
  }
}

function writeStore(next: PlatformWorkStore) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Local preview must still be usable if browser storage is unavailable.
  }
}

/** Only rows added by the reviewer are stored; density-preview rows stay ephemeral. */
export function loadPlatformWorkRows(scope: string, fallback: PlatformWorkRow[]): PreviewPlatformWorkRow[] {
  const stored = readStore()[scope]
  const rows = Array.isArray(stored) && stored.length ? stored : fallback
  return expandLocalTable(`platform-work-${scope}`, rows)
}

export function savePlatformWorkRows(scope: string, rows: PreviewPlatformWorkRow[]) {
  const current = readStore()
  writeStore({ ...current, [scope]: stripStressRows(rows) })
}

export function createPlatformWorkRow(scope: string, fallback: PlatformWorkRow[], draft: Omit<PlatformWorkRow, 'code' | 'updatedAt'>): PlatformWorkRow {
  const current = readStore()
  const existing = Array.isArray(current[scope]) && current[scope].length ? current[scope] : fallback
  const sequence = String(existing.length + 1).padStart(3, '0')
  const code = `${scope.replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase()}-${sequence}`
  const row: PlatformWorkRow = { ...draft, code, updatedAt: new Date().toLocaleString('vi-VN') }
  writeStore({ ...current, [scope]: [...existing, row] })
  return row
}

export function isPreviewPlatformWorkRow(row: PreviewPlatformWorkRow) {
  return isStressGenerated(row)
}
