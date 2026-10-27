import { initialExports } from '../data/exportsData'
import { createCollection } from './client'

// Mã phiếu xuất: PX-2026-0001, PX-2026-0002… (số lớn nhất + 1).
const nextExitId = (rows) => `PX-2026-${String(Math.max(0, ...rows.map((r) => Number(r.id.split('-')[2]))) + 1).padStart(4, '0')}`

const herdExits = createCollection('herdExits', initialExports, { nextId: nextExitId })

export const herdExitApi = herdExits
export const createHerdExit = (record) => herdExits.create(record)
export const updateHerdExit = ({ id, patch }) => herdExits.update(id, patch)
