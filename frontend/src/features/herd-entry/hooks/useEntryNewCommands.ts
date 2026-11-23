import { useCallback, useState } from 'react'
import { commitEntryExcel as commitExcel, discardHerdEntryDraft as discardDraft, downloadEntryImportTemplate as downloadTemplate, entryExcelBackendEnabled, herdEntryApi, markCalfDiedBeforeRegistration as markDied, previewEntryExcel as previewExcel } from '../api'
import type { EntryCalf } from '../types'

type CommandResult = { name: string; value: unknown } | null

export function useEntryNewCommands() {
  const [result, setResult] = useState<CommandResult>(null)
  const run = useCallback(async <T,>(name: string, command: () => Promise<T>) => {
    const value = await command()
    setResult({ name, value })
    return value
  }, [])
  const markCalfDiedBeforeRegistration = useCallback((calfOutcomeId: number, reason: string): Promise<EntryCalf> => run('markCalfDiedBeforeRegistration', () => markDied(calfOutcomeId, reason)), [run])
  const discardHerdEntryDraft = useCallback((id: string, expectedVersion: number | undefined, backendId?: number): Promise<void> => run('discardHerdEntryDraft', () => discardDraft(id, expectedVersion, backendId)), [run])
  const previewEntryExcel = useCallback((id: string, file: File) => run('previewEntryExcel', () => previewExcel(id, file)), [run])
  const commitEntryExcel = useCallback((id: string, file: File) => run('commitEntryExcel', () => commitExcel(id, file)), [run])
  const downloadEntryImportTemplate = useCallback(() => run('downloadEntryImportTemplate', () => downloadTemplate()), [run])
  const getEntry = useCallback((id: string) => run('getEntry', () => herdEntryApi.get(id)), [run])
  return { commitEntryExcel, discardHerdEntryDraft, downloadEntryImportTemplate, entryExcelBackendEnabled, markCalfDiedBeforeRegistration, previewEntryExcel, getEntry, result }
}
