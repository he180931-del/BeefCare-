import { createCollection } from '../../../api/client.js'
import { registerEntryCattle, voidEntryCattle } from '../../../api/herdDomainApi.js'
import { initialImports } from '../data/importsData.js'

const nextEntryId = (rows) => {
  const max = Math.max(0, ...rows.map((row) => Number(String(row.id ?? '').split('-')[2]) || 0))
  return `PN-2026-${String(max + 1).padStart(4, '0')}`
}

const herdEntries = createCollection('herdEntries', initialImports, { nextId: nextEntryId })
const terminalStatuses = new Set(['Đã nhập', 'Đã hủy'])

const getExisting = async (id) => {
  try {
    return await herdEntries.get(id)
  } catch (error) {
    if (String(error.message).startsWith('Not found:')) return null
    throw error
  }
}

export const herdEntryApi = {
  list: (predicate) => herdEntries.list(predicate),
  get: (id) => herdEntries.get(id),
  create: (record) => herdEntries.create(record),
  update: async (id, patch) => {
    const current = await herdEntries.get(id)
    if (terminalStatuses.has(current.status) && patch.status !== current.status) {
      throw new Error(`Entry voucher is terminal: ${id}`)
    }
    return herdEntries.update(id, patch)
  },
  reset: () => herdEntries.reset(),
}

export async function saveHerdEntry({ id, record, cattleRows = [] }) {
  const current = id ? await getExisting(id) : null
  const voucherId = id ?? record.id
  if (current?.status === 'Đã nhập' && record.status !== 'Đã nhập') {
    throw new Error(`Entry voucher is terminal: ${voucherId}`)
  }
  if (record.status === 'Đã nhập') await registerEntryCattle(cattleRows, voucherId)
  return current ? herdEntries.update(voucherId, { ...record, id: voucherId }) : herdEntries.create({ ...record, ...(voucherId ? { id: voucherId } : {}) })
}

export async function voidHerdEntry(id, cattleRows, patch = { status: 'Đã hủy' }) {
  const current = await herdEntries.get(id)
  if (current.status === 'Đã hủy') return current
  await voidEntryCattle(cattleRows, id)
  return herdEntries.update(id, { ...patch, status: 'Đã hủy' })
}

