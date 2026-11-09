// Entry-specific façade. Entry data is backend-owned; do not expose the
// localStorage-backed domain collections through this feature boundary.
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
  listEntryVaccines,
  listEntryBreeds,
  listEntryPurposes,
  listEntryParentCattle,
  listPendingEntryCalves,
  markCalfDiedBeforeRegistration,
  assignCalfParentage,
  previewEntryExcel,
  removeEntryAttachment,
  saveHerdEntry,
  voidHerdEntry,
} from './herdEntryApi'

// Kept as a compatibility façade for existing Entry tests/components. Its
// implementation is the backend pen endpoint, never the local collection.
import { listEntryPens } from './herdEntryApi'
export const pens = { list: listEntryPens }
