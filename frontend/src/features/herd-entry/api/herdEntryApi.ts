import type { CattleInput, EntryCalf, HerdEntry, Payment } from '../../../types'
import { backendFarmId, backendMode, backendTransport } from '../../../api/backendTransport'
import { createHerdEntryBackendApi } from './herdEntryBackendApi'
import { initialCalves, SOURCES } from '../data/entryData'
import { pens } from '../../../api/herdDomainApi'
import {
  getEntryDraftState,
  herdEntryApi as localApi,
  saveHerdEntry as saveLocal,
  voidHerdEntry as voidLocal,
} from './herdEntryLocalApi'

const backendApi = createHerdEntryBackendApi({ transport: backendTransport, farmId: backendFarmId })
const usingBackend = backendMode === 'backend'

export { getEntryDraftState }

export const herdEntryApi = {
  list: async (predicate?: (row: HerdEntry) => boolean) => {
    const rows = usingBackend ? await backendApi.list() : await localApi.list()
    return predicate ? rows.filter(predicate) : rows
  },
  get: (id: string) => usingBackend ? backendApi.get(id) : localApi.get(id),
  create: (record: Omit<HerdEntry, 'id'> & Partial<Pick<HerdEntry, 'id'>>) => usingBackend
    ? backendApi.save({ id: record.id, record })
    : localApi.create(record),
  update: async (id: string, patch: Partial<HerdEntry>) => {
    if (!usingBackend) return localApi.update(id, patch)
    const current = await backendApi.get(id)
    return backendApi.save({ id, record: { ...current, ...patch, draft: patch.draft ?? current.draft, detail: patch.detail ?? current.detail }, cattleRows: patch.draft?.calves ?? patch.draft?.cows ?? current.draft?.calves ?? current.draft?.cows ?? [] })
  },
  reset: () => usingBackend ? Promise.resolve([] as HerdEntry[]) : localApi.reset(),
  recordPayment: (id: string, payment: Pick<Payment, 'date' | 'amount' | 'method' | 'ref'> & { note?: string }) => usingBackend
    ? backendApi.recordPayment(id, payment)
    : localApi.get(id).then((row) => localApi.update(id, {
      debt: Math.max((row.debt ?? 0) - payment.amount, 0),
      detail: { ...row.detail, payments: [...(row.detail?.payments ?? []), { by: 'Người dùng hiện tại', ...payment }] },
    })),
}

export const saveHerdEntry = (input: { id?: string; record: Partial<HerdEntry>; cattleRows?: CattleInput[]; documents?: File[] }) => usingBackend
  ? backendApi.save(input)
  : saveLocal({ id: input.id, record: input.record, cattleRows: input.cattleRows })

export const voidHerdEntry = (id: string, cattleRows: CattleInput[], patch: Partial<HerdEntry> = { status: 'Đã hủy' }) => usingBackend
  ? backendApi.voidVoucher(id, String(patch.cancelReason ?? 'Hủy phiếu nhập'))
  : voidLocal(id, cattleRows, patch)

export const discardHerdEntryDraft = (id: string) => usingBackend
  ? backendApi.discard(id)
  : localApi.update(id, { status: 'Đã hủy', cancelReason: 'Hủy nháp' }).then(() => undefined)

export const listPendingEntryCalves = (): Promise<EntryCalf[]> => usingBackend
  ? backendApi.pendingCalves()
  : Promise.resolve(initialCalves)

export const markCalfDiedBeforeRegistration = (calfOutcomeId: number, reason: string): Promise<EntryCalf> => usingBackend
  ? backendApi.diedBeforeRegistration(calfOutcomeId, reason)
  : Promise.reject(new Error('Đánh dấu bê chết trước đăng ký chỉ khả dụng khi kết nối backend'))

export const listEntrySellers = () => usingBackend ? backendApi.sellers() : Promise.resolve(SOURCES)
export const listEntryPens = () => usingBackend ? backendApi.listPens() : pens.list()

export const entryExcelBackendEnabled = usingBackend
export const downloadEntryAttachment = (id: string, attachmentId: number) => {
  if (!usingBackend) return Promise.reject(new Error('Chứng từ backend không khả dụng ở chế độ dữ liệu cục bộ'))
  return backendApi.downloadAttachment(id, attachmentId)
}
export const removeEntryAttachment = (id: string, attachmentId: number) => {
  if (!usingBackend) return Promise.reject(new Error('Xóa chứng từ backend không khả dụng ở chế độ dữ liệu cục bộ'))
  return backendApi.removeAttachment(id, attachmentId)
}
export const downloadEntryImportTemplate = () => {
  if (!usingBackend) return Promise.reject(new Error('Mẫu Excel backend không khả dụng ở chế độ dữ liệu cục bộ'))
  return backendApi.downloadImportTemplate()
}
export const previewEntryExcel = (id: string, file: File) => {
  if (!usingBackend) return Promise.reject(new Error('Nhập Excel backend không khả dụng ở chế độ dữ liệu cục bộ'))
  return backendApi.previewExcel(id, file)
}
export const commitEntryExcel = (id: string, file: File) => {
  if (!usingBackend) return Promise.reject(new Error('Nhập Excel backend không khả dụng ở chế độ dữ liệu cục bộ'))
  return backendApi.commitExcel(id, file)
}
