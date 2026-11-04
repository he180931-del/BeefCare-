import { createCollection, type NewCollectionInput } from '../../../api/client'
import { cancelCattleExit, confirmCattleExit } from '../../../api/herdDomainApi'
import { expandLocalTable, isStressGenerated, type StressGeneratedRow } from '../../../app/localStressData'
import { initialExports } from '../data/exportsData'
import { errorMessage } from '../../../api/herdDomainApi'
import { herdExitSchema } from '../../../api/collectionSchemas'
import type { CattleInput, ExitDraft, ExitStatus, ExitType, HerdExit } from '../../../types'

const nextExitId = (rows: HerdExit[]): string => {
  const max = Math.max(0, ...rows.map((row) => Number(String(row.id ?? '').split('-')[2]) || 0))
  return `PX-2026-${String(max + 1).padStart(4, '0')}`
}

const herdExits = createCollection('herdExits', initialExports, { schema: herdExitSchema, nextId: nextExitId })
const terminalStatuses = new Set(['Đã xuất', 'Đã hủy', 'Đã bác'])
const completedTemplate = initialExports.find((row) => row.id === 'PX-2026-0007') ?? initialExports[0]

const stressExit = (row: HerdExit & StressGeneratedRow): HerdExit => {
  if (!isStressGenerated(row)) return row
  const sequence = (row.__stressIndex ?? 0) + 1
  const count = 1 + (sequence % 5)
  const unitPrice = 88_000 + (sequence % 6) * 1_000
  const cows = Array.from({ length: count }, (_, index) => {
    const weight = 315 + ((sequence * 17 + index * 11) % 58)
    return {
      code: `BC-X${String(sequence).padStart(4, '0')}-${index + 1}`,
      tag: `VN-X${String(sequence * 10 + index).padStart(5, '0')}`,
      breed: ['Zebu đỏ · Đực', 'Lai Sind · Đực', 'Brahman lai · Đực'][(sequence + index) % 3],
      weight,
      barn: ['B1 – Vỗ béo', 'C1 – Bò tơ'][(sequence + index) % 2],
      amount: weight * unitPrice,
    }
  })
  const totalWeight = cows.reduce((sum, cow) => sum + cow.weight, 0)
  const total = cows.reduce((sum, cow) => sum + cow.amount, 0)
  const day = String(1 + (sequence % 28)).padStart(2, '0')
  const buyer = ['Lò mổ Hà Đông', 'HTX chăn nuôi Ba Vì', 'Thương lái Nguyễn Văn Phúc – Sơn Tây'][sequence % 3]
  const detail = completedTemplate.detail && !completedTemplate.detail.death ? {
    ...completedTemplate.detail,
    buyer,
    cows,
    cowsTotal: total,
    payments: [{ date: `${day}/10/2026`, by: 'Nguyễn Văn Hùng', method: sequence % 2 ? 'Chuyển khoản' : 'Tiền mặt', ref: `PX-STRESS-${sequence}`, amount: total }],
    history: [`${day}/10 07:30 · Nguyễn Văn Hùng xác nhận xuất ${count} con`, `${day}/10 07:31 · Hệ thống hoàn tất cập nhật đàn và chuồng`],
  } : undefined
  return {
    ...row,
    date: `2026-10-${day}`,
    type: 'Bán',
    who: buyer,
    sub: `${count} con · dữ liệu mô phỏng tải lớn`,
    count,
    weight: `${totalWeight.toLocaleString('vi-VN')} kg`,
    total,
    due: 0,
    dueNote: undefined,
    status: 'Đã xuất',
    draft: undefined,
    detail,
  }
}

const expandedHerdExits = async (): Promise<HerdExit[]> => expandLocalTable('herd-exit-vouchers', await herdExits.list()).map(stressExit)

const getExisting = async (id: string): Promise<HerdExit | null> => {
  try {
    return await herdExits.get(id)
  } catch (error) {
    if (errorMessage(error).startsWith('Not found:')) return null
    throw error
  }
}

export const herdExitApi = {
  list: async (predicate?: (row: HerdExit) => boolean) => {
    const rows = await expandedHerdExits()
    return predicate ? rows.filter(predicate) : rows
  },
  get: async (id: string) => {
    try {
      return await herdExits.get(id)
    } catch (error) {
      if (!errorMessage(error).startsWith('Not found:')) throw error
      const row = (await expandedHerdExits()).find((item) => item.id === id)
      if (row) return row
      throw error
    }
  },
  create: (record: NewCollectionInput<HerdExit, 'id'>) => herdExits.create(record),
  update: async (id: string, patch: Partial<HerdExit>) => {
    const current = await herdExits.get(id)
    if (terminalStatuses.has(current.status) && patch.status && patch.status !== current.status) {
      throw new Error(`Exit voucher is terminal: ${id}`)
    }
    return herdExits.update(id, patch)
  },
  reset: () => herdExits.reset(),
}

export const getExitDraftState = (rows: HerdExit[], id?: string): ExitDraft & { row?: HerdExit } => {
  const row = id ? rows.find((item) => item.id === id) : rows.find((item) => item.status === 'Nháp')
  return { ...(row?.draft ?? {}), type: row?.draft?.type ?? row?.type ?? 'Bán', row }
}

type ExitSaveRecord = Partial<HerdExit> & { status?: ExitStatus; type?: ExitType }
export async function saveHerdExit({ id, record, cattleRows = [] }: { id?: string; record: ExitSaveRecord; cattleRows?: CattleInput[] }): Promise<HerdExit> {
  const current = id ? await getExisting(id) : null
  const voucherId = id ?? record.id ?? nextExitId(await herdExits.list())
  if (current && terminalStatuses.has(current.status)) {
    if (record.status === current.status) return current
    throw new Error(`Exit voucher is terminal: ${voucherId}`)
  }
  if (record.status === 'Đã xuất') {
    if (!record.date || !record.type || !cattleRows.length) throw new Error('Exit confirmation requires date, type and cattle')
    if (record.type !== 'Bán' && !(record.note || record.reason || record.who)) throw new Error('Exit confirmation requires a reason or note')
    const blocked = cattleRows.find((row) => row.withdrawalUntil && record.date && record.date < row.withdrawalUntil)
    if (blocked) throw new Error(`Withdrawal period active: ${blocked.code}`)
    await confirmCattleExit(cattleRows, voucherId)
  }
  return current ? herdExits.update(voucherId, { ...record, id: voucherId }) : herdExits.create({ ...record, id: voucherId })
}

export async function cancelHerdExit(id: string, cattleRows: CattleInput[], patch: Partial<HerdExit> = { status: 'Đã hủy' }): Promise<HerdExit> {
  const current = await herdExits.get(id)
  if (current.status === 'Đã hủy' || current.status === 'Đã bác') return current
  await cancelCattleExit(cattleRows, id)
  return herdExits.update(id, { ...patch, status: 'Đã hủy' })
}
