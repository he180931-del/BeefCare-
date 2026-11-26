import type { CattleInput } from '../../cattle'
import type { ExitBuyer, ExitBuyerInput, ExitCommandOutcome, ExitListQuery, ExitListResult, ExitVoidOutcome, HerdExit } from '../types'
import type { ExitPayment } from '../types'
import { activeFarmId } from '../../../app/session/currentFarm'
import { backendMode } from '../../../shared/config/runtime'
import { backendTransport } from '../../../shared/api/backendTransport'
import { createHerdExitBackendApi, type ExitCandidate, type ExitChecks, type ExitVoidCheck, type ExitVoidSelections } from './herdExitBackendApi'
import { businessDate } from '../../../shared/lib/date/farmTime'
import { getExitDraftState } from '../domain/exitDraft'
import { localExitListResult } from '../domain/exitListPeriod'
import { demo } from '../../../demo/demoModules'
import { requireVersion, type VoucherPaymentSnapshot, type VoucherSnapshot } from '../../../shared/api/snapshotVersion'
import type { Pen } from '../../pen-management'
import type { Cattle } from '../../cattle'
import type { VoidVoucherPaymentInput } from '../../../shared/domain/voucherPayment'

const backendApi = createHerdExitBackendApi({ transport: backendTransport, farmId: activeFarmId })
const usingBackend = backendMode === 'backend'

export const exitPaymentVoidEnabled = usingBackend
export const voidExitPayment = (paymentId: number, input: VoidVoucherPaymentInput) => usingBackend
  ? backendApi.voidPayment(paymentId, input)
  : Promise.reject(new Error('Chế độ demo chưa hỗ trợ hủy thanh toán'))

export { getExitDraftState }

export const herdExitApi = {
  list: async (predicate?: (row: HerdExit) => boolean) => {
    const rows = usingBackend ? await backendApi.list() : await demo.exitLocal.localApi.list()
    return predicate ? rows.filter(predicate) : rows
  },
  /** SCR-41 page: rows, tiles and status counts of the period and type (server-computed in backend mode). */
  listPage: async (query: ExitListQuery = {}): Promise<ExitListResult> => usingBackend
    ? backendApi.listPage(query)
    : localExitListResult(await demo.exitLocal.localApi.list(), query, businessDate()),
  get: (id: string) => usingBackend ? backendApi.get(id) : demo.exitLocal.localApi.get(id),
  checks: async (id: string): Promise<ExitChecks> => {
    if (usingBackend) return backendApi.checks(id)
    const row = await demo.exitLocal.localApi.get(id)
    return {
      voucherId: Number(row.backendId ?? 0), code: row.id, version: Number(row.version ?? 0), exitDate: row.date ?? '',
      cattle: (row.draft?.cows ?? row.detail?.cows ?? []).map((cow) => ({
        cattleId: Number(cow.backendId ?? 0), cattleCode: cow.code ?? '', penId: 0, penCode: cow.barn ?? '', hasWarnings: false, messages: [],
      })),
      occupancy: [],
    }
  },
  create: (record: Omit<HerdExit, 'id'> & Partial<Pick<HerdExit, 'id'>>) => usingBackend
    ? backendApi.save({ record })
    : demo.exitLocal.localApi.create(record),
  update: async (id: string, patch: Partial<HerdExit>, snapshot?: VoucherSnapshot) => {
    if (!usingBackend) return demo.exitLocal.localApi.update(id, patch)
    const expectedVersion = requireVersion(snapshot?.expectedVersion)
    const current = await backendApi.get(id)
    return backendApi.save({ id, expectedVersion, record: { ...current, ...patch, draft: patch.draft ?? current.draft, detail: patch.detail ?? current.detail }, cattleRows: patch.draft?.cows ?? current.draft?.cows ?? [] })
  },
  reset: () => usingBackend ? Promise.resolve([] as HerdExit[]) : demo.exitLocal.localApi.reset(),
  recordPayment: (id: string, payment: Pick<ExitPayment, 'date' | 'amount' | 'method' | 'ref'> & { note?: string }, snapshot?: VoucherPaymentSnapshot) => usingBackend
    ? backendApi.recordPayment(id, payment, snapshot ?? { voucherVersion: undefined })
    : demo.exitLocal.localApi.get(id).then((row) => demo.exitLocal.localApi.update(id, {
      due: Math.max((row.due ?? 0) - payment.amount, 0),
      detail: { ...row.detail, payments: [...(row.detail?.payments ?? []), { by: 'Người dùng hiện tại', ...payment }] },
    })),
}

export const saveHerdExit = (input: { id?: string; expectedVersion?: number; record: Partial<HerdExit>; cattleRows?: CattleInput[]; documents?: File[] }) => {
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
    return demo.exitLocal.saveLocal({
      id: input.id,
      cattleRows: input.cattleRows,
      record: { ...input.record, detail: { ...input.record.detail, docs: [...detailDocs, ...newDetailDocs] }, draft: undefined },
    })
  }
  return demo.exitLocal.saveLocal({
    id: input.id,
    cattleRows: input.cattleRows,
    record: mergedDocs.length
      ? { ...input.record, draft: { ...input.record.draft, docs: [...existingDocs, ...mergedDocs] } }
      : input.record,
  })
}

