import { backendFarmId } from '../../../api/backendTransport'
import { backendMode, type BackendMode } from '../../../shared/config/runtime'
import { backendTransport, type BackendTransport } from '../../../shared/api/backendTransport'
import { growthDemoStore, type GrowthDemoStore } from '../data/growthDemoStore'
import type { CorrectGrowthCommand, GrowthFilters, RecordGrowthCommand } from '../types'
import { createGrowthBackend } from './growthBackend'

/** Chế độ backend chỉ gọi API (không bao giờ đọc mock); chế độ local dùng kho demo. */
export function createGrowthApi({ mode, farmId, transport, store, clock }: { mode: BackendMode; farmId: string | number; transport: BackendTransport; store: GrowthDemoStore; clock?: () => Date }) {
  if (mode === 'backend') return createGrowthBackend({ farmId, transport, clock })
  return {
    async listHerd(filters: GrowthFilters = {}) {
      return store.listHerd(filters)
    },
    async filterOptions() {
      return store.filterOptions()
    },
    async getProfile(code: string) {
      return store.getProfile(code)
    },
    async formOptions(code: string) {
      return store.formOptions(code)
    },
    async record(code: string, command: RecordGrowthCommand) {
      return store.record(code, command)
    },
    async correct(code: string, recordId: number, command: CorrectGrowthCommand) {
      return store.correct(code, recordId, command)
    },
  }
}
export const growthApi = createGrowthApi({ mode: backendMode, farmId: backendFarmId, transport: backendTransport, store: growthDemoStore })
