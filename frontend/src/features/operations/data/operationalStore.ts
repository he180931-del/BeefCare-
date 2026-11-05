import { expandLocalTable, isStressGenerated, stripStressRows, type StressGeneratedRow } from '../../../app/localStressData'
import type { OperationalRow } from './operationalFixtures'

const STORAGE_KEY = 'beefcare-operational-preview.v1'

export type PreviewOperationalRow = OperationalRow & StressGeneratedRow

type OperationalStore = Record<string, OperationalRow[]>

function readStore(): OperationalStore {
  if (typeof window === 'undefined') return {}
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}') as unknown
    return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored as OperationalStore : {}
  } catch {
    return {}
  }
}

function writeStore(next: OperationalStore) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

/**
 * Bảng vận hành cục bộ: chỉ các hàng nghiệp vụ thật được lưu. Hàng được sinh
 * thêm để thử mật độ bảng luôn mang cờ __stressGenerated và không bao giờ ghi
 * ngược vào localStorage, nhờ vậy có thể thay bằng API mà không dọn dữ liệu.
 */
export function loadOperationalRows(feature: string, fallback: OperationalRow[]): PreviewOperationalRow[] {
  const stored = readStore()[feature]
  const rows = Array.isArray(stored) && stored.length ? stored : fallback
  return expandLocalTable(`operations-${feature}`, rows)
}

export function saveOperationalRows(feature: string, rows: PreviewOperationalRow[]) {
  const current = readStore()
  writeStore({ ...current, [feature]: stripStressRows(rows) })
}

export function createOperationalRow(feature: string, fallback: OperationalRow[], draft: Omit<OperationalRow, 'code'>): OperationalRow {
  const current = readStore()
  const existing = Array.isArray(current[feature]) && current[feature].length ? current[feature] : fallback
  const number = existing.length + 1
  const code = `${feature.slice(0, 2).toUpperCase()}-${String(number).padStart(3, '0')}`
  const row = { code, ...draft }
  writeStore({ ...current, [feature]: [...existing, row] })
  return row
}

export function isPreviewOperationalRow(row: PreviewOperationalRow) {
  return isStressGenerated(row)
}
