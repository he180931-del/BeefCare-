// Local demo adapter of herd exit. Reached only through src/demo/demoModules.ts; herdExitApi calls it in local mode.
import type { CattleInput } from '../../cattle'
import type { HerdExit } from '../types'
import type { ExitCandidate } from '../api/herdExitBackendApi'
import { cattle, pens } from '../../../api/herdDomainApi'
import {
  cancelHerdExit as cancelLocal,
  herdExitApi as localApi,
  saveHerdExit as saveLocal,
} from '../api/herdExitLocalApi'
import { EXPORT_HERD, TODAY as DEMO_TODAY } from './exportsData'
import { BARNS, BUYERS } from './exitData'

export { cattle, localApi, pens, saveLocal, BUYERS }

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
export const collectionDefaults = () => ({ date: DEMO_TODAY, reference: 'MBVCB.8841207 · LO MO HA DONG TT PX-2026-0007', statement: true, note: 'Thu đủ phần còn lại', cashReference: 'PT-2210-01' })

/** Lý do mẫu theo Figma điền sẵn cho popup hủy phiếu. */
export const cancelDefaults = () => ({ reason: 'Lò mổ trả lại 4 con do đổi lịch giết mổ' })

/** Hủy phiếu và ghi dòng lịch sử với ngày và người làm của dữ liệu mẫu. */
export function cancelExit(id: string, cattleRows: CattleInput[], patch: Partial<HerdExit>) {
  const line = `22/10 ${new Date().toTimeString().slice(0, 5)} · N. V. Hùng hủy phiếu: ${patch.cancelReason ?? ''}`
  const detail = patch.detail ? { ...patch.detail, history: [...(patch.detail.history ?? []), line] } : patch.detail
  return cancelLocal(id, cattleRows, detail ? { ...patch, detail } : patch)
}
