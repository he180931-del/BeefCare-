import { useCallback } from 'react'
import { healthApi } from '../api/healthApi'
import type { CorrectEntryCommand, FollowUpCommand, OpenCaseCommand, StatusCommand, TreatmentCommand, VoidEntryCommand } from '../types'

/** Command boundary used by health dialogs; components never reach the API adapter directly. */
export function useHealthCaseCommands() {
  const now = useCallback(() => healthApi.now(), [])
  const openCase = useCallback((cattleCode: string, command: OpenCaseCommand) => healthApi.openCase(cattleCode, command), [])
  const recordFollowUp = useCallback((caseId: number, command: FollowUpCommand) => healthApi.recordFollowUp(caseId, command), [])
  const recordTreatment = useCallback((caseId: number, command: TreatmentCommand) => healthApi.recordTreatment(caseId, command), [])
  const updateStatus = useCallback((caseId: number, command: StatusCommand) => healthApi.updateStatus(caseId, command), [])
  const correctEntry = useCallback((entryId: number, command: CorrectEntryCommand) => healthApi.correctEntry(entryId, command), [])
  const voidEntry = useCallback((entryId: number, command: VoidEntryCommand) => healthApi.voidEntry(entryId, command), [])
  return { now, openCase, recordFollowUp, recordTreatment, updateStatus, correctEntry, voidEntry }
}