/** Confirms a voucher and keeps the server's success text (MSG-FE13-02) for the next screen. */
export const confirmHerdExitOutcome = async (id: string, expectedVersion: number | undefined): Promise<ExitCommandOutcome> => {
  if (usingBackend) return backendApi.confirmOutcome(id, expectedVersion)
  const voucher = await confirmHerdExit(id, expectedVersion)
  return { voucher, message: '' }
}

export const confirmHerdExit = async (id: string, expectedVersion: number | undefined): Promise<HerdExit> => {
  if (usingBackend) return backendApi.confirm(id, expectedVersion)
  const current = await demo.exitLocal.localApi.get(id)
  return demo.exitLocal.saveLocal({
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

/** Voids a confirmed voucher (A10); the result carries MSG-FE13-05 and the per-cattle review list. Local mode has no review list. */
export const cancelHerdExit = async (id: string, cattleRows: CattleInput[], patch: Partial<HerdExit> = { status: 'Đã hủy' }, snapshot?: VoucherSnapshot & ExitVoidSelections): Promise<ExitVoidOutcome> => usingBackend
  ? backendApi.voidVoucher(id, { ...snapshot, expectedVersion: snapshot?.expectedVersion, reason: String(patch.cancelReason ?? 'Hủy phiếu xuất') })
  : { voucher: await demo.exitLocal.cancelExit(id, cattleRows, patch), message: '', reviewList: [] }

/** Dismisses a pending death / loss proposal (A9); the result carries MSG-FE13-04 / MSG-FE13-10. */
export const dismissHerdExit = async (id: string, reason: string, expectedVersion: number | undefined, backendId?: number): Promise<ExitCommandOutcome> => usingBackend
  ? backendApi.dismissVoucher(id, reason, expectedVersion, backendId)
  : { voucher: await demo.exitLocal.localApi.update(id, { status: 'Đã bác', reason, cancelReason: reason }), message: '' }

export const listSelectableExitCattle = async (): Promise<ExitCandidate[]> => {
  return usingBackend ? backendApi.selectableCattle() : demo.exitLocal.selectableCattle()
}

export const listExitBuyers = (): Promise<ExitBuyer[]> => usingBackend ? backendApi.buyers() : demo.exitLocal.listBuyers()

export const saveExitBuyer = (input: ExitBuyerInput, options?: { key?: string }): Promise<ExitBuyer> => usingBackend
  ? backendApi.saveBuyer(input, options)
  : demo.exitLocal.saveBuyer(input)

/** Mã phiếu hiển thị trước khi lưu: máy chủ cấp khi lưu (undefined); bản mô phỏng tự đánh số tiếp theo. */
export const newExitVoucherId = (rows: ReadonlyArray<{ id: string }>): string | undefined => usingBackend
  ? undefined
  : `PX-2026-${String(Math.max(0, ...rows.map((row) => Number(row.id.split('-')[2]) || 0)) + 1).padStart(4, '0')}`

export type ExitPenShift = { code: string; name: string; count: number | null; out: number }

/**
 * "Chuồng giảm" của phiếu xuất: sĩ số trước khi xuất lấy từ bò ứng viên mà máy chủ trả (penCount), không suy từ chuồng
 * mẫu; bản mô phỏng dùng chuồng của dữ liệu mẫu.
 */
export function exitPenShift(picked: ReadonlyArray<{ barn: string; penCount?: number }>): ExitPenShift[] {
  if (!usingBackend) return demo.exitLocal.penShift(picked)
  const shift = new Map<string, ExitPenShift>()
  for (const cow of picked) {
    if (!cow.barn) continue
    const row = shift.get(cow.barn) ?? { code: cow.barn, name: cow.barn, count: cow.penCount ?? null, out: 0 }
    row.out += 1
    shift.set(cow.barn, row)
  }
  return [...shift.values()]
}

/** Giá trị ban đầu của popup thu tiền phiếu xuất; bản mô phỏng điền sẵn khoản thu mẫu theo Figma. */
export function exitCollectionDefaults(): { date: string; reference: string; note: string } {
  return usingBackend
    ? { date: businessDate(), reference: '', note: '' }
    : demo.exitLocal.collectionDefaults()
}

/** Giá trị ban đầu của popup hủy phiếu xuất; máy chủ thật bắt đầu không có lý do. */
export const exitCancelDefaults = (): { reason: string } => (usingBackend ? { reason: '' } : demo.exitLocal.cancelDefaults())

export const exitVoidCheck = (id: string, backendId?: number): Promise<ExitVoidCheck | null> => usingBackend ? backendApi.voidCheck(id, backendId) : Promise.resolve(null)

/** Canonical occupancy for replacement choices; the server rechecks when voiding. */
export const listExitCancelPens = (): Promise<Pen[] | null> => (usingBackend ? backendApi.listPens() : demo.exitLocal.pens.list())

/**
 * Bò của phiếu còn gắn với phiếu hay không, điều kiện để hủy. Máy chủ thật tự kiểm khi hủy (`serverChecked`); bản mô phỏng
 * đối chiếu collection bò chuẩn.
 */
export const exitCancelLinks = async (): Promise<{ serverChecked: true } | { serverChecked: false; cattle: Cattle[] }> => (usingBackend
  ? { serverChecked: true }
  : { serverChecked: false, cattle: await demo.exitLocal.cattle.list() })
