import { createCollection } from './client.js'
import { seedPens } from '../data/pensData.js'
import { migrateHerdStorage } from './storageMigrations.js'

migrateHerdStorage()

export const cattle = createCollection('cattle', [], { idKey: 'code' })
export const pens = createCollection('pens', seedPens, { idKey: 'code' })

const maybeGet = async (collection, id) => {
  try {
    return await collection.get(id)
  } catch (error) {
    if (String(error.message).startsWith('Not found:')) return null
    throw error
  }
}

const penCow = (row) => [row.code, row.stage || row.status || 'ACTIVE']

const updatePenOccupancy = async (code, delta, cow, { remove = false } = {}) => {
  const row = await pens.get(code)
  const nextCount = row.count + delta
  if (nextCount < 0 || nextCount > row.capacity) throw new Error(`Pen capacity violation: ${code}`)
  const current = row.cows ?? []
  const cows = remove
    ? current.filter(([cowCode]) => cowCode !== cow.code)
    : current.some(([cowCode]) => cowCode === cow.code) ? current : [...current, penCow(cow)]
  return pens.update(code, { count: nextCount, cows })
}

const nextCattleNumber = async () => {
  const cattleRows = await cattle.list()
  const penRows = await pens.list()
  const codes = [...cattleRows.map((row) => row.code), ...penRows.flatMap((row) => (row.cows ?? []).map(([code]) => code))]
  return Math.max(0, ...codes.map((code) => Number(String(code).match(/BC-(\d+)$/)?.[1] ?? 0))) + 1
}

const cattleDefaults = (row, code) => ({
  code,
  name: '',
  tag: row.tag ?? '',
  breed: row.breed ?? 'Chưa xác định',
  sex: row.sex ?? 'Cái',
  ageShort: row.ageMonths != null ? `${row.ageMonths}th` : '—',
  ageLong: row.ageMonths != null ? `${row.ageMonths} tháng` : '—',
  months: row.ageMonths ?? 0,
  barn: row.barn,
  purpose: row.purpose ?? 'Chưa xác định',
  stage: row.stage ?? row.group ?? 'Chưa xác định',
  status: 'ACTIVE',
  inList: true,
  weight: row.weight ?? null,
  weightEst: Boolean(row.estimated),
  weightDate: row.date ?? '',
  health: null,
  repro: null,
  headerBadges: [['Khỏe mạnh', 'ok']],
  qr: `QR-${code.slice(-4)}`,
  qrHistory: [],
  barnHistory: [],
  events: [],
  care: { last: row.weight == null ? '—' : `${row.weight} kg`, adg: '—', bcs: '—', healthCase: 'Không có ca mở', repro: '—', vaccine: { label: 'Chưa có dữ liệu' }, reminders: [] },
  ...row,
  code,
})

export async function registerEntryCattle(rows, voucherId) {
  let nextNumber = await nextCattleNumber()
  const existingRows = await cattle.list()
  const created = []
  for (const [index, input] of rows.entries()) {
    const previous = existingRows.find((row) => row.entryVoucherId === voucherId && row.entryLineNo === index + 1)
    if (previous) {
      created.push(previous)
      continue
    }
    const destination = await pens.get(input.barn)
    if (destination.status !== 'ACTIVE') throw new Error(`Pen inactive: ${input.barn}`)
    if (destination.count >= destination.capacity) throw new Error(`Pen full: ${input.barn}`)
    const code = input.code ?? `BC-${String(nextNumber++).padStart(6, '0')}`
    const cow = cattleDefaults({ ...input, entryVoucherId: voucherId, entryLineNo: index + 1 }, code)
    await cattle.upsert(cow)
    await updatePenOccupancy(cow.barn, 1, cow)
    created.push(cow)
  }
  return created
}

export async function confirmCattleExit(rows, voucherId) {
  for (const input of rows) {
    const existing = await maybeGet(cattle, input.code)
    if (existing?.status === 'EXITED' && existing.exitVoucherId === voucherId) continue
    const cow = cattleDefaults({ ...input, ...(existing ?? {}), exitVoucherId: voucherId }, input.code)
    const barn = existing?.barn ?? input.barn
    await cattle.upsert({ ...cow, barn, lastPen: barn, status: 'EXITED', exitVoucherId: voucherId })
    await updatePenOccupancy(barn, -1, cow, { remove: true })
  }
}

export async function cancelCattleExit(rows, voucherId) {
  for (const input of rows) {
    const cow = await maybeGet(cattle, input.code)
    if (!cow || cow.status !== 'EXITED' || cow.exitVoucherId !== voucherId) continue
    const barn = cow.lastPen ?? input.barn
    await cattle.update(cow.code, { status: 'ACTIVE', barn, exitVoucherId: null })
    await updatePenOccupancy(barn, 1, { ...cow, barn })
  }
}

export async function voidEntryCattle(rows, voucherId) {
  const candidates = []
  for (const input of rows) {
    const cow = await maybeGet(cattle, input.code)
    if (cow?.status === 'VOIDED' && cow.entryVoucherId === voucherId) continue
    if (!cow || cow.entryVoucherId !== voucherId) throw new Error(`Entry cattle mismatch: ${input.code}`)
    if (cow.status !== 'ACTIVE') throw new Error(`Cattle not active: ${input.code}`)
    if ((cow.events ?? []).length) throw new Error(`Cattle has later events: ${input.code}`)
    await pens.get(cow.barn)
    candidates.push(cow)
  }

  for (const cow of candidates) {
    await updatePenOccupancy(cow.barn, -1, cow, { remove: true })
    await cattle.update(cow.code, {
      status: 'VOIDED',
      lastPen: cow.barn,
      barn: null,
      voidVoucherId: voucherId,
      qrHistory: (cow.qrHistory ?? []).map((tag) => tag.status === 'ACTIVE' ? { ...tag, status: 'REVOKED' } : tag),
    })
  }
}

export async function moveCattle(code, { to, date, reason, by }) {
  const cow = await cattle.get(code)
  if (cow.status !== 'ACTIVE') throw new Error(`Cattle not active: ${code}`)
  if (cow.barn === to) return cow
  const [fromPen, toPen] = await Promise.all([pens.get(cow.barn), pens.get(to)])
  if (toPen.status !== 'ACTIVE') throw new Error(`Pen inactive: ${to}`)
  if (toPen.count >= toPen.capacity) throw new Error(`Pen full: ${to}`)

  await updatePenOccupancy(fromPen.code, -1, cow, { remove: true })
  await updatePenOccupancy(toPen.code, 1, { ...cow, barn: to })
  const history = [{ from: date, to: '—', barn: toPen.name, reason, by }, ...(cow.barnHistory ?? []).map((row, index) => (index === 0 ? { ...row, to: date } : row))]
  return cattle.update(code, { barn: to, barnSince: date, barnTag: undefined, barnHistory: history })
}
