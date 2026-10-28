import type { CattleInput, EntryCalf, HerdEntry, Payment } from '../../../types'
import { backendFarmId, backendMode, backendTransport } from '../../../api/backendTransport'
import { createHerdEntryBackendApi } from './herdEntryBackendApi'
import { initialCalves, SOURCES } from '../data/entryData'
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
    return backendApi.save({ id, record: { ...current, ...patch, draft: patch.draft ?? current.draft, detail: patch.detail ?? current.detail }, cattleRows: patch.draft?.cows ?? current.draft?.cows ?? [] })
  },
  reset: () => usingBackend ? Promise.resolve([] as HerdEntry[]) : localApi.reset(),
  recordPayment: (id: string, payment: Pick<Payment, 'date' | 'amount' | 'method' | 'ref'> & { note?: string }) => usingBackend
    ? backendApi.recordPayment(id, payment)
    : localApi.get(id).then((row) => localApi.update(id, {
      debt: Math.max((row.debt ?? 0) - payment.amount, 0),
      detail: { ...row.detail, payments: [...(row.detail?.payments ?? []), { by: 'Người dùng hiện tại', ...payment }] },
    })),
}

export const saveHerdEntry = (input: { id?: string; record: Partial<HerdEntry>; cattleRows?: CattleInput[] }) => usingBackend
  ? backendApi.save(input)
  : saveLocal(input)

export const voidHerdEntry = (id: string, cattleRows: CattleInput[], patch: Partial<HerdEntry> = { status: 'Đã hủy' }) => usingBackend
  ? backendApi.voidVoucher(id, String(patch.cancelReason ?? 'Hủy phiếu nhập'))
  : voidLocal(id, cattleRows, patch)

export const listPendingEntryCalves = (): Promise<EntryCalf[]> => usingBackend
  ? backendApi.pendingCalves()
  : Promise.resolve(initialCalves)

export const listEntrySellers = () => usingBackend ? backendApi.sellers() : Promise.resolve(SOURCES)
