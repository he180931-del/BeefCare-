import { createCollection } from '../../../api/client.js'
import { cattle, pens, registerEntryCattle, voidEntryCattle } from '../../../api/herdDomainApi.js'
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

export const getEntryDraftState = (rows, id) => {
  const row = id ? rows.find((item) => item.id === id) : undefined
  return { ...(row?.draft ?? {}), type: row?.draft?.type ?? row?.type ?? 'Mua ngoài', row }
}

export async function saveHerdEntry({ id, record, cattleRows = [] }) {
  const current = id ? await getExisting(id) : null
  const voucherId = id ?? record.id ?? nextEntryId(await herdEntries.list())
  if (current && terminalStatuses.has(current.status)) {
    if (record.status === current.status) return current
    throw new Error(`Entry voucher is terminal: ${voucherId}`)
  }
  let nextRecord = { ...record, id: voucherId }
  if (record.status === 'Đã nhập') {
    if (!record.date || !record.type || !cattleRows.length) throw new Error('Entry posting requires date, type and cattle')
    await validateEntryCattle(cattleRows, voucherId, record)
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

const today = () => new Date().toISOString().slice(0, 10)

async function validateEntryCattle(rows, voucherId, record) {
  if (record.date > today()) throw new Error('Entry date cannot be in the future')
  const quarantine = record.detail?.quarantine ?? record.draft?.quarantine ?? record.quarantine
  if (record.type === 'Mua ngoài' && !String(quarantine ?? '').trim()) throw new Error('Entry requires quarantine document')

  const existing = await cattle.list()
  const existingLines = new Set(existing.filter((row) => row.entryVoucherId === voucherId).map((row) => row.entryLineNo))
  const seenTags = new Set()
  const seenCodes = new Set()
  const additions = new Map()
  for (const [index, row] of rows.entries()) {
    if (existingLines.has(index + 1)) continue
    if (!row.barn) throw new Error(`Entry cattle requires a pen: ${row.tag || index + 1}`)
    if (row.code) {
      if (seenCodes.has(row.code) || existing.some((item) => item.code === row.code)) throw new Error(`Duplicate cattle code: ${row.code}`)
      seenCodes.add(row.code)
    }
    const tag = String(row.tag ?? '').trim()
    if (tag) {
      if (seenTags.has(tag)) throw new Error(`Duplicate ear tag: ${tag}`)
      seenTags.add(tag)
      if (existing.some((item) => item.tag === tag && item.status !== 'VOIDED' && item.entryVoucherId !== voucherId)) {
        throw new Error(`Duplicate ear tag: ${tag}`)
      }
    }
    let pen
    try {
      pen = await pens.get(row.barn)
    } catch (error) {
      if (String(error.message).startsWith('Not found:')) throw new Error(`Unknown pen: ${row.barn}`)
      throw error
    }
    if (pen.status !== 'ACTIVE') throw new Error(`Pen inactive: ${row.barn}`)
    additions.set(row.barn, (additions.get(row.barn) ?? 0) + 1)
    if (pen.count + additions.get(row.barn) > pen.capacity) throw new Error(`Pen full: ${row.barn}`)
  }
}

export async function voidHerdEntry(id, cattleRows, patch = { status: 'Đã hủy' }) {
  const current = await herdEntries.get(id)
  if (current.status === 'Đã hủy') return current
  const linked = (await cattle.list()).filter((row) => row.entryVoucherId === id)
  const providedCodes = [...new Set((cattleRows ?? []).map((row) => row.code).filter(Boolean))]
  const linkedCodes = linked.map((row) => row.code)
  if (linked.length && (providedCodes.length !== linkedCodes.length || linkedCodes.some((code) => !providedCodes.includes(code)))) {
    throw new Error(`Entry cancellation requires all linked cattle: ${id}`)
  }
  if (linked.length) await voidEntryCattle(linked, id)
  return herdEntries.update(id, { ...patch, status: 'Đã hủy' })
}
