import { createCollection } from './client.js'
import { initialImports } from '../data/importsData.js'
import { voidEntryCattle } from './herdDomainApi.js'

// Phiếu nhập đàn: mã tiếp theo lấy từ dữ liệu đã lưu, không phụ thuộc mã mẫu cố định trên form.
const nextEntryId = (rows) => `PN-2026-${String(Math.max(0, ...rows.map((row) => Number(row.id?.split('-')[2]) || 0)) + 1).padStart(4, '0')}`
const herdEntries = createCollection('herdEntries', initialImports, { nextId: nextEntryId })

export const herdEntryApi = {
  list: () => herdEntries.list(),
  get: (id) => herdEntries.get(id),
  create: (record) => herdEntries.create(record),
  update: (id, patch) => herdEntries.update(id, patch),
  reset: () => herdEntries.reset(),
}

export async function voidHerdEntry(id, cattleRows, patch) {
  await voidEntryCattle(cattleRows, id)
  return herdEntries.update(id, patch)
}
