import { createCollection } from '../../../api/client.js'
import { cancelCattleExit, confirmCattleExit } from '../../../api/herdDomainApi.js'
import { initialExports } from '../data/exportsData.js'

const nextExitId = (rows) => {
  const max = Math.max(0, ...rows.map((row) => Number(String(row.id ?? '').split('-')[2]) || 0))
  return `PX-2026-${String(max + 1).padStart(4, '0')}`
}

const herdExits = createCollection('herdExits', initialExports, { nextId: nextExitId })
const terminalStatuses = new Set(['Đã xuất', 'Đã hủy', 'Đã bác'])

const getExisting = async (id) => {
  try {
    return await herdExits.get(id)
  } catch (error) {
    if (String(error.message).startsWith('Not found:')) return null
    throw error
  }
}

export const herdExitApi = {
  list: (predicate) => herdExits.list(predicate),
  get: (id) => herdExits.get(id),
  create: (record) => herdExits.create(record),
  update: async (id, patch) => {
    const current = await herdExits.get(id)
    if (terminalStatuses.has(current.status) && patch.status !== current.status) {
      throw new Error(`Exit voucher is terminal: ${id}`)
    }
    return herdExits.update(id, patch)
  },
  reset: () => herdExits.reset(),
}

export const getExitDraftState = (rows, id) => {
  const row = id ? rows.find((item) => item.id === id) : rows.find((item) => item.status === 'Nháp')
  return { ...(row?.draft ?? {}), type: row?.draft?.type ?? row?.type ?? 'Bán', row }
}

export async function saveHerdExit({ id, record, cattleRows = [] }) {
  const current = id ? await getExisting(id) : null
  const voucherId = id ?? record.id
  if (current && terminalStatuses.has(current.status) && record.status !== current.status) {
    throw new Error(`Exit voucher is terminal: ${voucherId}`)
  }
  if (record.status === 'Đã xuất') await confirmCattleExit(cattleRows, voucherId)
  return current ? herdExits.update(voucherId, { ...record, id: voucherId }) : herdExits.create({ ...record, ...(voucherId ? { id: voucherId } : {}) })
}

export async function cancelHerdExit(id, cattleRows, patch = { status: 'Đã hủy' }) {
  const current = await herdExits.get(id)
  if (current.status === 'Đã hủy') return current
  await cancelCattleExit(cattleRows, id)
  return herdExits.update(id, { ...patch, status: 'Đã hủy' })
}

