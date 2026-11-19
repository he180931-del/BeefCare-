import type { CattleInput, EntryCalf, HerdEntry, Payment } from '../../../types'
import { backendFarmId, backendMode, backendTransport } from '../../../api/backendTransport'
import { cattle, pens } from '../../../api/herdDomainApi'
import {
  createHerdEntryBackendApi,
  type EntryBreedOption,
  type EntryListFilters,
  type EntryListView,
  type EntryParentOption,
  type EntryVaccineOption,
} from './herdEntryBackendApi'
import {
  herdEntryApi as localApi,
  saveHerdEntry as saveLocal,
  voidHerdEntry as voidLocal,
} from './herdEntryLocalApi'
import { SOURCES, initialCalves } from '../data/entryData'
import { BREEDS, OLDER } from '../data/importsData'

const backendApi = createHerdEntryBackendApi({ transport: backendTransport, farmId: backendFarmId })

// Explicit mode: `npm run dev:mock` (VITE_BEEFCARE_DATA_SOURCE unset) serves the demo data,
// `backend` talks to the real API and never falls back to the demo data.
const usingBackend = backendMode === 'backend'

export const getEntryDraftState = (rows: HerdEntry[], id?: string) => {
  const row = id ? rows.find((item) => item.id === id) : undefined
  return { ...(row?.draft ?? {}), type: row?.draft?.type ?? row?.type ?? 'Mua ngoài', row }
}

const demoOnly = (what: string): never => { throw new Error(`${what} chỉ có khi kết nối backend`) }

// Demo calves wait in memory until they are registered or marked dead.
let localCalves: EntryCalf[] = structuredClone(initialCalves).map((calf, index) => ({ ...calf, calfOutcomeId: index + 1 }))

const NO_OLDER = { total: 0, done: 0, drafts: 0, cancelled: 0, cows: 0, buyCows: 0, calfCows: 0, buyMoney: 0 }
const localView = async (filters: EntryListFilters = {}): Promise<EntryListView> => {
  const all = await localApi.list()
  const kind = filters.type === 'FARM_BORN' ? 'Bê sinh tại trại' : filters.type === 'PURCHASE' ? 'Mua ngoài' : undefined
  const rows = all.filter((row) => (!kind || row.type === kind) && (!filters.from || (row.date ?? '') >= filters.from) && (!filters.to || (row.date ?? '') <= filters.to))
  const posted = rows.filter((row) => row.status === 'Đã nhập')
  const purchases = posted.filter((row) => row.type === 'Mua ngoài')
  // Vouchers before the listed ones (OLDER) only count towards the unfiltered totals.
  const older = !kind && (!filters.from || filters.from <= '2026-07-01') ? OLDER : NO_OLDER
  const sum = (items: HerdEntry[], pick: (row: HerdEntry) => number | null | undefined) => items.reduce((total, row) => total + (pick(row) ?? 0), 0)
  const count = (status: string) => rows.filter((row) => row.status === status).length
  return {
    rows,
    counts: { ALL: rows.length + older.total, DRAFT: count('Nháp'), POSTED: count('Đã nhập') + older.done, VOIDED: count('Đã hủy') },
    tiles: {
      postedVouchers: posted.length + older.done,
      draftVouchers: count('Nháp'),
      cattleEntered: sum(posted, (row) => row.count) + older.cows,
      cattlePurchased: sum(purchases, (row) => row.count) + older.buyCows,
      cattleFarmBorn: sum(posted.filter((row) => row.type === 'Bê sinh tại trại'), (row) => row.count) + older.calfCows,
      purchaseAmount: sum(purchases, (row) => row.total) + older.buyMoney,
      owedToSellers: sum(purchases, (row) => row.debt),
    },
  }
}

const localDocs = (files: File[] = []) => files.map((file) => ({
  name: file.name,
  ext: file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf') ? 'PDF' : 'JPG',
  size: file.size,
}))

export const herdEntryApi = {
  list: async (predicate?: (row: HerdEntry) => boolean) => {
    const rows = usingBackend ? await backendApi.list() : await localApi.list()
    return predicate ? rows.filter(predicate) : rows
  },
  // GET /api/farms/{farmId}/entry-vouchers
  listView: (filters?: EntryListFilters): Promise<EntryListView> => usingBackend ? backendApi.listView(filters) : localView(filters),
  // GET /api/farms/{farmId}/entry-vouchers/{id}
  get: (id: string) => usingBackend ? backendApi.get(id) : localApi.get(id),
  create: (record: Omit<HerdEntry, 'id'> & Partial<Pick<HerdEntry, 'id'>>) => usingBackend
    ? backendApi.save({ id: record.id, record })
    : localApi.create(record),
  update: async (id: string, patch: Partial<HerdEntry>) => {
    if (!usingBackend) return localApi.update(id, patch)
    const current = await backendApi.get(id)
    return backendApi.save({ id, record: { ...current, ...patch, draft: patch.draft ?? current.draft, detail: patch.detail ?? current.detail }, cattleRows: patch.draft?.calves ?? patch.draft?.cows ?? current.draft?.calves ?? current.draft?.cows ?? [] })
  },
  reset: () => usingBackend ? Promise.reject(new Error('Entry reset yêu cầu dữ liệu mẫu; không dùng khi kết nối backend')) : localApi.reset(),
  // POST /api/farms/{farmId}/vouchers/entry/{voucherId}/payments
  recordPayment: (id: string, payment: Pick<Payment, 'date' | 'amount' | 'method' | 'ref'> & { note?: string }) => usingBackend
    ? backendApi.recordPayment(id, payment)
    : localApi.get(id).then((row) => localApi.update(id, {
      debt: Math.max((row.debt ?? 0) - payment.amount, 0),
      detail: { ...row.detail, payments: [...(row.detail?.payments ?? []), { by: 'Người dùng hiện tại', ...payment }] },
    })),
}

