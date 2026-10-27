import { initialExports } from '../data/exportsData.js'
import { createCollection } from './client.js'
import { cancelCattleExit, confirmCattleExit } from './herdDomainApi.js'

// Mã phiếu xuất: PX-2026-0001, PX-2026-0002… (số lớn nhất + 1).
const nextExitId = (rows) => `PX-2026-${String(Math.max(0, ...rows.map((r) => Number(r.id.split('-')[2]))) + 1).padStart(4, '0')}`

const herdExits = createCollection('herdExits', initialExports, { nextId: nextExitId })

export const herdExitApi = herdExits
export const createHerdExit = (record) => herdExits.create(record)
export const updateHerdExit = ({ id, patch }) => herdExits.update(id, patch)

export const getExitDraftState = (rows) => {
  const row = rows.find((item) => item.status === 'Nháp')
  return { ...(row?.draft ?? {}), type: row?.draft?.type ?? row?.type ?? 'Bán', row }
}

export async function saveHerdExit({ id, record, cattleRows = [] }) {
  const existing = await herdExits.list((row) => row.id === id)
  if (record.status === 'Đã xuất') await confirmCattleExit(cattleRows, id)
  return existing.length ? herdExits.update(id, record) : herdExits.create({ ...record, id })
}

export async function cancelHerdExit(id, cattleRows, patch) {
  await cancelCattleExit(cattleRows, id)
  return herdExits.update(id, patch)
}
