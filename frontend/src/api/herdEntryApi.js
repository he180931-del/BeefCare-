import { createCollection } from './client'
import { initialImports } from '../data/importsData'

// Phiếu nhập đàn: dữ liệu mẫu lấy từ importsData, lưu tạm trong localStorage qua lớp API giả lập.
const herdEntries = createCollection('herdEntries', initialImports)

export const herdEntryApi = {
  list: () => herdEntries.list(),
  get: (id) => herdEntries.get(id),
  update: (id, patch) => herdEntries.update(id, patch),
  reset: () => herdEntries.reset(),
}
