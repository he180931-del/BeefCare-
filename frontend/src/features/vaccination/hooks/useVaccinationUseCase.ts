import { useCallback } from 'react'
import { useQuery } from '../../../shared/hooks/useQuery'
import { vaccinationApi } from '../api/vaccinationApi'
import type {
  CorrectVaccinationCommand,
  DeferDoseCommand,
  DoseFilters,
  HistoryFilters,
  RecordVaccinationsCommand,
  ScheduleCommand,
  ScheduleDetail,
  ScheduleTarget,
  VoidRecordCommand,
} from '../types'

/**
 * Feature-owned query and command boundary for vaccination screens.
 * Pages and dialogs keep route/form/presentation state; API orchestration
 * stays here so they do not couple themselves to the adapter implementation.
 */
export function useVaccinationOptions() {
  return useQuery(() => vaccinationApi.options(), [])
}

export function useVaccinationSchedules(reload = 0, demoMode?: string | null) {
  return useQuery(
    () => demoMode === 'load-error' ? Promise.reject(new Error('demo')) : vaccinationApi.listSchedules(),
    [reload, demoMode],
  )
}

export function useVaccinationDoses(filters: DoseFilters) {
  return useQuery(
    () => vaccinationApi.listDoses(filters),
    [filters.scheduleId, filters.tab, filters.page, filters.size, filters.dir],
  )
}

export function useVaccinationDose(id: number) {
  return useQuery(() => vaccinationApi.getDose(id), [id])
}

export function useVaccinationScheduleDetail(id: number | 'new' | undefined) {
  return useQuery(() => typeof id === 'number' ? vaccinationApi.getSchedule(id) : Promise.resolve(null), [id])
}

export function useVaccinationTargetPreview(target: ScheduleTarget) {
  return useQuery(() => vaccinationApi.previewTarget(target), [JSON.stringify(target)])
}

export function useVaccinationPlan(detail: ScheduleDetail | null | undefined, command: ScheduleCommand, targetCount: number) {
  return useQuery(
    () => detail ? Promise.resolve(detail.plannedRows) : vaccinationApi.previewPlan(command, targetCount),
    [detail, JSON.stringify(command), targetCount],
  )
}

export function useVaccinationHistory(filters: HistoryFilters) {
  return useQuery(
    () => vaccinationApi.listHistory(filters),
    [filters.q, filters.vaccineId, filters.source, filters.from, filters.to, filters.page, filters.size],
  )
}

export function useVaccinationRecordContext(input: { doseIds?: number[]; cattleCodes?: string[] }, key: string) {
  return useQuery(() => vaccinationApi.recordContext(input), [key])
}

export function useCattleVaccination(code: string) {
  return useQuery(() => vaccinationApi.getCattleVaccination(code), [code])
}

/** Commands are memoized once per screen and preserve the API boundary. */
export function useVaccinationCommands() {
  const previewTarget = useCallback((target: ScheduleTarget) => vaccinationApi.previewTarget(target), [])
  const createSchedule = useCallback((command: ScheduleCommand) => vaccinationApi.createSchedule(command), [])
  const updateSchedule = useCallback((id: number, command: ScheduleCommand) => vaccinationApi.updateSchedule(id, command), [])
  const stopSchedule = useCallback((id: number, command: { reason: string; expectedVersion: number }) => vaccinationApi.stopSchedule(id, command), [])
  const recordVaccinations = useCallback((command: RecordVaccinationsCommand) => vaccinationApi.recordVaccinations(command), [])
  const deferDose = useCallback((id: number, command: DeferDoseCommand) => vaccinationApi.deferDose(id, command), [])
  const correctRecord = useCallback((id: number, command: CorrectVaccinationCommand) => vaccinationApi.correctRecord(id, command), [])
  const voidRecord = useCallback((id: number, command: VoidRecordCommand) => vaccinationApi.voidRecord(id, command), [])
  return { previewTarget, createSchedule, updateSchedule, stopSchedule, recordVaccinations, deferDose, correctRecord, voidRecord }
}

/** Stable aggregate name used by the feature package contract. */
export function useVaccinationUseCase() {
  return useVaccinationCommands()
}
