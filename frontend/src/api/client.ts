// Local collection adapter. The registry stores erased rows; createCollection is
// the single typed boundary used by feature APIs.
const PREFIX = 'beefcare:'
export type CollectionRow = Record<string, unknown>
export type CollectionApi<T extends CollectionRow> = {
  list: (predicate?: (row: T) => boolean) => Promise<T[]>
  get: (id: unknown) => Promise<T>
  create: (data: Partial<T>) => Promise<T>
  upsert: (data: Partial<T>) => Promise<T>
  update: (id: unknown, patch: Partial<T>) => Promise<T>
  remove: (id: unknown) => Promise<{ id: unknown }>
  reset: () => Promise<T[]>
}
type ErasedApi = CollectionApi<CollectionRow>
type ErasedState = { idKey: string; api: ErasedApi; facade: CollectionApi<CollectionRow>; mergeSeed: (seed: CollectionRow[]) => void }
const collections = new Map<string, ErasedState>()
const latency = (): number => { try { const value = localStorage.getItem(`${PREFIX}latency`); return value === null ? 250 : Number(value) } catch { return 250 } }
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
// JSON persistence erases the concrete row type. This is the one boundary at
// which the schema supplied to createCollection is restored.
const decode = <T extends CollectionRow>(value: CollectionRow): T => value as T
const load = <T>(name: string, seed: T[]): T[] => {
  try { const raw = localStorage.getItem(`${PREFIX}${name}`); if (raw) return JSON.parse(raw) as T[] } catch { /* memory fallback */ }
  return clone(seed)
}
const save = <T>(name: string, rows: T[]) => localStorage.setItem(`${PREFIX}${name}`, JSON.stringify(rows))
const mergeRows = <T extends CollectionRow>(current: T[], seed: T[], idKey: string): T[] => {
  const existing = new Map(current.map((row) => [String(row[idKey]), row]))
  const seeded = seed.map((row) => { const saved = existing.get(String(row[idKey])); if (!saved) return clone(row); existing.delete(String(row[idKey])); return { ...clone(row), ...saved } })
  return [...seeded, ...existing.values()]
}

export function createCollection<T extends CollectionRow, K extends keyof T & string>(
  name: string, seed: T[], { idKey = 'id' as K, nextId }: { idKey?: K; nextId?: (rows: T[]) => T[K] } = {},
): CollectionApi<T> {
  const existing = collections.get(name)
  if (existing) { if (existing.idKey !== idKey) throw new Error(`Collection ${name} already uses idKey ${existing.idKey}`); existing.mergeSeed(seed); return existing.facade as unknown as CollectionApi<T> }
  let rows = load(name, seed)
  const persist = (nextRows: T[]) => { save(name, nextRows); rows = nextRows }
  const run = async <R>(fn: () => R): Promise<R> => { await sleep(latency()); return clone(fn()) }
  const typed: CollectionApi<T> = {
    list: (predicate) => run(() => predicate ? rows.filter(predicate) : rows),
    get: (id) => run(() => { const row = rows.find((item) => String(item[idKey]) === String(id)); if (!row) throw new Error(`Not found: ${name}/${id}`); return row }),
    create: (data) => run(() => { const row = { ...data, [idKey]: data[idKey] ?? (nextId ? nextId(rows) : String(Date.now())) } as T; if (rows.some((item) => String(item[idKey]) === String(row[idKey]))) throw new Error(`Already exists: ${name}/${row[idKey]}`); persist([row, ...rows]); return row }),
    upsert: (data) => run(() => { if (data[idKey] == null) throw new Error(`Missing ${idKey}: ${name}`); const index = rows.findIndex((item) => String(item[idKey]) === String(data[idKey])); const row = index < 0 ? { ...data } as T : { ...rows[index], ...data }; persist(index < 0 ? [row, ...rows] : rows.map((item, i) => i === index ? row : item)); return row }),
    update: (id, patch) => run(() => { let updated: T | undefined; const nextRows = rows.map((row) => String(row[idKey]) === String(id) ? (updated = { ...row, ...patch }) : row); if (!updated) throw new Error(`Not found: ${name}/${id}`); persist(nextRows); return updated }),
    remove: (id) => run(() => { persist(rows.filter((row) => String(row[idKey]) !== String(id))); return { id } }),
    reset: () => run(() => { persist(clone(seed)); return rows }),
  }
  const facade = typed as unknown as CollectionApi<CollectionRow>
  const erased: ErasedState = { idKey, api: facade, facade, mergeSeed: (nextSeed) => { const merged = mergeRows(rows, nextSeed as T[], idKey); if (JSON.stringify(merged) !== JSON.stringify(rows)) persist(merged) } }
  collections.set(name, erased)
  return typed
}
function typedApi<T extends CollectionRow>(api: ErasedApi): CollectionApi<T> {
  return { list: (predicate) => api.list(predicate ? (row) => predicate(decode<T>(row)) : undefined).then((rows) => rows.map(decode<T>)), get: (id) => api.get(id).then(decode<T>), create: (data) => api.create(data).then(decode<T>), upsert: (data) => api.upsert(data).then(decode<T>), update: (id, patch) => api.update(id, patch).then(decode<T>), remove: api.remove, reset: () => api.reset().then((rows) => rows.map(decode<T>)) }
}