// POST|PUT /api/farms/{farmId}/entry-vouchers[/{id}] and POST .../{id}/post
export const saveHerdEntry = (input: { id?: string; record: Partial<HerdEntry>; cattleRows?: CattleInput[]; documents?: File[] }) => {
  if (usingBackend) return backendApi.save(input)
  const docs = localDocs(input.documents)
  const existing = input.record.draft?.docs ?? []
  const added = docs.filter((file) => !existing.some((item) => item.name === file.name && item.size === file.size))
  if (input.record.status === 'Đã nhập') {
    const stored = input.record.detail?.docs ?? []
    const fresh = docs.filter((file) => !stored.some((item) => item.name === file.name && item.size === file.size))
    return saveLocal({ id: input.id, cattleRows: input.cattleRows, record: fresh.length ? { ...input.record, detail: { ...input.record.detail, docs: [...stored, ...fresh] } } : input.record })
  }
  return saveLocal({
    id: input.id,
    cattleRows: input.cattleRows,
    record: added.length ? { ...input.record, draft: { ...input.record.draft, docs: [...existing, ...added] } } : input.record,
  })
}

// POST /api/farms/{farmId}/entry-vouchers/{id}/void
export const voidHerdEntry = (id: string, cattleRows: CattleInput[], patch: Partial<HerdEntry> = { status: 'Đã hủy' }) => usingBackend
  ? backendApi.voidVoucher(id, String(patch.cancelReason ?? 'Hủy phiếu nhập'))
  : voidLocal(id, cattleRows, patch)

// DELETE /api/farms/{farmId}/entry-vouchers/{id}
export const discardHerdEntryDraft = (id: string): Promise<void> => usingBackend ? backendApi.discard(id) : localApi.remove(id).then(() => undefined)

// GET /api/farms/{farmId}/pending-calves
export const listPendingEntryCalves = (): Promise<EntryCalf[]> => usingBackend ? backendApi.pendingCalves() : Promise.resolve(structuredClone(localCalves))

// POST /api/farms/{farmId}/pending-calves/{calfId}/died-before-registration
export const markCalfDiedBeforeRegistration = async (calfOutcomeId: number, reason: string): Promise<EntryCalf> => {
  if (usingBackend) return backendApi.diedBeforeRegistration(calfOutcomeId, reason)
  const calf = localCalves.find((row) => row.calfOutcomeId === calfOutcomeId)
  if (!calf) throw new Error('Không tìm thấy bê chờ xác nhận.')
  localCalves = localCalves.filter((row) => row !== calf)
  return structuredClone(calf)
}

// chưa có API trong gói S13: gán bò mẹ / bố cho bê
export const assignCalfParentage = async (calfOutcomeId: number, parentage: { damId: number; sireId?: number; sireSource: 'NONE' | 'INTERNAL' | 'AI'; externalSireCode?: string }): Promise<EntryCalf> => {
  if (usingBackend) return backendApi.assignCalfParentage(calfOutcomeId, parentage)
  const calf = localCalves.find((row) => row.calfOutcomeId === calfOutcomeId)
  if (!calf) throw new Error('Không tìm thấy bê chờ xác nhận.')
  return structuredClone({ ...calf, damId: parentage.damId, sireId: parentage.sireId, sireSource: parentage.sireSource })
}

// GET /api/farms/{farmId}/trading-partners?role=seller
export const listEntrySellers = () => usingBackend ? backendApi.sellers() : Promise.resolve(structuredClone(SOURCES))
// GET /api/farms/{farmId}/pens
export const listEntryPens = () => usingBackend ? backendApi.listPens() : pens.list()
// chưa có API trong gói S13: danh mục vắc-xin
export const listEntryVaccines = (): Promise<EntryVaccineOption[]> => usingBackend
  ? backendApi.vaccines()
  : Promise.resolve([{ id: 1, code: 'LMLM', name: 'LMLM', available: true }, { id: 2, code: 'THT', name: 'Tụ huyết trùng', available: true }])
// chưa có API trong gói S13: danh mục giống
export const listEntryBreeds = (): Promise<EntryBreedOption[]> => usingBackend
  ? backendApi.breeds()
  : Promise.resolve(BREEDS.map((name, index) => ({ id: index + 1, code: name, name, available: true })))
// chưa có API trong gói S13: bò mẹ / bò bố cho bê
export const listEntryParentCattle = (): Promise<EntryParentOption[]> => usingBackend
  ? backendApi.parentCattle()
  : cattle.list().then((rows) => rows
    .filter((row) => row.status === 'ACTIVE')
    .map((row, index) => ({ id: index + 1, code: row.code, sex: row.sex === 'Đực' ? 'MALE' as const : 'FEMALE' as const, name: row.name ?? row.code })))

// The Excel flow of the page talks to the backend only; the demo uses the in-page sample rows.
export const entryExcelBackendEnabled = usingBackend
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
