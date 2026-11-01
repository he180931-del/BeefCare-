import type { CattleInput, HerdExit, Payment } from '../../../types'
import { backendFarmId, backendMode, backendTransport } from '../../../api/backendTransport'
import { createHerdExitBackendApi, type ExitCandidate, type ExitChecks } from './herdExitBackendApi'
import { EXPORT_HERD } from '../data/exportsData'
import { BUYERS } from '../data/exitData'
import {
  cancelHerdExit as cancelLocal,
  getExitDraftState,
  herdExitApi as localApi,
  saveHerdExit as saveLocal,
} from './herdExitLocalApi'
import { cattle } from '../../../api/herdDomainApi'

const backendApi = createHerdExitBackendApi({ transport: backendTransport, farmId: backendFarmId })
const usingBackend = backendMode === 'backend'

export { getExitDraftState }

export const herdExitApi = {
  list: async (predicate?: (row: HerdExit) => boolean) => {
    const rows = usingBackend ? await backendApi.list() : await localApi.list()
    return predicate ? rows.filter(predicate) : rows
  },
  get: (id: string) => usingBackend ? backendApi.get(id) : localApi.get(id),
  checks: async (id: string): Promise<ExitChecks> => {
    if (usingBackend) return backendApi.checks(id)
    const row = await localApi.get(id)
    return {
      voucherId: Number(row.backendId ?? 0), code: row.id, version: Number(row.version ?? 0), exitDate: row.date ?? '',
      cattle: (row.draft?.cows ?? row.detail?.cows ?? []).map((cow) => ({
        cattleId: Number(cow.backendId ?? 0), cattleCode: cow.code ?? '', penId: 0, penCode: cow.barn ?? '', hasWarnings: false, messages: [],
      })),
      occupancy: [],
    }
  },
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

export const saveHerdExit = (input: { id?: string; record: Partial<HerdExit>; cattleRows?: CattleInput[]; documents?: File[] }) => {
  if (usingBackend) return backendApi.save(input)
  const docs = (input.documents ?? []).map((file) => ({
    name: file.name,
    ext: file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf') ? 'PDF' : 'JPG',
    size: file.size,
  }))
  const existingDocs = input.record.draft?.docs ?? []
  const mergedDocs = docs.filter((file) => !existingDocs.some((document) => document.name === file.name && document.size === file.size))
  if (input.record.status === 'Đã xuất' && docs.length) {
    const detailDocs = input.record.detail?.docs ?? []
    const newDetailDocs = docs.filter((file) => !detailDocs.some((document) => document.name === file.name && document.size === file.size))
    return saveLocal({
      id: input.id,
      cattleRows: input.cattleRows,
      record: { ...input.record, detail: { ...input.record.detail, docs: [...detailDocs, ...newDetailDocs] }, draft: undefined },
    })
  }
  return saveLocal({
    id: input.id,
    cattleRows: input.cattleRows,
    record: mergedDocs.length
      ? { ...input.record, draft: { ...input.record.draft, docs: [...existingDocs, ...mergedDocs] } }
      : input.record,
  })
}

export const confirmHerdExit = async (id: string, expectedVersion: number): Promise<HerdExit> => {
  if (usingBackend) return backendApi.confirm(id, expectedVersion)
  const current = await localApi.get(id)
  return saveLocal({
    id,
    cattleRows: current.draft?.cows ?? [],
    record: { ...current, status: 'Đã xuất', draft: undefined },
  })
}

export const downloadExitAttachment = (id: string, attachmentId: number): Promise<Blob> => {
  if (!usingBackend) return Promise.reject(new Error('Tài liệu cục bộ không có bản tải riêng'))
  return backendApi.downloadAttachment(id, attachmentId)
}

export const removeExitAttachment = async (id: string, attachmentId: number): Promise<void> => {
  if (!usingBackend) throw new Error('Tài liệu cục bộ không có bản xóa riêng')
  await backendApi.removeAttachment(id, attachmentId)
}

export const cancelHerdExit = (id: string, cattleRows: CattleInput[], patch: Partial<HerdExit> = { status: 'Đã hủy' }) => usingBackend
  ? backendApi.voidVoucher(id, String(patch.cancelReason ?? 'Hủy phiếu xuất'))
  : cancelLocal(id, cattleRows, patch)

export const dismissHerdExit = (id: string, reason: string, expectedVersion?: number) => usingBackend
  ? backendApi.dismissVoucher(id, reason, expectedVersion)
  : localApi.update(id, { status: 'Đã bác', reason })

export const listSelectableExitCattle = async (): Promise<ExitCandidate[]> => {
  if (usingBackend) return backendApi.selectableCattle()

  // Keep the local prototype aligned with the canonical cattle collection.
  // A cow already linked to another exit voucher must not be offered again.
  const rows = await cattle.list()
  const available = new Set(rows
    .filter((row) => row.status === 'ACTIVE' && !row.exitVoucherId)
    .map((row) => row.code))
  return EXPORT_HERD
    .filter((row) => available.has(row.code))
    .map((row) => ({ ...row, unitPrice: 0 }))
}

export const listExitBuyers = () => usingBackend ? backendApi.buyers() : Promise.resolve(BUYERS)
