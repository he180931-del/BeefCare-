import { useCallback, useState } from 'react'
import { assignCalfParentage as assignParentage, commitEntryExcel as commitExcel, discardHerdEntryDraft as discardDraft, downloadEntryImportTemplate as downloadTemplate, entryExcelBackendEnabled, herdEntryApi, markCalfDiedBeforeRegistration as markDied, previewEntryExcel as previewExcel } from '../api'
import type { EntryCalf } from '../types'

type CommandResult = { name: string; value: unknown } | null

export function useEntryNewCommands() {
  const [result, setResult] = useState<CommandResult>(null)
  const run = useCallback(async <T,>(name: string, command: () => Promise<T>) => {
    const value = await command()
    setResult({ name, value })
    return value
  }, [])
  const assignCalfParentage = useCallback((calfOutcomeId: number, parentage: Parameters<typeof assignParentage>[1]): Promise<EntryCalf> => run('assignCalfParentage', () => assignParentage(calfOutcomeId, parentage)), [run])
  const markCalfDiedBeforeRegistration = useCallback((calfOutcomeId: number, reason: string): Promise<EntryCalf> => run('markCalfDiedBeforeRegistration', () => markDied(calfOutcomeId, reason)), [run])
  const discardHerdEntryDraft = useCallback((id: string): Promise<void> => run('discardHerdEntryDraft', () => discardDraft(id)), [run])
  const previewEntryExcel = useCallback((id: string, file: File) => run('previewEntryExcel', () => previewExcel(id, file)), [run])
  const commitEntryExcel = useCallback((id: string, file: File) => run('commitEntryExcel', () => commitExcel(id, file)), [run])
  const downloadEntryImportTemplate = useCallback(() => run('downloadEntryImportTemplate', () => downloadTemplate()), [run])
  const getEntry = useCallback((id: string) => run('getEntry', () => herdEntryApi.get(id)), [run])
  return { assignCalfParentage, commitEntryExcel, discardHerdEntryDraft, downloadEntryImportTemplate, entryExcelBackendEnabled, markCalfDiedBeforeRegistration, previewEntryExcel, getEntry, result }
}
