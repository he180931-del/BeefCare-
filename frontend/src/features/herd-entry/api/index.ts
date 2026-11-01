// Entry-specific façade. Cross-feature cattle/pen consistency lives in the
// shared domain API; pages import this module so the feature boundary remains
// explicit and replaceable when the backend is connected.
export {
  cattle,
  pens,
  registerEntryCattle,
  voidEntryCattle,
} from '../../../api/herdDomainApi'
export {
  commitEntryExcel,
  discardHerdEntryDraft,
  downloadEntryAttachment,
  downloadEntryImportTemplate,
  entryExcelBackendEnabled,
  getEntryDraftState,
  herdEntryApi,
  listEntrySellers,
  listEntryPens,
  listPendingEntryCalves,
  markCalfDiedBeforeRegistration,
  previewEntryExcel,
  removeEntryAttachment,
  saveHerdEntry,
  voidHerdEntry,
} from './herdEntryApi'
