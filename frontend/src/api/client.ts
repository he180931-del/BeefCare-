// Lớp API giả lập: mỗi collection là một "bảng" lưu trong localStorage, trả dữ liệu qua Promise
// có độ trễ như gọi server thật. Khi có backend Spring Boot, chỉ cần thay thân các hàm của
// collection bằng fetch('/api/...') — các trang không phải sửa.
const PREFIX = 'beefcare:'
type CollectionRow = Record<string, unknown>
type CollectionApi<T extends CollectionRow> = {
  list: (predicate?: (row: T) => boolean) => Promise<T[]>
  get: (id: unknown) => Promise<T>
  create: (data: T) => Promise<T>
  upsert: (data: T) => Promise<T>
  update: (id: unknown, patch: Partial<T>) => Promise<T>
  remove: (id: unknown) => Promise<{ id: unknown }>
  reset: () => Promise<T[]>
}
type CollectionState<T extends CollectionRow> = {
  api: CollectionApi<T>
  idKey: keyof T & string
  mergeSeed: (seed: T[]) => void
}
const collections = new Map<string, CollectionState<CollectionRow>>()

const latency = () => {
  try {
    const v = localStorage.getItem(`${PREFIX}latency`)
    return v === null ? 250 : Number(v)
  } catch {
    return 250
  }
}
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const load = <T>(name: string, seed: T[]): T[] => {
  try {
    const raw = localStorage.getItem(`${PREFIX}${name}`)
    if (raw) return JSON.parse(raw)
  } catch {
    /* localStorage không dùng được: dùng bộ nhớ */
  }
  return clone(seed)
}
const save = <T>(name: string, rows: T[]) => {
  localStorage.setItem(`${PREFIX}${name}`, JSON.stringify(rows))
}

const mergeRows = <T extends CollectionRow>(current: T[], seed: T[], idKey: keyof T & string): T[] => {
  const existing = new Map(current.map((row) => [String(row[idKey]), row]))
  const seeded = seed.map((row) => {
    const saved = existing.get(String(row[idKey]))
    if (!saved) return clone(row)
    existing.delete(String(row[idKey]))
    return { ...clone(row), ...saved }
  })
  return [...seeded, ...existing.values()]
}

/**
 * createCollection('herdEntries', seedRows, { idKey: 'id', nextId?: (rows) => string })
 * → { list, get, create, update, remove, reset } (tất cả trả Promise).
 * Dữ liệu seed nằm trong src/data/*; muốn thêm dữ liệu mẫu thì thêm vào seed rồi gọi reset()
 * hoặc xoá key `beefcare:<name>` trong localStorage.
 */
export function createCollection<T extends CollectionRow, K extends keyof T & string>(
  name: string,
  seed: T[],
  { idKey = 'id' as K, nextId }: { idKey?: K; nextId?: (rows: T[]) => T[K] } = {},
): CollectionApi<T> {
  const existingCollection = collections.get(name)
  if (existingCollection) {
    if (existingCollection.idKey !== idKey) throw new Error(`Collection ${name} already uses idKey ${existingCollection.idKey}`)
    existingCollection.mergeSeed(seed as CollectionRow[])
    return existingCollection.api as CollectionApi<T>
  }

  let rows = load(name, seed)
  const persist = (nextRows: T[]) => {
    save(name, nextRows)
    rows = nextRows
  }
  const run = async <R>(fn: () => R): Promise<R> => {
    await sleep(latency())
    return clone(fn())
  }
  const api = {
    list: (predicate?: (row: T) => boolean) => run(() => (predicate ? rows.filter(predicate) : rows)),
    get: (id: unknown) =>
      run(() => {
        const row = rows.find((r) => String(r[idKey]) === String(id))
        if (!row) throw new Error(`Not found: ${name}/${id}`)
        return row
      }),
    create: (data: T) =>
      run(() => {
        const row = { ...data, [idKey]: data[idKey] ?? (nextId ? nextId(rows) : String(Date.now())) } as T
        if (rows.some((item) => String(item[idKey]) === String(row[idKey]))) throw new Error(`Already exists: ${name}/${row[idKey]}`)
        persist([row, ...rows])
        return row
      }),
    upsert: (data: T) =>
      run(() => {
        if (data[idKey] == null) throw new Error(`Missing ${idKey}: ${name}`)
        const index = rows.findIndex((row) => String(row[idKey]) === String(data[idKey]))
        const row = index < 0 ? data : { ...rows[index], ...data }
        const nextRows = index < 0 ? [row, ...rows] : rows.map((item, i) => (i === index ? row : item))
        persist(nextRows)
        return row
      }),
    update: (id: unknown, patch: Partial<T>) =>
      run(() => {
        let updated
        const nextRows = rows.map((r) => (String(r[idKey]) === String(id) ? (updated = { ...r, ...patch }) : r))
        if (!updated) throw new Error(`Not found: ${name}/${id}`)
        persist(nextRows)
        return updated
      }),
    remove: (id: unknown) =>
      run(() => {
        const nextRows = rows.filter((r) => String(r[idKey]) !== String(id))
        persist(nextRows)
        return { id }
      }),
    reset: () =>
      run(() => {
        persist(clone(seed))
        return rows
      }),
  }

  const collection: CollectionState<T> = {
    api,
    idKey,
    mergeSeed: (nextSeed) => {
      const merged = mergeRows(rows, nextSeed, idKey)
      if (JSON.stringify(merged) !== JSON.stringify(rows)) persist(merged)
    },
  }
  collections.set(name, collection as CollectionState<CollectionRow>)
  return api
}
