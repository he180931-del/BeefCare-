import { backendFarmId, backendMode, backendTransport, type BackendMode, type BackendTransport } from '../../../api/backendTransport'
import { backendPending } from '../../../api/backendPending'
import { healthDemoStore, type HealthDemoStore } from '../data/healthDemoStore'
import { toLocalDateTime } from '../domain/healthFormat'
import type { CorrectEntryCommand, FollowUpCommand, HealthCaseFilters, OpenCaseCommand, StatusCommand, TreatmentCommand, VoidEntryCommand } from '../types'

export function createHealthApi({ mode, farmId, transport, store }: { mode: BackendMode; farmId: string | number; transport: BackendTransport; store: HealthDemoStore }) {
  // Kept for the later backend hookup; backend mode must never read the mock.
  void farmId
  void transport
  const requireLocal = () => { if (mode === 'backend') throw backendPending('dữ liệu sức khỏe và điều trị') }
  return {
    // GET /api/farms/{farmId}/health-cases ?tab,search,severity,penId,from,to (số đếm theo tab: gọi lần lượt từng tab)
    async listCases(filters: HealthCaseFilters = {}) { requireLocal(); return store.listCases(filters) },
    // GET /api/farms/{farmId}/health-cases/cattle/{cattleId}
    async getProfile(cattleCode: string) { requireLocal(); return store.getProfile(cattleCode) },
    // POST /api/farms/{farmId}/health-cases (existingCaseId + expectedVersion khi nối vào ca đang có)
    async openCase(cattleCode: string, command: OpenCaseCommand) { requireLocal(); return store.openCase(cattleCode, command) },
    // POST /api/farms/{farmId}/health-cases/{caseId}/observations
    async recordFollowUp(caseId: number, command: FollowUpCommand) { requireLocal(); return store.recordFollowUp(caseId, command) },
    // POST /api/farms/{farmId}/health-cases/{caseId}/treatments
    async recordTreatment(caseId: number, command: TreatmentCommand) { requireLocal(); return store.recordTreatment(caseId, command) },
    // POST /api/farms/{farmId}/health-cases/{caseId}/status (đóng Chết / Mất tích tạo phiếu xuất chờ phía backend)
    async updateStatus(caseId: number, command: StatusCommand) { requireLocal(); return store.updateStatus(caseId, command) },
    // POST /api/farms/{farmId}/treatments/{treatmentId}/correction hoặc /health-observations/{observationId}/correction (theo loại bản ghi)
    async correctEntry(entryId: number, command: CorrectEntryCommand) { requireLocal(); return store.correctEntry(entryId, command) },
    // POST /api/farms/{farmId}/treatments/{treatmentId}/void hoặc /health-observations/{observationId}/void (theo loại bản ghi)
    async voidEntry(entryId: number, command: VoidEntryCommand) { requireLocal(); return store.voidEntry(entryId, command) },
    // chưa có API: danh mục thuốc của trại (FE-18), danh sách thành viên và gợi ý chẩn đoán từ các ca trước
    async formOptions() { requireLocal(); return store.formOptions() },
    // chưa có API: phiếu xuất "Chết / mất" chờ Chủ trại do backend tạo; herd-exit đọc từ danh sách phiếu xuất
    async listPendingExits() { requireLocal(); return store.listPendingExits() },
    /** Thời điểm hiện tại cho giá trị mặc định của ô ngày giờ; dữ liệu mẫu dùng mốc 20/10/2026 như các frame. */
    now: () => (mode === 'backend' ? toLocalDateTime(new Date()) : store.now()),
  }
}

export type HealthApi = ReturnType<typeof createHealthApi>
export const healthApi = createHealthApi({ mode: backendMode, farmId: backendFarmId, transport: backendTransport, store: healthDemoStore })
