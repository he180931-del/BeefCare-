import type { CattleInput } from '../../cattle'
import type { EntryCalf, HerdEntry } from '../types'
import type { EntryPayment } from '../types'
import { activeFarmId } from '../../../app/session/currentFarm'
import { backendMode } from '../../../shared/config/runtime'
import { backendTransport } from '../../../shared/api/backendTransport'
import {
  createHerdEntryBackendApi,
  type EntryBreedOption,
  type EntryListFilters,
  type EntryListView,
  type EntryParentOption,
  type EntryVaccineOption,
} from './herdEntryBackendApi'
import { businessDate } from '../../../shared/lib/date/farmTime'
import { entryToday } from '../validation/entryValidation'
import type { EntryCow } from '../types'
import { demo } from '../../../demo/demoModules'
import { requireVersion, type VoucherPaymentSnapshot, type VoucherSnapshot } from '../../../shared/api/snapshotVersion'

const backendApi = createHerdEntryBackendApi({ transport: backendTransport, farmId: activeFarmId })

// Explicit mode: `npm run dev:mock` (VITE_BEEFCARE_DATA_SOURCE unset) serves the demo data,
// `backend` talks to the real API and never falls back to the demo data.
const usingBackend = backendMode === 'backend'

export const getEntryDraftState = (rows: HerdEntry[], id?: string) => {
  const row = id ? rows.find((item) => item.id === id) : undefined
  return { ...(row?.draft ?? {}), type: row?.draft?.type ?? row?.type ?? 'Mua ngoài', row }
}

const demoOnly = (what: string): never => { throw new Error(`${what} chỉ có khi kết nối backend`) }

export const herdEntryApi = {
  list: async (predicate?: (row: HerdEntry) => boolean) => {
    const rows = usingBackend ? await backendApi.list() : await demo.entryLocal.localApi.list()
    return predicate ? rows.filter(predicate) : rows
  },
  // GET /api/farms/{farmId}/entry-vouchers
  listView: (filters?: EntryListFilters): Promise<EntryListView> => usingBackend ? backendApi.listView(filters) : demo.entryLocal.localView(filters),
  // GET /api/farms/{farmId}/entry-vouchers/{id}
  get: (id: string) => usingBackend ? backendApi.get(id) : demo.entryLocal.localApi.get(id),
  create: (record: Omit<HerdEntry, 'id'> & Partial<Pick<HerdEntry, 'id'>>) => usingBackend
    ? backendApi.save({ record })
    : demo.entryLocal.localApi.create(record),
  update: async (id: string, patch: Partial<HerdEntry>, snapshot: VoucherSnapshot) => {
    if (!usingBackend) return demo.entryLocal.localApi.update(id, patch)
    const expectedVersion = requireVersion(snapshot?.expectedVersion)
    const current = await backendApi.get(id)
    return backendApi.save({ id, expectedVersion, record: { ...current, ...patch, draft: patch.draft ?? current.draft, detail: patch.detail ?? current.detail }, cattleRows: patch.draft?.calves ?? patch.draft?.cows ?? current.draft?.calves ?? current.draft?.cows ?? [] })
  },
  reset: () => usingBackend ? Promise.reject(new Error('Entry reset yêu cầu dữ liệu mẫu; không dùng khi kết nối backend')) : demo.entryLocal.localApi.reset(),
  // POST /api/farms/{farmId}/vouchers/entry/{voucherId}/payments
  recordPayment: (id: string, payment: Pick<EntryPayment, 'date' | 'amount' | 'method' | 'ref'> & { note?: string }, snapshot: VoucherPaymentSnapshot) => usingBackend
    ? backendApi.recordPayment(id, payment, snapshot)
    : demo.entryLocal.localApi.get(id).then((row) => demo.entryLocal.localApi.update(id, {
      debt: Math.max((row.debt ?? 0) - payment.amount, 0),
      detail: { ...row.detail, payments: [...(row.detail?.payments ?? []), { by: 'Người dùng hiện tại', ...payment }] },
    })),
}

// POST|PUT /api/farms/{farmId}/entry-vouchers[/{id}] and POST .../{id}/post
export const saveHerdEntry = (input: { id?: string; expectedVersion?: number; record: Partial<HerdEntry>; cattleRows?: CattleInput[]; documents?: File[] }) => {
  return usingBackend ? backendApi.save(input) : demo.entryLocal.saveDraft(input)
}

// POST /api/farms/{farmId}/entry-vouchers/{id}/void (máy chủ ghi lịch sử hủy theo phiên)
export const voidHerdEntry = (id: string, cattleRows: CattleInput[], patch: Partial<HerdEntry>, snapshot: VoucherSnapshot) => usingBackend
  ? backendApi.voidVoucher(id, { ...snapshot, reason: String(patch.cancelReason ?? 'Hủy phiếu nhập') })
  : demo.entryLocal.voidEntry(id, cattleRows, patch)


// DELETE /api/farms/{farmId}/entry-vouchers/{id}
export const discardHerdEntryDraft = (id: string, expectedVersion: number | undefined, backendId?: number): Promise<void> => usingBackend ? backendApi.discard(id, expectedVersion, backendId) : demo.entryLocal.localApi.remove(id).then(() => undefined)

