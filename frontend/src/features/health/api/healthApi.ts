import { backendFarmId, backendMode, backendTransport, type BackendMode, type BackendTransport } from '../../../api/backendTransport'
import { healthDemoStore, type HealthDemoStore } from '../data/healthDemoStore'
import type { CorrectEntryCommand, FollowUpCommand, HealthCaseFilters, OpenCaseCommand, StatusCommand, TreatmentCommand, VoidEntryCommand } from '../types'
import { createHealthBackend, type HealthBackend } from './healthBackend'

export type HealthApi = HealthBackend

/** Chế độ backend chỉ gọi API (không bao giờ đọc mock, không fallback); chế độ local dùng kho demo. */
export function createHealthApi({ mode, farmId, transport, store, clock }: { mode: BackendMode; farmId: string | number; transport: BackendTransport; store: HealthDemoStore; clock?: () => Date }): HealthApi {
  if (mode === 'backend') return createHealthBackend({ farmId, transport, clock })
  return {
    async listCases(filters: HealthCaseFilters = {}) { return store.listCases(filters) },
    async getProfile(cattleCode: string) { return store.getProfile(cattleCode) },
    async openCase(cattleCode: string, command: OpenCaseCommand) { return store.openCase(cattleCode, command) },
    async recordFollowUp(caseId: number, command: FollowUpCommand) { return store.recordFollowUp(caseId, command) },
    async recordTreatment(caseId: number, command: TreatmentCommand) { return store.recordTreatment(caseId, command) },
    async updateStatus(caseId: number, command: StatusCommand) { return store.updateStatus(caseId, command) },
    async correctEntry(entryId: number, command: CorrectEntryCommand) { return store.correctEntry(entryId, command) },
    async voidEntry(entryId: number, command: VoidEntryCommand) { return store.voidEntry(entryId, command) },
    async formOptions() { return store.formOptions() },
    async listPendingExits() { return store.listPendingExits() },
    /** Thời điểm hiện tại cho giá trị mặc định của ô ngày giờ; dữ liệu mẫu dùng mốc 20/10/2026 như các frame. */
    now: () => store.now(),
  }
}

export const healthApi = createHealthApi({ mode: backendMode, farmId: backendFarmId, transport: backendTransport, store: healthDemoStore })
