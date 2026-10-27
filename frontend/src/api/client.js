// Lớp API giả lập: mỗi collection là một "bảng" lưu trong localStorage, trả dữ liệu qua Promise
// có độ trễ như gọi server thật. Khi có backend Spring Boot, chỉ cần thay thân các hàm của
// collection bằng fetch('/api/...') — các trang không phải sửa.
const PREFIX = 'beefcare:'

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
  try {
    localStorage.setItem(`${PREFIX}${name}`, JSON.stringify(rows))
  } catch {
    /* bỏ qua */
  }
}

/**
 * createCollection('herdEntries', seedRows, { idKey: 'id', nextId?: (rows) => string })
 * → { list, get, create, update, remove, reset } (tất cả trả Promise).
 * Dữ liệu seed nằm trong src/data/*; muốn thêm dữ liệu mẫu thì thêm vào seed rồi gọi reset()
 * hoặc xoá key `beefcare:<name>` trong localStorage.
 */
export function createCollection(name, seed, { idKey = 'id', nextId } = {}) {
  let rows = load(name, seed)
  const persist = () => save(name, rows)
  const run = async (fn) => {
    await sleep(latency())
    return clone(fn())
  }
  return {
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
        rows = [row, ...rows]
        persist()
        return row
      }),
    update: (id, patch) =>
      run(() => {
        let updated
        rows = rows.map((r) => (String(r[idKey]) === String(id) ? (updated = { ...r, ...patch }) : r))
        if (!updated) throw new Error(`Not found: ${name}/${id}`)
        persist()
        return updated
      }),
    remove: (id) =>
      run(() => {
        rows = rows.filter((r) => String(r[idKey]) !== String(id))
        persist()
        return { id }
      }),
    reset: () =>
      run(() => {
        rows = clone(seed)
        persist()
        return rows
      }),
  }
}
