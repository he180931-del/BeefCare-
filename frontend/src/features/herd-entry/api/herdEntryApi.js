import { createCollection } from '../../../api/client.js'
import { cattle, registerEntryCattle, voidEntryCattle } from '../../../api/herdDomainApi.js'
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
    if (terminalStatuses.has(current.status)) {
      throw new Error(`Entry voucher is terminal: ${id}`)
    }
    return herdEntries.update(id, patch)
  },
  reset: () => herdEntries.reset(),
}

export async function saveHerdEntry({ id, record, cattleRows = [] }) {
  const current = id ? await getExisting(id) : null
  const voucherId = id ?? record.id ?? nextEntryId(await herdEntries.list())
  if (current?.status === 'Đã nhập') {
    if (record.status === current.status) return current
    throw new Error(`Entry voucher is terminal: ${voucherId}`)
  }
  let nextRecord = { ...record, id: voucherId }
  if (record.status === 'Đã nhập') {
    if (!record.date || !record.type || !cattleRows.length) throw new Error('Entry posting requires date, type and cattle')
    const registered = await registerEntryCattle(cattleRows, voucherId)
    const generatedCows = registered.map((cow) => ({ code: cow.code, tag: cow.tag, breed: `${cow.breed} · ${cow.sex}`, weight: cow.weight, barn: cow.barn, current: `${cow.status} · ${cow.barn}`, amount: 0 }))
    nextRecord = {
      ...nextRecord,
      detail: {
        ...(record.detail ?? {}),
        cows: record.detail?.cows?.length ? record.detail.cows : generatedCows,
        cowsTotal: record.detail?.cowsTotal ?? 0,
        payments: record.detail?.payments ?? [],
        docs: record.detail?.docs ?? [],
        history: record.detail?.history ?? [],
      },
    }
  }
  return current ? herdEntries.update(voucherId, nextRecord) : herdEntries.create(nextRecord)
}

export async function voidHerdEntry(id, cattleRows, patch = { status: 'Đã hủy' }) {
  const current = await herdEntries.get(id)
  if (current.status === 'Đã hủy') return current
  const linked = []
  for (const row of cattleRows) {
    try {
      const cow = await cattle.get(row.code)
      if (cow.entryVoucherId === id) linked.push(row)
    } catch (error) {
      if (!String(error.message).startsWith('Not found:')) throw error
    }
  }
  if (linked.length) await voidEntryCattle(linked, id)
  return herdEntries.update(id, { ...patch, status: 'Đã hủy' })
}
