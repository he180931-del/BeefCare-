import { backendFarmId, backendMode, backendTransport, type BackendMode, type BackendTransport } from '../../../api/backendTransport'
import { backendPending } from '../../../api/backendPending'
import { growthDemoStore, type GrowthDemoStore } from '../data/growthDemoStore'
import type { CorrectGrowthCommand, GrowthFilters, RecordGrowthCommand } from '../types'

export function createGrowthApi({ mode, farmId, transport, store }: { mode: BackendMode; farmId: string | number; transport: BackendTransport; store: GrowthDemoStore }) {
  // Giữ lại cho bước nối backend; chế độ backend không bao giờ đọc mock.
  void farmId
  void transport
  const requireLocal = () => {
    if (mode === 'backend') throw backendPending('dữ liệu tăng trưởng')
  }
  return {
    // GET /api/farms/{farmId}/growth
    async listHerd(filters: GrowthFilters = {}) {
      requireLocal()
      return store.listHerd(filters)
    },
    // chưa có API: danh mục chuồng, nhóm đàn, giai đoạn cho bộ lọc
    async filterOptions() {
      requireLocal()
      return store.filterOptions()
    },
    // GET /api/farms/{farmId}/cattle/{cattleId}/growth
    async getProfile(code: string) {
      requireLocal()
      return store.getProfile(code)
    },
    // chưa có API: thông tin bò, danh sách người đo và giờ trại cho hộp thoại ghi nhận
    async formOptions(code: string) {
      requireLocal()
      return store.formOptions(code)
    },
    // POST /api/farms/{farmId}/cattle/{cattleId}/growth
    async record(code: string, command: RecordGrowthCommand) {
      requireLocal()
      return store.record(code, command)
    },
    // POST /api/farms/{farmId}/cattle/{cattleId}/growth/{id}/correction
    async correct(code: string, recordId: number, command: CorrectGrowthCommand) {
      requireLocal()
      return store.correct(code, recordId, command)
    },
  }
}
export const growthApi = createGrowthApi({ mode: backendMode, farmId: backendFarmId, transport: backendTransport, store: growthDemoStore })
