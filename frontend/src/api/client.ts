// Local collection adapter. Persistence is deliberately treated as an
// untrusted JSON boundary: every row is validated by the schema supplied by
// the caller before it enters the in-memory collection.
const PREFIX = 'beefcare:'

export type CollectionRow = Record<string, unknown>
export type NewCollectionInput<T extends CollectionRow, K extends keyof T & string> = Omit<T, K> & Partial<Pick<T, K>>
export type CollectionSchema<T extends CollectionRow, K extends keyof T & string> = {
  idKey: K
  identity: string
  parse: (value: unknown) => T
  facades: Map<string, CollectionApi<T, K>>
}
export type CollectionApi<T extends CollectionRow, K extends keyof T & string> = {
  list: (predicate?: (row: T) => boolean) => Promise<T[]>
  get: (id: unknown) => Promise<T>
  create: (data: NewCollectionInput<T, K>) => Promise<T>
  upsert: (data: T) => Promise<T>
  update: (id: unknown, patch: Partial<T>) => Promise<T>
  remove: (id: unknown) => Promise<{ id: unknown }>
  reset: () => Promise<T[]>
}

type StoredSchema = { idKey: string; identity: string; contract: object; parse: (value: unknown) => CollectionRow }
type CollectionState = { schema: StoredSchema; mergeSeed: (nextSeed: CollectionRow[]) => void }
const collections = new Map<string, CollectionState>()

const latency = (): number => {
  try {
    const value = localStorage.getItem(`${PREFIX}latency`)
    return value === null ? 250 : Number(value)
  } catch { return 250 }
}
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const cloneJson = (value: unknown): unknown => JSON.parse(JSON.stringify(value))
const cloneRow = (row: CollectionRow): CollectionRow => {
  const cloned = cloneJson(row)
  if (typeof cloned !== 'object' || cloned === null || Array.isArray(cloned)) throw new Error('Collection row is not JSON object data')
  return Object.fromEntries(Object.entries(cloned))
}
const save = (name: string, rows: CollectionRow[]): void => { localStorage.setItem(`${PREFIX}${name}`, JSON.stringify(rows)) }

const schemaForStorage = <T extends CollectionRow, K extends keyof T & string>(schema: CollectionSchema<T, K>): StoredSchema => ({
  idKey: schema.idKey, identity: schema.identity, contract: schema, parse: schema.parse,
})

const validateRows = (value: unknown, schema: StoredSchema): CollectionRow[] | null => {
  if (!Array.isArray(value)) return null
  try { return value.map((row) => schema.parse(row)) } catch { return null }
}

const load = <T extends CollectionRow>(name: string, seed: T[], schema: StoredSchema): CollectionRow[] => {
  try {
    const raw = localStorage.getItem(`${PREFIX}${name}`)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      const rows = validateRows(parsed, schema)
      if (rows) return rows
      try { localStorage.removeItem(`${PREFIX}${name}`) } catch { /* memory fallback */ }
    }
  } catch { /* memory fallback */ }
  const fallback = seed.map((row) => schema.parse(row))
  try { save(name, fallback) } catch { /* memory fallback */ }
  return fallback
}

const mergeRows = (current: CollectionRow[], seed: CollectionRow[], idKey: string): CollectionRow[] => {
  const existing = new Map(current.map((row) => [String(row[idKey]), row]))
  const seeded = seed.map((row) => {
    const saved = existing.get(String(row[idKey]))
    if (!saved) return cloneRow(row)
    existing.delete(String(row[idKey]))
    return { ...cloneRow(row), ...saved }
  })
  return [...seeded, ...existing.values()]
}

const recordWithId = <T extends CollectionRow, K extends keyof T & string>(data: NewCollectionInput<T, K>, idKey: K, id: T[K]): CollectionRow => ({ ...data, [idKey]: id })
const schemaMismatch = (name: string, expected: StoredSchema, actual: StoredSchema): Error => new Error(`Collection ${name} schema contract mismatch: expected ${expected.identity}/${expected.idKey}, received ${actual.identity}/${actual.idKey}`)

