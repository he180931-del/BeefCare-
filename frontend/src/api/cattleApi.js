import { createCollection } from './client.js'
import { MANAGER, TODAY, initialCows, newQrCode } from '../data/cowsData.js'
import { dm, dmy } from '../data/format.js'
import { moveCattle, pens } from './herdDomainApi.js'

// Bò và chuồng dùng đúng hai collection chung của toàn bộ các luồng nghiệp vụ.
const cattle = createCollection('cattle', initialCows, { idKey: 'code' })

const event = (cat, at, title, badge, detail, meta) => ({ id: `ev-${Date.now()}`, at, cat, title, badge, detail, meta })

const getActiveCow = async (code) => {
  const cow = await cattle.get(code)
  if (cow.status !== 'ACTIVE') throw new Error(`Cattle not active: ${code}`)
  return cow
}

export const listCows = () => cattle.list()
export const listBarns = () => pens.list()

/** Hồ sơ một bò kèm danh sách chuồng (để hiển thị tiêu chí và sức chứa). */
export async function loadProfile(code) {
  const [cow, barnRows] = await Promise.all([cattle.get(code), pens.list()])
  return { cow, barns: barnRows }
}

export const updateIdentity = async (code, { name, tag, description }) => {
  await getActiveCow(code)
  return cattle.update(code, { name, tag, description })
}

export async function updateStage(code, { stage, date, reason }) {
  const cow = await getActiveCow(code)
  const change = event('stage', `${date}T08:00`, `Đổi giai đoạn: ${cow.stage} → ${stage}`, { label: 'Thực tế', tone: 'ok' }, reason, `Hiệu lực ${dm(date)} · ghi ${dm(TODAY)} · ${MANAGER}`)
  return cattle.update(code, { stage, events: [change, ...cow.events] })
}

export async function moveBarn(code, { to, date, reason, by }) {
  const cow = await getActiveCow(code)
  const from = cow.barn
  if (from === to) return cow
  const moved = await moveCattle(code, { to, date, reason, by })
  const d = dmy(date)
  const change = event('barn', `${date}T08:00`, `Chuyển chuồng ${from} → ${to}`, { label: 'Thực tế', tone: 'ok' }, reason, `Hiệu lực ${dm(date)} · ghi ${dm(TODAY)} · ${by}`)
  return cattle.update(code, {
    barnSince: d,
    barnHistory: moved.barnHistory.map((row, index) => index === 0 ? { ...row, from: d } : row.to === date ? { ...row, to: d } : row),
    events: [change, ...cow.events],
  })
}

export async function reissueQr(code, { reason, note, by }) {
  const cow = await getActiveCow(code)
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
  const cow = await getActiveCow(code)
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