// GET /api/farms/{farmId}/pending-calves
export const listPendingEntryCalves = (): Promise<EntryCalf[]> => usingBackend ? backendApi.pendingCalves() : Promise.resolve(demo.entryLocal.pendingCalves())

// POST /api/farms/{farmId}/pending-calves/{calfId}/died-before-registration
export const markCalfDiedBeforeRegistration = async (calfOutcomeId: number, reason: string): Promise<EntryCalf> => {
  if (usingBackend) return backendApi.diedBeforeRegistration(calfOutcomeId, reason)
  return demo.entryLocal.markCalfDied(calfOutcomeId)
}

// chưa có API trong gói S13: gán bò mẹ / bố cho bê
export const assignCalfParentage = async (calfOutcomeId: number, parentage: { damId: number; sireId?: number; sireSource: 'NONE' | 'INTERNAL' | 'AI'; externalSireCode?: string }): Promise<EntryCalf> => {
  if (usingBackend) return backendApi.assignCalfParentage(calfOutcomeId, parentage)
  return demo.entryLocal.assignCalfParentage(calfOutcomeId, parentage)
}

// GET /api/farms/{farmId}/trading-partners?role=seller
export const listEntrySellers = () => usingBackend ? backendApi.sellers() : Promise.resolve(demo.entryLocal.sellers())
// GET /api/farms/{farmId}/pens
export const listEntryPens = () => usingBackend ? backendApi.listPens() : demo.entryLocal.pens.list()
// chưa có API trong gói S13: danh mục vắc-xin
export const listEntryVaccines = (): Promise<EntryVaccineOption[]> => usingBackend
  ? backendApi.vaccines()
  : Promise.resolve(demo.entryLocal.vaccines())
// chưa có API trong gói S13: danh mục giống
export const listEntryBreeds = (): Promise<EntryBreedOption[]> => usingBackend
  ? backendApi.breeds()
  : Promise.resolve(demo.entryLocal.breeds())
// chưa có API trong gói S13: bò mẹ / bò bố cho bê
export const listEntryParentCattle = (): Promise<EntryParentOption[]> => usingBackend
  ? backendApi.parentCattle()
  : demo.entryLocal.parentCattle()

// The Excel flow of the page talks to the backend only; the demo uses the in-page sample rows.
export const entryExcelBackendEnabled = usingBackend

/** Lựa chọn lọc "Nguồn" ở SCR-23: người bán của trại; bản mô phỏng có thêm nguồn của phiếu mẫu đã hủy. */
export const listEntrySourceFilters = (): Promise<string[]> => usingBackend
  ? backendApi.sellers().then((rows) => rows.map((row) => row.name))
  : Promise.resolve(demo.entryLocal.sourceFilters())

export type NewEntryDefaults = {
  recordId: string; date: string; quarantine: string; receiver: string; note: string; cows: EntryCow[]
  freight: number; paid: number; method: string; due: string
}

/** Giá trị ban đầu của phiếu nhập mới: máy chủ thật bắt đầu trống; bản mô phỏng điền sẵn phiếu mẫu theo Figma. */
export function newEntryDefaults({ isBuy, receiver, nextNumber }: { isBuy: boolean; receiver: string; nextNumber: number }): NewEntryDefaults {
  if (usingBackend) return { recordId: 'Tự động khi lưu', date: entryToday(), quarantine: '', receiver, note: '', cows: [], freight: 0, paid: 0, method: '', due: '' }
  return demo.entryLocal.newEntryDefaults({ isBuy, nextNumber })
}

/** Giá trị ban đầu của popup ghi thanh toán phiếu nhập; `by` rỗng thì máy chủ lấy người làm từ phiên. */
export function entryPaymentDefaults(): { date: string; ref: string; note: string; statement: boolean; by: string } {
  return usingBackend
    ? { date: businessDate(), ref: '', note: '', statement: false, by: '' }
    : demo.entryLocal.paymentDefaults()
}
// GET /api/farms/{farmId}/entry-vouchers/{id}/attachments/{attachmentId}
export const downloadEntryAttachment = (id: string, attachmentId: number): Promise<Blob> => usingBackend
  ? backendApi.downloadAttachment(id, attachmentId)
  : Promise.reject(new Error('Tài liệu mẫu không có bản tải riêng'))
// DELETE /api/farms/{farmId}/entry-vouchers/{id}/attachments/{attachmentId}
export const removeEntryAttachment = (id: string, attachmentId: number): Promise<void> => usingBackend
  ? backendApi.removeAttachment(id, attachmentId)
  : Promise.reject(new Error('Tài liệu mẫu không có bản xóa riêng'))
// GET /api/farms/{farmId}/entry-vouchers/import-template
export const downloadEntryImportTemplate = (): Promise<Blob> => usingBackend ? backendApi.downloadImportTemplate() : Promise.reject(new Error('Tải file mẫu chỉ có khi kết nối backend'))
// POST /api/farms/{farmId}/entry-vouchers/{id}/import
export const previewEntryExcel = (id: string, file: File) => usingBackend ? backendApi.previewExcel(id, file) : demoOnly('Kiểm tra file Excel')
export const commitEntryExcel = (id: string, file: File) => usingBackend ? backendApi.commitExcel(id, file) : demoOnly('Nhập file Excel')
