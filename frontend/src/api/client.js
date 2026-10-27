// Lớp API giả lập: mỗi collection là một "bảng" lưu trong localStorage, trả dữ liệu qua Promise
// có độ trễ như gọi server thật. Khi có backend Spring Boot, chỉ cần thay thân các hàm của
// collection bằng fetch('/api/...') — các trang không phải sửa.
const PREFIX = 'beefcare:'
const collections = new Map()

const latency = () => {
  try {
    const v = localStorage.getItem(`${PREFIX}latency`)
    return v === null ? 250 : Number(v)
  } catch {
    return 250
  }
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const clone = (value) => JSON.parse(JSON.stringify(value))

const load = (name, seed) => {
  try {
    const raw = localStorage.getItem(`${PREFIX}${name}`)
    if (raw) return JSON.parse(raw)
  } catch {
    /* localStorage không dùng được: dùng bộ nhớ */
  }
  return clone(seed)
}
const save = (name, rows) => {
  localStorage.setItem(`${PREFIX}${name}`, JSON.stringify(rows))
}

const mergeRows = (current, seed, idKey) => {
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
export function createCollection(name, seed, { idKey = 'id', nextId } = {}) {
  const existingCollection = collections.get(name)
  if (existingCollection) {
    if (existingCollection.idKey !== idKey) throw new Error(`Collection ${name} already uses idKey ${existingCollection.idKey}`)
    existingCollection.mergeSeed(seed)
    return existingCollection.api
  }

  let rows = load(name, seed)
  const persist = (nextRows) => {
    save(name, nextRows)
    rows = nextRows
  }
  const run = async (fn) => {
    await sleep(latency())
    return clone(fn())
  }
  const api = {
    list: (predicate) => run(() => (predicate ? rows.filter(predicate) : rows)),
    get: (id) =>
      run(() => {
        const row = rows.find((r) => String(r[idKey]) === String(id))
        if (!row) throw new Error(`Not found: ${name}/${id}`)
        return row
      }),
    create: (data) =>
      run(() => {
        const row = { ...data, [idKey]: data[idKey] ?? (nextId ? nextId(rows) : String(Date.now())) }
        if (rows.some((item) => String(item[idKey]) === String(row[idKey]))) throw new Error(`Already exists: ${name}/${row[idKey]}`)
        persist([row, ...rows])
        return row
      }),
    upsert: (data) =>
      run(() => {
        if (data[idKey] == null) throw new Error(`Missing ${idKey}: ${name}`)
        const index = rows.findIndex((row) => String(row[idKey]) === String(data[idKey]))
        const row = index < 0 ? data : { ...rows[index], ...data }
        const nextRows = index < 0 ? [row, ...rows] : rows.map((item, i) => (i === index ? row : item))
        persist(nextRows)
        return row
      }),
    update: (id, patch) =>
      run(() => {
        let updated
        const nextRows = rows.map((r) => (String(r[idKey]) === String(id) ? (updated = { ...r, ...patch }) : r))
        if (!updated) throw new Error(`Not found: ${name}/${id}`)
        persist(nextRows)
        return updated
      }),
    remove: (id) =>
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

  const collection = {
    api,
    idKey,
    mergeSeed: (nextSeed) => {
      const merged = mergeRows(rows, nextSeed, idKey)
      if (JSON.stringify(merged) !== JSON.stringify(rows)) persist(merged)
    },
  }
  collections.set(name, collection)
  return api
}
