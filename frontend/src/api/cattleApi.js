import { createCollection } from './client'
import { BARNS0, MANAGER, TODAY, initialCows, newQrCode } from '../data/cowsData'
import { dm, dmy } from '../data/format'

// Hai collection: bò (khoá theo mã hiển thị) và chuồng (khoá theo mã chuồng).
const cattle = createCollection('cattle', initialCows, { idKey: 'code' })
const barns = createCollection('barns', Object.values(BARNS0), { idKey: 'code' })

const event = (cat, at, title, badge, detail, meta) => ({ id: `ev-${Date.now()}`, at, cat, title, badge, detail, meta })

export const listCows = () => cattle.list()
export const listBarns = () => barns.list()

/** Hồ sơ một bò kèm danh sách chuồng (để hiển thị tiêu chí và sức chứa). */
export async function loadProfile(code) {
  const [cow, barnRows] = await Promise.all([cattle.get(code), barns.list()])
  return { cow, barns: barnRows }
}

export const updateIdentity = (code, { name, tag, description }) => cattle.update(code, { name, tag, description })

export async function updateStage(code, { stage, date, reason }) {
  const cow = await cattle.get(code)
  const change = event('stage', `${date}T08:00`, `Đổi giai đoạn: ${cow.stage} → ${stage}`, { label: 'Thực tế', tone: 'ok' }, reason, `Hiệu lực ${dm(date)} · ghi ${dm(TODAY)} · ${MANAGER}`)
  return cattle.update(code, { stage, events: [change, ...cow.events] })
}

export async function moveBarn(code, { to, date, reason, by }) {
  const cow = await cattle.get(code)
  const from = cow.barn
  if (from === to) return cow
  const [fromBarn, toBarn] = await Promise.all([barns.get(from), barns.get(to)])
  await barns.update(from, { count: fromBarn.count - 1 })
  await barns.update(to, { count: toBarn.count + 1 })
  const d = dmy(date)
  const change = event('barn', `${date}T08:00`, `Chuyển chuồng ${from} → ${to}`, { label: 'Thực tế', tone: 'ok' }, reason, `Hiệu lực ${dm(date)} · ghi ${dm(TODAY)} · ${by}`)
  return cattle.update(code, {
    barn: to,
    barnSince: d,
    barnTag: undefined,
    barnHistory: [{ from: d, to: '—', barn: toBarn.name, reason, by }, ...cow.barnHistory.map((h, i) => (i === 0 ? { ...h, to: d } : h))],
    events: [change, ...cow.events],
  })
}

export async function reissueQr(code, { reason, note, by }) {
  const cow = await cattle.get(code)
  const newCode = newQrCode(cow)
  const change = event('qr', `${TODAY}T08:00`, 'Cấp lại thẻ QR', { label: 'Thực tế', tone: 'ok' }, note || reason, `Hiệu lực ${dm(TODAY)} · ghi ${dm(TODAY)} · ${by}`)
  return cattle.update(code, {
    qr: newCode,
    qrHistory: [
      { code: newCode, status: 'ACTIVE', from: '10/2026', to: '—', reason, by },
      ...cow.qrHistory.map((q) => (q.status === 'ACTIVE' ? { ...q, status: 'REPLACED', to: '10/2026' } : q)),
    ],
    events: [change, ...cow.events],
  })
}

export async function editImportRecord(code, { values, reason }) {
  const cow = await cattle.get(code)
  if (!cow.importRecord) return cow
  let weight = cow.weight
  const fields = cow.importRecord.fields.map(([key, label, current, next]) => {
    const v = values[key]
    if (!v || v === '—' || v === current) return [key, label, current, next]
    if (key === 'weight') weight = parseFloat(v.replace(',', '.'))
    return [key, label, v, next]
  })
  const change = event('barn', `${TODAY}T08:00`, 'Sửa bản ghi nhập đàn', { label: 'Thực tế', tone: 'ok' }, reason, `Ghi ${dm(TODAY)} · ${MANAGER}`)
  return cattle.update(code, { weight, importRecord: { ...cow.importRecord, fields }, events: [change, ...cow.events] })
}

export async function voidImportRecord(code, { reason }) {
  const cow = await cattle.get(code)
  const change = event('barn', `${TODAY}T08:00`, 'Hủy bản ghi nhập đàn', { label: 'Thực tế', tone: 'err' }, reason, `Ghi ${dm(TODAY)} · ${MANAGER}`)
  return cattle.update(code, {
    status: 'VOIDED',
    qrHistory: cow.qrHistory.map((q, i) => (i === 0 ? { ...q, status: 'REVOKED' } : q)),
    events: [change, ...cow.events],
  })
}
