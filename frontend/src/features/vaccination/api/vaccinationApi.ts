import { backendFarmId, backendMode, backendTransport, type BackendMode, type BackendTransport } from '../../../api/backendTransport'
import { backendPending } from '../../../api/backendPending'
import { vaccinationDemoStore, type VaccinationDemoStore } from '../data/vaccinationDemoStore'
import type { CorrectVaccinationCommand, DeferDoseCommand, DoseFilters, HistoryFilters, RecordVaccinationsCommand, ScheduleCommand, ScheduleTarget, VoidRecordCommand } from '../types'

export function createVaccinationApi({ mode, farmId, transport, store }: { mode: BackendMode; farmId: string | number; transport: BackendTransport; store: VaccinationDemoStore }) {
  // Giữ lại cho bước nối backend; chế độ backend không bao giờ đọc mock.
  void farmId
  void transport
  const requireLocal = () => {
    if (mode === 'backend') throw backendPending('dữ liệu tiêm phòng')
  }
  return {
    // chưa có API: danh mục vắc-xin, thành viên, chuồng, nhóm đàn và giờ trại
    async options() { requireLocal(); return store.options() },
    // GET /api/farms/{farmId}/vaccination-schedules
    async listSchedules() { requireLocal(); return store.listSchedules() },
    // chưa có API: danh sách mũi cấp đàn theo tab trạng thái (ghép từ vaccination-schedules)
    async listDoses(filters: DoseFilters = {}) { requireLocal(); return store.listDoses(filters) },
    // GET /api/farms/{farmId}/vaccination-schedules (một mũi trong danh sách)
    async getDose(id: number) { requireLocal(); return store.getDose(id) },
    // GET /api/farms/{farmId}/vaccination-schedules (một lịch)
    async getSchedule(id: number) { requireLocal(); return store.getSchedule(id) },
    // chưa có API: xem trước danh sách bò khớp điều kiện lịch
    async previewTarget(target: ScheduleTarget) { requireLocal(); return store.previewTarget(target) },
    // chưa có API: bảng "Các mũi theo lịch" khi lịch chưa lưu
    async previewPlan(cmd: ScheduleCommand, targetCount: number) { requireLocal(); return store.previewPlan(cmd, targetCount) },
    // POST /api/farms/{farmId}/vaccination-schedules
    async createSchedule(cmd: ScheduleCommand) { requireLocal(); return store.createSchedule(cmd) },
    // PUT /api/farms/{farmId}/vaccination-schedules/{scheduleId}
    async updateSchedule(id: number, cmd: ScheduleCommand) { requireLocal(); return store.updateSchedule(id, cmd) },
    // POST /api/farms/{farmId}/vaccination-schedules/{scheduleId}/stop
    async stopSchedule(id: number, cmd: { reason: string; expectedVersion: number }) { requireLocal(); return store.stopSchedule(id, cmd) },
    // chưa có API: ngữ cảnh màn Ghi nhận tiêm (bò, mũi, danh mục)
    async recordContext(input: { doseIds?: number[]; cattleCodes?: string[] }) { requireLocal(); return store.recordContext(input) },
    // POST /api/farms/{farmId}/vaccinations
    async recordVaccinations(cmd: RecordVaccinationsCommand) { requireLocal(); return store.recordVaccinations(cmd) },
    // POST /api/farms/{farmId}/scheduled-doses/{doseId}/defer
    async deferDose(id: number, cmd: DeferDoseCommand) { requireLocal(); return store.deferDose(id, cmd) },
    // GET /api/farms/{farmId}/vaccinations/history
    async listHistory(filters: HistoryFilters = {}) { requireLocal(); return store.listHistory(filters) },
    // GET /api/farms/{farmId}/vaccinations/history?cattleId= (kèm các mũi chưa tiêm của bò)
    async getCattleVaccination(code: string) { requireLocal(); return store.getCattleVaccination(code) },
    // POST /api/farms/{farmId}/vaccinations/{vaccinationId}/correction
    async correctRecord(id: number, cmd: CorrectVaccinationCommand) { requireLocal(); return store.correctRecord(id, cmd) },
    // POST /api/farms/{farmId}/vaccinations/{vaccinationId}/void
    async voidRecord(id: number, cmd: VoidRecordCommand) { requireLocal(); return store.voidRecord(id, cmd) },
  }
}
export const vaccinationApi = createVaccinationApi({ mode: backendMode, farmId: backendFarmId, transport: backendTransport, store: vaccinationDemoStore })
