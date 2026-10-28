import { createCollection } from '../../../api/client'
import { cancelCattleExit, confirmCattleExit } from '../../../api/herdDomainApi'
import { initialExports } from '../data/exportsData'
import { errorMessage } from '../../../api/herdDomainApi'
import type { CattleInput, ExitDraft, ExitStatus, ExitType, HerdExit } from '../../../types'

const nextExitId = (rows: HerdExit[]): string => {
  const max = Math.max(0, ...rows.map((row) => Number(String(row.id ?? '').split('-')[2]) || 0))
  return `PX-2026-${String(max + 1).padStart(4, '0')}`
}

const herdExits = createCollection('herdExits', initialExports, { nextId: nextExitId })
const terminalStatuses = new Set(['Đã xuất', 'Đã hủy', 'Đã bác'])

const getExisting = async (id: string): Promise<HerdExit | null> => {
  try {
    return await herdExits.get(id)
  } catch (error) {
    if (errorMessage(error).startsWith('Not found:')) return null
    throw error
  }
}

export const herdExitApi = {
  list: (predicate?: (row: HerdExit) => boolean) => herdExits.list(predicate),
  get: (id: string) => herdExits.get(id),
  create: (record: Partial<HerdExit>) => herdExits.create(record),
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
