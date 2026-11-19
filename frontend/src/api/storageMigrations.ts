import { seedPens } from '../data/pensData'

const PREFIX = 'beefcare:'
const PEN_MIGRATION = `${PREFIX}migration:pens-v2`

type LegacyRow = Record<string, unknown>

const parseRows = (storage: Storage, key: string): LegacyRow[] | null => {
  const raw = storage.getItem(key)
  if (!raw) return null
  const rows: unknown = JSON.parse(raw)
  return Array.isArray(rows) ? rows : null
}

// Consolidate the former cattle-owned `barns` table into the canonical `pens`
// table once. User edits are retained; canonical sample links replace broken
// seed links. Later business mutations are not overwritten because of marker.
export function migrateHerdStorage(storage: Storage = localStorage) {
  if (storage.getItem(PEN_MIGRATION) === 'done') return false

  const savedPens = parseRows(storage, `${PREFIX}pens`)
  const legacyBarns = parseRows(storage, `${PREFIX}barns`)
  const source = savedPens ?? legacyBarns

  if (source) {
    const savedByCode = new Map(source.map((row) => [String(row.code), row]))
    const migrated = seedPens.map((seed) => {
      const saved = savedByCode.get(seed.code)
      savedByCode.delete(seed.code)
      return saved ? { ...seed, ...saved, cows: seed.cows } : seed
    })
    storage.setItem(`${PREFIX}pens`, JSON.stringify([...migrated, ...savedByCode.values()]))
  }

  storage.removeItem(`${PREFIX}barns`)
  storage.setItem(PEN_MIGRATION, 'done')
  return Boolean(source || legacyBarns)
}
