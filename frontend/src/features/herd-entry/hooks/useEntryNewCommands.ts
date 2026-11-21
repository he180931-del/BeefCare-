import { assignCalfParentage, commitEntryExcel, discardHerdEntryDraft, downloadEntryAttachment, downloadEntryImportTemplate, entryExcelBackendEnabled, herdEntryApi, markCalfDiedBeforeRegistration, previewEntryExcel } from '../api'

export function useEntryNewCommands() {
  return { assignCalfParentage, commitEntryExcel, discardHerdEntryDraft, downloadEntryAttachment, downloadEntryImportTemplate, entryExcelBackendEnabled, markCalfDiedBeforeRegistration, previewEntryExcel, getEntry: herdEntryApi.get }
}
