import type { CattleInput, EntryCalf, HerdEntry, Payment } from '../../../types'
import { backendFarmId, backendTransport } from '../../../api/backendTransport'
import { createHerdEntryBackendApi, type EntryListFilters } from './herdEntryBackendApi'

const backendApi = createHerdEntryBackendApi({ transport: backendTransport, farmId: backendFarmId })

// Entry is backend-owned. Do not switch this feature to the local prototype
// collection when the global data-source flag is omitted or misconfigured.
const usingBackend = true

export const getEntryDraftState = (rows: HerdEntry[], id?: string) => {
  const row = id ? rows.find((item) => item.id === id) : undefined
  return { ...(row?.draft ?? {}), type: row?.draft?.type ?? row?.type ?? 'Mua ngoài', row }
}

const backendOnlyError = (operation: string): never => {
  throw new Error(`Entry ${operation} yêu cầu kết nối backend; dữ liệu localStorage không được hỗ trợ`)
}

export const herdEntryApi = {
  list: async (predicate?: (row: HerdEntry) => boolean) => {
    const rows = await backendApi.list()
    return predicate ? rows.filter(predicate) : rows
  },
  listView: (filters?: EntryListFilters) => backendApi.listView(filters),
  get: (id: string) => backendApi.get(id),
  create: (record: Omit<HerdEntry, 'id'> & Partial<Pick<HerdEntry, 'id'>>) => backendApi.save({ id: record.id, record }),
  update: async (id: string, patch: Partial<HerdEntry>) => {
    const current = await backendApi.get(id)
    return backendApi.save({ id, record: { ...current, ...patch, draft: patch.draft ?? current.draft, detail: patch.detail ?? current.detail }, cattleRows: patch.draft?.calves ?? patch.draft?.cows ?? current.draft?.calves ?? current.draft?.cows ?? [] })
  },
  reset: () => backendOnlyError('reset'),
  recordPayment: (id: string, payment: Pick<Payment, 'date' | 'amount' | 'method' | 'ref'> & { note?: string }) => backendApi.recordPayment(id, payment),
}

export const saveHerdEntry = (input: { id?: string; record: Partial<HerdEntry>; cattleRows?: CattleInput[]; documents?: File[] }) => backendApi.save(input)

export const voidHerdEntry = (id: string, _cattleRows: CattleInput[], patch: Partial<HerdEntry> = { status: 'Đã hủy' }) => backendApi.voidVoucher(id, String(patch.cancelReason ?? 'Hủy phiếu nhập'))

export const discardHerdEntryDraft = (id: string) => backendApi.discard(id)

export const listPendingEntryCalves = (): Promise<EntryCalf[]> => backendApi.pendingCalves()

export const markCalfDiedBeforeRegistration = (calfOutcomeId: number, reason: string): Promise<EntryCalf> => backendApi.diedBeforeRegistration(calfOutcomeId, reason)
export const assignCalfParentage = (calfOutcomeId: number, parentage: { damId: number; sireId?: number; sireSource: 'NONE' | 'INTERNAL' | 'AI'; externalSireCode?: string }): Promise<EntryCalf> => backendApi.assignCalfParentage(calfOutcomeId, parentage)

export const listEntrySellers = () => backendApi.sellers()
export const listEntryPens = () => backendApi.listPens()
export const listEntryVaccines = () => backendApi.vaccines()
export const listEntryBreeds = () => backendApi.breeds()
export const listEntryParentCattle = () => backendApi.parentCattle()

export const entryExcelBackendEnabled = usingBackend
export const downloadEntryAttachment = (id: string, attachmentId: number) => {
  return backendApi.downloadAttachment(id, attachmentId)
}
export const removeEntryAttachment = (id: string, attachmentId: number) => {
  return backendApi.removeAttachment(id, attachmentId)
}
export const downloadEntryImportTemplate = () => {
  return backendApi.downloadImportTemplate()
}
export const previewEntryExcel = (id: string, file: File) => {
  return backendApi.previewExcel(id, file)
}
export const commitEntryExcel = (id: string, file: File) => {
  return backendApi.commitExcel(id, file)
}
