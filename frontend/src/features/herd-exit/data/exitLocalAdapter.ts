// Local demo adapter of herd exit. Reached only through src/demo/demoModules.ts; herdExitApi calls it in local mode.
import type { CattleInput } from '../../cattle'
import type { HerdExit } from '../types'
import type { ExitCandidate } from '../api/herdExitBackendApi'
import { cattle, pens } from '../../../demo/api/herdDomainApi'
import {
  cancelHerdExit as cancelLocal,
  herdExitApi as localApi,
  saveHerdExit as saveLocal,
} from '../api/herdExitLocalApi'
import { EXPORT_HERD, TODAY as DEMO_TODAY } from './exportsData'
import { BARNS, BUYERS } from './exitData'
import { BUSINESS_OFFSET, businessDateTime } from '../../../shared/lib/date/farmTime'

let localBuyers = BUYERS.map((buyer) => ({ ...buyer }))

export { cattle, localApi, pens, saveLocal, BUYERS }

export async function listBuyers() {
  return localBuyers.map((buyer) => ({ ...buyer }))
}

export async function saveBuyer(input: { name: string; phone: string; area?: string }) {
  const name = input.name.trim()
  const phone = input.phone.trim()
  if (!name) throw new Error('Tên người mua là bắt buộc.')
  const nextId = `b${localBuyers.length + 1}`
  const buyer = { id: nextId, name, phone, area: input.area?.trim() ?? '' }
  localBuyers = [...localBuyers, buyer]
  return { ...buyer }
}

export function resetBuyers() {
  localBuyers = BUYERS.map((buyer) => ({ ...buyer }))
}

/** Bò chọn được: theo collection bò chuẩn; bò đã gắn phiếu xuất khác không được chọn lại. */
export async function selectableCattle(): Promise<ExitCandidate[]> {
  const rows = await cattle.list()
  const available = new Set(rows
    .filter((row) => row.status === 'ACTIVE' && !row.exitVoucherId)
    .map((row) => row.code))
  return EXPORT_HERD
    .filter((row) => available.has(row.code))
    .map((row) => ({ ...row, unitPrice: 0 }))
}

/** "Chuồng giảm" theo chuồng của dữ liệu mẫu. */
export const penShift = (picked: ReadonlyArray<{ barn: string }>) => BARNS
  .map((pen) => ({ ...pen, out: picked.filter((cow) => cow.barn === pen.code).length }))
  .filter((pen) => pen.out)

/** Khoản thu mẫu theo Figma điền sẵn cho popup thu tiền. */
export const collectionDefaults = () => ({ date: DEMO_TODAY, reference: 'MBVCB.8841207 · LO MO HA DONG TT PX-2026-0007', note: 'Thu đủ phần còn lại' })

/** Lý do mẫu theo Figma điền sẵn cho popup hủy phiếu. */
export const cancelDefaults = () => ({ reason: 'Lò mổ trả lại 4 con do đổi lịch giết mổ' })

/** Hủy phiếu và ghi dòng lịch sử theo giờ trại; bản mô phỏng không biết tên người dùng nên ghi "Người dùng hiện tại". */
export function cancelExit(id: string, cattleRows: CattleInput[], patch: Partial<HerdExit>) {
  const line = { time: `${businessDateTime()}${BUSINESS_OFFSET}`, type: 'VOIDED', actor: 'Người dùng hiện tại', text: `Hủy phiếu: ${patch.cancelReason ?? ''}` }
  const detail = patch.detail ? { ...patch.detail, history: [...(patch.detail.history ?? []), line] } : patch.detail
  return cancelLocal(id, cattleRows, detail ? { ...patch, detail } : patch)
}