export function createCollectionSchema<T extends CollectionRow, K extends keyof T & string>(identity: string, idKey: K, parse: (value: unknown) => T): CollectionSchema<T, K> {
  return { identity, idKey, parse, facades: new Map() }
}

export function createCollection<T extends CollectionRow, K extends keyof T & string>(
  name: string,
  seed: T[],
  { schema, nextId }: { schema: CollectionSchema<T, K>; nextId?: (rows: T[]) => T[K] },
): CollectionApi<T, K> {
  const storedSchema = schemaForStorage(schema)
  const existing = collections.get(name)
  if (existing) {
    if (existing.schema.contract !== schema) throw schemaMismatch(name, existing.schema, storedSchema)
    existing.mergeSeed(seed.map((row) => schema.parse(row)))
    const facade = schema.facades.get(name)
    if (!facade) throw new Error(`Collection ${name} schema contract has no facade`)
    return facade
  }

  let rows = load(name, seed, storedSchema)
  const validatedSeed = seed.map((row) => schema.parse(row))
  const persist = (nextRows: CollectionRow[]): void => { save(name, nextRows); rows = nextRows }
  const run = async <R>(fn: () => unknown, parse: (value: unknown) => R): Promise<R> => { await sleep(latency()); return parse(cloneJson(fn())) }
  const parseRow = (value: unknown): T => schema.parse(value)
  const readRows = (): T[] => rows.map(parseRow)
  const typed: CollectionApi<T, K> = {
    list: (predicate) => run(() => { const result = readRows(); return predicate ? result.filter(predicate) : result }, (value) => {
      if (!Array.isArray(value)) throw new Error(`Invalid collection result: ${name}`)
      return value.map(parseRow)
    }),
    get: (id) => run(() => { const row = rows.find((item) => String(item[schema.idKey]) === String(id)); if (!row) throw new Error(`Not found: ${name}/${id}`); return row }, parseRow),
    create: (data) => run(() => {
      const typedRows = readRows()
      const id: T[K] = data[schema.idKey] !== undefined
        ? data[schema.idKey] as T[K]
        : nextId ? nextId(typedRows) : String(Date.now()) as T[K]
      const row = parseRow(recordWithId(data, schema.idKey, id))
      if (rows.some((item) => String(item[schema.idKey]) === String(row[schema.idKey]))) throw new Error(`Already exists: ${name}/${row[schema.idKey]}`)
      persist([row, ...rows])
      return row
    }, parseRow),
    upsert: (data) => run(() => {
      const row = parseRow(data)
      const id = row[schema.idKey]
      if (id == null) throw new Error(`Missing ${schema.idKey}: ${name}`)
      const index = rows.findIndex((item) => String(item[schema.idKey]) === String(id))
      const merged = index < 0 ? row : parseRow({ ...rows[index], ...row })
      persist(index < 0 ? [merged, ...rows] : rows.map((item, i) => i === index ? merged : item))
      return merged
    }, parseRow),
    update: (id, patch) => run(() => {
      let updated: CollectionRow | undefined
      const nextRows = rows.map((row) => {
        if (String(row[schema.idKey]) !== String(id)) return row
        updated = parseRow({ ...row, ...patch })
        return updated
      })
      if (!updated) throw new Error(`Not found: ${name}/${id}`)
      persist(nextRows)
      return updated
    }, parseRow),
    remove: async (id) => { await sleep(latency()); persist(rows.filter((row) => String(row[schema.idKey]) !== String(id))); return { id } },
    reset: () => run(() => { const resetRows = validatedSeed.map(cloneRow); persist(resetRows); return resetRows }, (value) => {
      if (!Array.isArray(value)) throw new Error(`Invalid collection result: ${name}`)
      return value.map(parseRow)
    }),
  }

  schema.facades.set(name, typed)
  const state: CollectionState = {
    schema: storedSchema,
    mergeSeed: (nextSeed) => {
      const merged = mergeRows(rows, nextSeed, schema.idKey)
      const validated = merged.map(schema.parse)
      if (JSON.stringify(validated) !== JSON.stringify(rows)) persist(validated)
    },
  }
  collections.set(name, state)
  return typed
}
