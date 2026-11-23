// Local demo adapter of herd entry. Reached only through src/demo/demoModules.ts; herdEntryApi calls it in local mode.
import type { CattleInput } from '../../cattle'
import type { EntryCalf, EntryCow, HerdEntry } from '../types'
import type { EntryBreedOption, EntryListFilters, EntryListView, EntryParentOption, EntryVaccineOption } from '../api/herdEntryBackendApi'
import { cattle, pens } from '../../../demo/api/herdDomainApi'
import {
  herdEntryApi as localApi,
  saveHerdEntry as saveLocal,
  voidHerdEntry as voidLocal,
} from '../api/herdEntryLocalApi'
import { SOURCES, initialCalves } from './entryData'
import { BREEDS, INITIAL_COWS, OLDER, SOURCE_FILTERS, TODAY as DEMO_TODAY } from './importsData'
import { PAY_METHODS } from '../constants/entryOptions'
import { dm } from '../../../shared/lib/format'
import { businessDateTime } from '../../../shared/lib/date/farmTime'
import { validateEntryHistory, type EntryHistory } from '../domain/entryHistory'

export { localApi, pens }

/** Explicit demo history edit; it does not simulate backend line IDs, versions or care records. */
export async function correctHistory(voucherCode: string, cattleCode: string, history: EntryHistory, reason: string): Promise<void> {
  if (!reason.trim() || reason.trim().length > 500) throw new Error('Vui lòng nhập lý do, tối đa 500 ký tự.')
  const record = await localApi.get(voucherCode)
  if (record.status !== 'Đã nhập' || record.entryType === 'FARM_BORN' || record.type === 'Bê sinh tại trại') throw new Error('Chỉ sửa khai báo của phiếu mua đã ghi sổ.')
  const line = record.detail?.cows?.find(item => item.code === cattleCode)
  if (!line) throw new Error('Không tìm thấy bò trong phiếu.')
  const female = line.sexCode === 'FEMALE' || /Cái/.test(line.sex ?? line.breed ?? '')
  const invalid = validateEntryHistory(history, female, record.date)
  if (invalid) throw new Error(invalid)
  await localApi.update(voucherCode, { detail: { ...record.detail,
    cows: record.detail!.cows!.map(item => item.code === cattleCode ? { ...item, hist: structuredClone(history) } : item),
    history: [...(record.detail?.history ?? []), `${businessDateTime()} · Sửa khai báo lịch sử ${cattleCode}: ${reason.trim()}`],
  } })
}

// Demo calves wait in memory until they are registered or marked dead.
let localCalves: EntryCalf[] = structuredClone(initialCalves).map((calf, index) => ({ ...calf, calfOutcomeId: index + 1 }))


const NO_OLDER = { total: 0, done: 0, drafts: 0, cancelled: 0, cows: 0, buyCows: 0, calfCows: 0, buyMoney: 0 }
export const localView = async (filters: EntryListFilters = {}): Promise<EntryListView> => {
  const all = await localApi.list()
  const kind = filters.type === 'FARM_BORN' ? 'Bê sinh tại trại' : filters.type === 'PURCHASE' ? 'Mua ngoài' : undefined
  const seller = filters.sellerName?.trim()
  const rows = all.filter((row) => {
    const sourceName = row.detail?.sourceName ?? row.source?.split(' · ')[0] ?? ''
    return (!kind || row.type === kind)
      && (!filters.from || (row.date ?? '') >= filters.from)
      && (!filters.to || (row.date ?? '') <= filters.to)
      && (!seller || sourceName === seller || sourceName.startsWith(`${seller} `))
  })
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


export function saveDraft(input: { id?: string; record: Partial<HerdEntry>; cattleRows?: CattleInput[]; documents?: File[] }) {
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

export const voidEntry = (id: string, cattleRows: CattleInput[], patch: Partial<HerdEntry>) => voidLocal(id, cattleRows, withDemoCancelHistory(patch))

/** Bản mô phỏng tự ghi dòng lịch sử hủy với ngày và người làm của dữ liệu mẫu. */
function withDemoCancelHistory(patch: Partial<HerdEntry>): Partial<HerdEntry> {
  if (!patch.detail || patch.cancelReason == null) return patch
  const line = `${dm(DEMO_TODAY)} ${new Date().toTimeString().slice(0, 5)} · T. Q. Long hủy phiếu: ${patch.cancelReason}`
  return { ...patch, detail: { ...patch.detail, history: [...(patch.detail.history ?? []), line] } }
}

export const pendingCalves = (): EntryCalf[] => structuredClone(localCalves)

export function markCalfDied(calfOutcomeId: number): EntryCalf {
  const calf = localCalves.find((row) => row.calfOutcomeId === calfOutcomeId)
  if (!calf) throw new Error('Không tìm thấy bê chờ xác nhận.')
  localCalves = localCalves.filter((row) => row !== calf)
  return structuredClone(calf)
}

export const sellers = () => structuredClone(SOURCES)
export const vaccines = (): EntryVaccineOption[] => [{ id: 1, code: 'LMLM', name: 'LMLM', available: true }, { id: 2, code: 'THT', name: 'Tụ huyết trùng', available: true }]
export const breeds = (): EntryBreedOption[] => BREEDS.map((name, index) => ({ id: index + 1, code: name, name, available: true }))
export const parentCattle = (): Promise<EntryParentOption[]> => cattle.list().then((rows) => rows
  .filter((row) => row.status === 'ACTIVE')
  .map((row, index) => ({ id: index + 1, code: row.code, sex: row.sex === 'Đực' ? 'MALE' as const : 'FEMALE' as const, name: row.name ?? row.code })))
export const sourceFilters = () => [...SOURCE_FILTERS]

/** Phiếu mẫu theo Figma điền sẵn cho phiếu nhập mới. */
export const newEntryDefaults = ({ isBuy, nextNumber }: { isBuy: boolean; nextNumber: number }): {
  recordId: string; date: string; quarantine: string; receiver: string; note: string; cows: EntryCow[]
  freight: number; paid: number; method: string; due: string
} => ({
  recordId: `PN-2026-${String(nextNumber).padStart(4, '0')}`, date: DEMO_TODAY, quarantine: 'KD-HN-2026-004512', receiver: 'Anh A',
  note: isBuy ? 'Khám ngoại hình bình thường, 1 con hơi gầy' : '', cows: INITIAL_COWS, freight: 1500000, paid: 40000000, method: PAY_METHODS[0], due: '2026-11-05',
})

/** Khoản thanh toán mẫu theo Figma điền sẵn cho popup ghi thanh toán. */
export const paymentDefaults = () => ({ date: DEMO_TODAY, ref: 'FT26295104721 · TT phieu PN-2026-0011', note: 'Thanh toán đủ phần còn lại', statement: true, by: 'T. Q. Long' })
