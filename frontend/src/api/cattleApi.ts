import { createCollection } from './client'
import { MANAGER, TODAY, initialCows, newQrCode, type CowSeed } from '../data/cowsData'
import { dm, dmy } from '../data/format'
import { moveCattle, pens } from './herdDomainApi'
import { cattleSchema } from './collectionSchemas'
import type { Cattle, CattleEvent, Pen, QrHistoryRow, Tone } from '../types'

// Bò và chuồng dùng đúng hai collection chung của toàn bộ các luồng nghiệp vụ.
const cattle = createCollection<Cattle, 'code'>('cattle', initialCows, { schema: cattleSchema })

const isCowSeed = (cow: Cattle): cow is CowSeed => Boolean(cow.ageLong && cow.stage && cow.purpose && cow.qr && cow.care)
const asCowSeed = (cow: Cattle): CowSeed => {
  if (!isCowSeed(cow)) throw new Error(`Incomplete cattle profile: ${cow.code}`)
  return cow
}

const event = (cat: string, at: string, title: string, badge: { label: string; tone: Tone }, detail: string, meta: string): CattleEvent => ({ id: `ev-${Date.now()}`, at, cat, title, badge, detail, meta })

const getActiveCow = async (code: string): Promise<CowSeed> => {
  const cow = asCowSeed(await cattle.get(code))
  if (cow.status !== 'ACTIVE') throw new Error(`Cattle not active: ${code}`)
  return cow
}

export const listCows = async (): Promise<CowSeed[]> => (await cattle.list()).filter(isCowSeed)
export const listBarns = () => pens.list()

/** Hồ sơ một bò kèm danh sách chuồng (để hiển thị tiêu chí và sức chứa). */
export async function loadProfile(code: string): Promise<{ cow: CowSeed; barns: Pen[] }> {
  const [cow, barnRows] = await Promise.all([cattle.get(code), pens.list()])
  return { cow: asCowSeed(cow), barns: barnRows }
}

export const updateIdentity = async (code: string, { name, tag, description }: { name: string; tag?: string; description?: string }) => {
  await getActiveCow(code)
  return cattle.update(code, { name, tag, description })
}

export async function updateStage(code: string, { stage, date, reason }: { stage: string; date: string; reason: string }) {
  const cow = await getActiveCow(code)
  const change = event('stage', `${date}T08:00`, `Đổi giai đoạn: ${cow.stage} → ${stage}`, { label: 'Thực tế', tone: 'ok' }, reason, `Hiệu lực ${dm(date)} · ghi ${dm(TODAY)} · ${MANAGER}`)
  return cattle.update(code, { stage, events: [change, ...(cow.events ?? [])] })
}

export async function moveBarn(code: string, { to, date, reason, by }: { to: string; date: string; reason: string; by: string }) {
  const cow = await getActiveCow(code)
  const from = cow.barn
  if (from === to) return cow
  const moved = await moveCattle(code, { to, date, reason, by })
  const d = dmy(date)
  const change = event('barn', `${date}T08:00`, `Chuyển chuồng ${from} → ${to}`, { label: 'Thực tế', tone: 'ok' }, reason, `Hiệu lực ${dm(date)} · ghi ${dm(TODAY)} · ${by}`)
  return cattle.update(code, {
    barnSince: d,
    barnHistory: (moved.barnHistory ?? []).map((row, index) => index === 0 ? { ...row, from: d } : row.to === date ? { ...row, to: d } : row),
    events: [change, ...(cow.events ?? [])],
  })
}

export async function reissueQr(code: string, { reason, note, by }: { reason: string; note: string; by: string }) {
  const cow = await getActiveCow(code)
  const newCode = newQrCode({ code: cow.code, qrHistory: cow.qrHistory ?? [] })
  const change = event('qr', `${TODAY}T08:00`, 'Cấp lại thẻ QR', { label: 'Thực tế', tone: 'ok' }, note || reason, `Hiệu lực ${dm(TODAY)} · ghi ${dm(TODAY)} · ${by}`)
  return cattle.update(code, {
    qr: newCode,
    qrHistory: [
      { code: newCode, status: 'ACTIVE', from: '10/2026', to: '—', reason, by },
      ...(cow.qrHistory ?? []).map((q): QrHistoryRow => (q.status === 'ACTIVE' ? { ...q, status: 'REPLACED', to: '10/2026' } : q)),
    ],
    events: [change, ...(cow.events ?? [])],
  })
}

export async function editImportRecord(code: string, { values, reason }: { values: Record<string, string>; reason: string }) {
  const cow = await getActiveCow(code)
  if (!cow.importRecord) return cow
  let weight = cow.weight
  const fields = cow.importRecord.fields.map(([key, label, current, next]): [string, string, string, string] => {
    const v = values[key]
    if (!v || v === '—' || v === current) return [key, label, current, next]
    if (key === 'weight') weight = parseFloat(v.replace(',', '.'))
    return [key, label, v, next]
  })
  const change = event('barn', `${TODAY}T08:00`, 'Sửa bản ghi nhập đàn', { label: 'Thực tế', tone: 'ok' }, reason, `Ghi ${dm(TODAY)} · ${MANAGER}`)
  return cattle.update(code, { weight, importRecord: { ...cow.importRecord, fields }, events: [change, ...(cow.events ?? [])] })
}

export async function voidImportRecord(code: string, { reason }: { reason: string }) {
  const cow = asCowSeed(await cattle.get(code))
  const change = event('barn', `${TODAY}T08:00`, 'Hủy bản ghi nhập đàn', { label: 'Thực tế', tone: 'err' }, reason, `Ghi ${dm(TODAY)} · ${MANAGER}`)
  return cattle.update(code, {
    status: 'VOIDED',
    qrHistory: (cow.qrHistory ?? []).map((q, i) => (i === 0 ? { ...q, status: 'REVOKED' } : q)),
    events: [change, ...(cow.events ?? [])],
  })
}
