import { createCollection, type CollectionApi } from './client'
import { seedPens } from '../data/pensData'
import { canonicalCattle } from '../data/cattleData'
import { migrateHerdStorage } from './storageMigrations'
import { cattleSchema, penSchema } from './collectionSchemas'
import type { Cattle, Pen, PenCowLink, CattleInput } from '../types'

migrateHerdStorage()

export const cattle = createCollection<Cattle, 'code'>('cattle', canonicalCattle, { schema: cattleSchema })
export const pens = createCollection<Pen, 'code'>('pens', seedPens, { schema: penSchema })

export const errorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message: unknown }).message
    return typeof message === 'string' ? message : String(message)
  }
  return String(error)
}
const maybeGet = async <T extends Record<string, unknown>, K extends keyof T & string>(collection: Pick<CollectionApi<T, K>, 'get'>, id: unknown): Promise<T | null> => {
  try {
    return await collection.get(id)
  } catch (error) {
    if (errorMessage(error).startsWith('Not found:')) return null
    throw error
  }
}

const penCow = (row: Cattle): PenCowLink => [row.code, String(row.stage || row.status || 'ACTIVE')]

const updatePenOccupancy = async (code: string, delta: number, cow: Cattle, { remove = false }: { remove?: boolean } = {}) => {
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

const cattleDefaults = (row: Partial<Cattle> & Record<string, unknown>, code: string): Cattle => ({
  name: '',
  tag: row.tag ?? '',
  breed: row.breed ?? 'Chưa xác định',
  sex: row.sex ?? 'Cái',
  ageShort: row.ageMonths != null ? `${row.ageMonths}th` : '—',
  ageLong: row.ageMonths != null ? `${row.ageMonths} tháng` : '—',
  months: row.ageMonths ?? 0,
  barn: row.barn ?? null,
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

export async function registerEntryCattle(rows: CattleInput[], voucherId: string): Promise<Cattle[]> {
  let nextNumber = await nextCattleNumber()
  const existingRows = await cattle.list()
  const created = []
  for (const [index, input] of rows.entries()) {
    const previous = existingRows.find((row) => row.entryVoucherId === voucherId && row.entryLineNo === index + 1)
    if (previous) {
      created.push(previous)
      continue
    }
    if (!input.barn) throw new Error(`Missing pen: ${input.code ?? 'cattle'}`)
    const destination = await pens.get(input.barn)
    if (destination.status !== 'ACTIVE') throw new Error(`Pen inactive: ${input.barn}`)
    if (destination.count >= destination.capacity) throw new Error(`Pen full: ${input.barn}`)
    const code = input.code ?? `BC-${String(nextNumber++).padStart(6, '0')}`
    const cow = cattleDefaults({ ...input, entryVoucherId: voucherId, entryLineNo: index + 1 }, code)
    await cattle.upsert(cow)
    await updatePenOccupancy(cow.barn ?? (() => { throw new Error(`Cattle has no pen: ${cow.code}`) })(), 1, cow)
    created.push(cow)
  }
  return created
}

export async function confirmCattleExit(rows: CattleInput[], voucherId: string): Promise<void> {
  const existingRows = await cattle.list()
  const seen = new Set<string>()
  const plans: Array<{ existing: Cattle; input?: CattleInput; barn?: string; idempotent?: boolean }> = []
  const penChanges = new Map<string, { nextCount: number; pen: Pen }>()
  for (const input of rows) {
    if (!input?.code || seen.has(input.code)) throw new Error(`Duplicate exit cattle: ${input?.code ?? 'missing code'}`)
    seen.add(input.code)
    const existing = existingRows.find((row) => row.code === input.code)
    if (!existing) throw new Error(`Exit cattle not found: ${input.code}`)
    if (existing.exitVoucherId && existing.exitVoucherId !== voucherId) throw new Error(`Cattle linked to another exit voucher: ${input.code}`)
    if (existing.status === 'EXITED' && existing.exitVoucherId === voucherId) {
      plans.push({ existing, idempotent: true })
      continue
    }
    if (existing.status !== 'ACTIVE') throw new Error(`Cattle not active: ${input.code}`)
    if (!existing.barn) throw new Error(`Cattle has no pen: ${input.code}`)
    const pen = await pens.get(existing.barn)
    const nextCount = (penChanges.get(existing.barn)?.nextCount ?? pen.count) - 1
    if (nextCount < 0) throw new Error(`Pen occupancy violation: ${existing.barn}`)
    penChanges.set(existing.barn, { nextCount, pen })
    plans.push({ existing, input, barn: existing.barn })
  }

  for (const plan of plans) {
    if (plan.idempotent) continue
    const { existing, barn } = plan
    await cattle.update(existing.code, { lastPen: barn, status: 'EXITED', exitVoucherId: voucherId })
    if (!barn) throw new Error(`Cattle has no pen: ${existing.code}`)
    await updatePenOccupancy(barn, -1, existing, { remove: true })
  }
}

export async function cancelCattleExit(rows: CattleInput[], voucherId: string): Promise<void> {
  const existingRows = await cattle.list()
  const linked = existingRows.filter((row) => row.exitVoucherId === voucherId)
  const rawCodes = (rows ?? []).map((row) => row?.code).filter(Boolean)
  const providedCodes = [...new Set(rawCodes)]
  const linkedCodes = linked.map((row) => row.code)
  const restored = existingRows.filter((row) => row.lastExitVoucherId === voucherId)
  if (!linked.length && restored.length) {
    if (rawCodes.length === providedCodes.length && restored.length === providedCodes.length && restored.every((row) => providedCodes.includes(row.code))) return
    throw new Error(`Exit cancellation requires all linked cattle: ${voucherId}`)
  }
  if (!linked.length && !providedCodes.length) throw new Error(`Exit cancellation has no canonical cattle links: ${voucherId}`)
  if (rawCodes.length !== providedCodes.length) throw new Error(`Duplicate exit cattle: ${rawCodes[0]}`)
  if (linked.length !== providedCodes.length || linkedCodes.some((code) => !providedCodes.includes(code))) {
    throw new Error(`Exit cancellation requires all linked cattle: ${voucherId}`)
  }
  const plans: Array<{ cow: Cattle; barn: string }> = []
  const penChanges = new Map<string, { nextCount: number; pen: Pen }>()
  for (const cow of linked) {
    if (cow.status !== 'EXITED') throw new Error(`Cattle not exited: ${cow.code}`)
    const barn = cow.lastPen ?? cow.barn
    if (!barn) throw new Error(`Cattle has no pen: ${cow.code}`)
    const pen = await pens.get(barn)
    const nextCount = (penChanges.get(barn)?.nextCount ?? pen.count) + 1
    if (nextCount > pen.capacity) throw new Error(`Pen full: ${barn}`)
    penChanges.set(barn, { nextCount, pen })
    plans.push({ cow, barn })
  }
  for (const { cow, barn } of plans) {
    await cattle.update(cow.code, { status: 'ACTIVE', barn, exitVoucherId: null, lastExitVoucherId: voucherId })
    await updatePenOccupancy(barn, 1, { ...cow, barn })
  }
}

export async function voidEntryCattle(rows: CattleInput[], voucherId: string): Promise<void> {
  const candidates: Cattle[] = []
  for (const input of rows) {
    const cow = await maybeGet(cattle, input.code)
    if (cow?.status === 'VOIDED' && cow.entryVoucherId === voucherId) continue
    if (!cow || cow.entryVoucherId !== voucherId) throw new Error(`Entry cattle mismatch: ${input.code}`)
    if (cow.status !== 'ACTIVE') throw new Error(`Cattle not active: ${input.code}`)
    if ((cow.events ?? []).length) throw new Error(`Cattle has later events: ${input.code}`)
    if (!cow.barn) throw new Error(`Cattle has no pen: ${input.code}`)
    await pens.get(cow.barn)
    candidates.push(cow)
  }

  for (const cow of candidates) {
    if (!cow.barn) throw new Error(`Cattle has no pen: ${cow.code}`)
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

export async function moveCattle(code: string, { to, date, reason, by }: { to: string; date: string; reason: string; by: string }): Promise<Cattle> {
  const cow = await cattle.get(code)
  if (cow.status !== 'ACTIVE') throw new Error(`Cattle not active: ${code}`)
  if (cow.barn === to) return cow
  if (!cow.barn) throw new Error(`Cattle has no pen: ${code}`)
  const [fromPen, toPen] = await Promise.all([pens.get(cow.barn), pens.get(to)])
  if (toPen.status !== 'ACTIVE') throw new Error(`Pen inactive: ${to}`)
  if (toPen.count >= toPen.capacity) throw new Error(`Pen full: ${to}`)

  await updatePenOccupancy(fromPen.code, -1, cow, { remove: true })
  await updatePenOccupancy(toPen.code, 1, { ...cow, barn: to })
  const history = [{ from: date, to: '—', barn: toPen.name, reason, by }, ...(cow.barnHistory ?? []).map((row, index) => (index === 0 ? { ...row, to: date } : row))]
  return cattle.update(code, { barn: to, barnSince: date, barnTag: undefined, barnHistory: history })
}
