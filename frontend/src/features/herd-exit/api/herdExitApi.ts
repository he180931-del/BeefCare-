import type { CattleInput, HerdExit, Payment } from '../../../types'
import { backendFarmId, backendMode, backendTransport } from '../../../api/backendTransport'
import { createHerdExitBackendApi, type ExitCandidate } from './herdExitBackendApi'
import { EXPORT_HERD } from '../data/exportsData'
import { BUYERS } from '../data/exitData'
import {
  cancelHerdExit as cancelLocal,
  getExitDraftState,
  herdExitApi as localApi,
  saveHerdExit as saveLocal,
} from './herdExitLocalApi'

const backendApi = createHerdExitBackendApi({ transport: backendTransport, farmId: backendFarmId })
const usingBackend = backendMode === 'backend'

export { getExitDraftState }

export const herdExitApi = {
  list: async (predicate?: (row: HerdExit) => boolean) => {
    const rows = usingBackend ? await backendApi.list() : await localApi.list()
    return predicate ? rows.filter(predicate) : rows
  },
  get: (id: string) => usingBackend ? backendApi.get(id) : localApi.get(id),
  create: (record: Omit<HerdExit, 'id'> & Partial<Pick<HerdExit, 'id'>>) => usingBackend
    ? backendApi.save({ id: record.id, record })
    : localApi.create(record),
  update: async (id: string, patch: Partial<HerdExit>) => {
    if (!usingBackend) return localApi.update(id, patch)
    const current = await backendApi.get(id)
    return backendApi.save({ id, record: { ...current, ...patch, draft: patch.draft ?? current.draft, detail: patch.detail ?? current.detail }, cattleRows: patch.draft?.cows ?? current.draft?.cows ?? [] })
  },
  reset: () => usingBackend ? Promise.resolve([] as HerdExit[]) : localApi.reset(),
  recordPayment: (id: string, payment: Pick<Payment, 'date' | 'amount' | 'method' | 'ref'> & { note?: string }) => usingBackend
    ? backendApi.recordPayment(id, payment)
    : localApi.get(id).then((row) => localApi.update(id, {
      due: Math.max((row.due ?? 0) - payment.amount, 0),
      detail: { ...row.detail, payments: [...(row.detail?.payments ?? []), { by: 'Người dùng hiện tại', ...payment }] },
    })),
}

export const saveHerdExit = (input: { id?: string; record: Partial<HerdExit>; cattleRows?: CattleInput[] }) => usingBackend
  ? backendApi.save(input)
  : saveLocal(input)

export const cancelHerdExit = (id: string, cattleRows: CattleInput[], patch: Partial<HerdExit> = { status: 'Đã hủy' }) => usingBackend
  ? backendApi.voidVoucher(id, String(patch.cancelReason ?? 'Hủy phiếu xuất'))
  : cancelLocal(id, cattleRows, patch)

export const dismissHerdExit = (id: string, reason: string) => usingBackend
  ? backendApi.dismissVoucher(id, reason)
  : localApi.update(id, { status: 'Đã bác', reason })

export const listSelectableExitCattle = (): Promise<ExitCandidate[]> => usingBackend
  ? backendApi.selectableCattle()
  : Promise.resolve(EXPORT_HERD.map((row) => ({ ...row, unitPrice: 92000 })))

export const listExitBuyers = () => usingBackend ? backendApi.buyers() : Promise.resolve(BUYERS)
