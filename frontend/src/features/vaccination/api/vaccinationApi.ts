import { backendFarmId, backendMode, backendTransport, type BackendMode, type BackendTransport } from '../../../api/backendTransport'
import { vaccinationDemoStore, type VaccinationDemoStore } from '../data/vaccinationDemoStore'
import type { CorrectVaccinationCommand, DeferDoseCommand, DoseFilters, HistoryFilters, RecordVaccinationsCommand, ScheduleCommand, ScheduleTarget, VoidRecordCommand } from '../types'
import { createVaccinationBackend } from './vaccinationBackend'

/** Chế độ backend chỉ gọi API (không bao giờ đọc mock); chế độ local dùng kho demo. */
export function createVaccinationApi({ mode, farmId, transport, store, clock }: { mode: BackendMode; farmId: string | number; transport: BackendTransport; store: VaccinationDemoStore; clock?: () => Date }) {
  if (mode === 'backend') return createVaccinationBackend({ farmId, transport, clock })
  return {
    async options() { return store.options() },
    async listSchedules() { return store.listSchedules() },
    async listDoses(filters: DoseFilters = {}) { return store.listDoses(filters) },
    async getDose(id: number) { return store.getDose(id) },
    async getSchedule(id: number) { return store.getSchedule(id) },
    async previewTarget(target: ScheduleTarget) { return store.previewTarget(target) },
    async previewPlan(cmd: ScheduleCommand, targetCount: number) { return store.previewPlan(cmd, targetCount) },
    async createSchedule(cmd: ScheduleCommand) { return store.createSchedule(cmd) },
    async updateSchedule(id: number, cmd: ScheduleCommand) { return store.updateSchedule(id, cmd) },
    async stopSchedule(id: number, cmd: { reason: string; expectedVersion: number }) { return store.stopSchedule(id, cmd) },
    async recordContext(input: { doseIds?: number[]; cattleCodes?: string[] }) { return store.recordContext(input) },
    async recordVaccinations(cmd: RecordVaccinationsCommand) { return store.recordVaccinations(cmd) },
    async deferDose(id: number, cmd: DeferDoseCommand) { return store.deferDose(id, cmd) },
    async listHistory(filters: HistoryFilters = {}) { return store.listHistory(filters) },
    async getCattleVaccination(code: string) { return store.getCattleVaccination(code) },
    async correctRecord(id: number, cmd: CorrectVaccinationCommand) { return store.correctRecord(id, cmd) },
    async voidRecord(id: number, cmd: VoidRecordCommand) { return store.voidRecord(id, cmd) },
  }
}
export const vaccinationApi = createVaccinationApi({ mode: backendMode, farmId: backendFarmId, transport: backendTransport, store: vaccinationDemoStore })
