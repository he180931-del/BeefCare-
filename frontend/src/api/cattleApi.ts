import { createCollection } from './client'
import { MANAGER, TODAY, initialCows, newQrCode, type CowSeed } from '../data/cowsData'
import { dm, dmy } from '../data/format'
import { moveCattle, pens } from './herdDomainApi'
import { cattleSchema } from './collectionSchemas'
import { backendFarmId, backendMode, backendTransport } from './backendTransport'
import { createCattleBackendApi, lifeStageValue, type CattleListOptions, type CattlePage, type PenMoveCheck, type PurposeOption, type ProfileUpdateCommand } from './cattleBackendApi'
import type { Cattle, CattleEvent, Pen, QrHistoryRow, Tone } from '../types'

// Bò và chuồng dùng đúng hai collection chung của toàn bộ các luồng nghiệp vụ.
const cattle = createCollection<Cattle, 'code'>('cattle', initialCows, { schema: cattleSchema })
const backendApi = createCattleBackendApi({ transport: backendTransport, farmId: backendFarmId })

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

export const listCows = async (): Promise<CowSeed[]> => backendMode === 'backend'
  ? (await backendApi.listPage()).items
  : (await cattle.list()).filter(isCowSeed)
export const listCowsPage = (options: CattleListOptions = {}): Promise<CattlePage> => backendMode === 'backend'
  ? backendApi.listPage(options)
  : listCows().then((items) => ({ items, total: items.length, page: 0, size: items.length, counts: {} }))
export const listPurposes = (): Promise<PurposeOption[]> => backendMode === 'backend' ? backendApi.purposes() : Promise.resolve([])
export const listBreeds = (): Promise<Array<{ id: number; name: string; code: string }>> => backendMode === 'backend' ? backendApi.breeds() : Promise.resolve([])
export const listBarns = () => backendMode === 'backend' ? backendApi.pens() : pens.list()

/** Hồ sơ một bò kèm danh sách chuồng (để hiển thị tiêu chí và sức chứa). */
export async function loadProfile(code: string): Promise<{ cow: CowSeed; barns: Pen[] }> {
  if (backendMode === 'backend') return backendApi.profile(code)
  const [cow, barnRows] = await Promise.all([cattle.get(code), pens.list()])
  return { cow: asCowSeed(cow), barns: barnRows }
}

type BackendMutationContext = {
  backendId?: number; backendVersion?: number; effectiveDate?: string; reason?: string
  currentProfile?: Partial<Pick<ProfileUpdateCommand, 'earTagNumber' | 'name' | 'colourMarkings' | 'notes' | 'productionPurposeId' | 'lifeStage'>>
}
const localToday = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
const profileBody = (context: BackendMutationContext, overrides: Partial<ProfileUpdateCommand>): ProfileUpdateCommand => ({
  // ProfileUpdate is a full snapshot command. Never let an omitted field from
  // one tab turn into JSON null and erase a value changed in another tab.
  earTagNumber: context.currentProfile?.earTagNumber ?? '',
  name: context.currentProfile?.name ?? '',
  colourMarkings: context.currentProfile?.colourMarkings ?? '',
  notes: context.currentProfile?.notes ?? '',
  productionPurposeId: context.currentProfile?.productionPurposeId,
  lifeStage: context.currentProfile?.lifeStage,
  // Ngày theo giờ máy người dùng; toISOString() là UTC và lệch một ngày vào buổi sáng ở Việt Nam.
  effectiveDate: context.effectiveDate || localToday(),
  reason: context.reason || 'Cập nhật hồ sơ',
  expectedVersion: context.backendVersion as number,
  acknowledgedReproductionChange: false,
  ...overrides,
})

export const updateIdentity = async (code: string, { name, tag, description, notes }: { name: string; tag?: string; description?: string; notes?: string }, context: BackendMutationContext = {}) => {
  if (backendMode === 'backend' && context.backendId != null && context.backendVersion != null) {
    return backendApi.updateProfile(context.backendId, profileBody({ ...context, reason: context.reason || 'Cập nhật định danh và mô tả' }, {
      name,
      earTagNumber: tag ?? context.currentProfile?.earTagNumber ?? '',
      colourMarkings: description ?? context.currentProfile?.colourMarkings ?? '',
      notes: notes ?? context.currentProfile?.notes ?? '',
    }))
  }
  await getActiveCow(code)
  return cattle.update(code, { name, tag, description })
}

export async function updateStage(code: string, { stage, date, reason, acknowledgedReproductionChange }: { stage: string; date: string; reason: string; acknowledgedReproductionChange?: boolean }, context: BackendMutationContext = {}) {
  if (backendMode === 'backend' && context.backendId != null && context.backendVersion != null) {
    return backendApi.updateProfile(context.backendId, profileBody({ ...context, effectiveDate: date, reason }, { lifeStage: lifeStageValue(stage), acknowledgedReproductionChange: acknowledgedReproductionChange === true }))
  }
  const cow = await getActiveCow(code)
  const change = event('stage', `${date}T08:00`, `Đổi giai đoạn: ${cow.stage} → ${stage}`, { label: 'Thực tế', tone: 'ok' }, reason, `Hiệu lực ${dm(date)} · ghi ${dm(TODAY)} · ${MANAGER}`)
  return cattle.update(code, { stage, events: [change, ...(cow.events ?? [])] })
}

export async function updatePurpose(code: string, purposeId: number, context: BackendMutationContext & { acknowledgedReproductionChange?: boolean } = {}) {
  if (backendMode === 'backend' && context.backendId != null && context.backendVersion != null) {
    return backendApi.updateProfile(context.backendId, profileBody({ ...context, reason: context.reason || 'Cập nhật mục đích nuôi' }, { productionPurposeId: purposeId, acknowledgedReproductionChange: context.acknowledgedReproductionChange === true }))
  }
  return getActiveCow(code)
}

export async function moveBarn(code: string, { to, date, reason, by }: { to: string; date: string; reason: string; by: string }, context: { backendId?: number; backendVersion?: number; toPenId?: number; warningReason?: string } = {}) {
  if (backendMode === 'backend' && context.backendId != null && context.toPenId != null) {
    return backendApi.movePen({ cattleId: context.backendId, toPenId: context.toPenId, moveDate: date, reason, warningReason: context.warningReason, cattleVersion: context.backendVersion })
  }
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

/** A4: replace or remove the cattle photo (backend only; the local demo keeps the placeholder). */
export const uploadCattlePhoto = (context: BackendMutationContext, file: File) =>
  backendMode === 'backend' && context.backendId != null && context.backendVersion != null
    ? backendApi.uploadPhoto(context.backendId, file, context.backendVersion)
    : Promise.resolve(null)
export const removeCattlePhoto = (context: BackendMutationContext) =>
  backendMode === 'backend' && context.backendId != null && context.backendVersion != null
    ? backendApi.removePhoto(context.backendId, context.backendVersion)
    : Promise.resolve(null)
export const resolveScannedCode = (code: string) => backendApi.resolveCode(code)

export const checkPenMove = (code: string, { date, toPenId }: { date: string; toPenId: number }, context: { backendId?: number } = {}): Promise<PenMoveCheck | null> => {
  if (backendMode === 'backend' && context.backendId != null) return backendApi.checkPenMove({ cattleId: context.backendId, toPenId, moveDate: date })
  return Promise.resolve(null)
}

export async function reissueQr(code: string, { reason, note, by, tagCode }: { reason: string; note: string; by: string; tagCode?: string }, context: BackendMutationContext = {}) {
  if (backendMode === 'backend' && context.backendId != null && context.backendVersion != null) {
    // Cấp lần đầu không gửi lý do (UC-04 AF1); thay thẻ gửi LOST / DAMAGED / OTHER.
    const replacementReason = ['LOST', 'DAMAGED', 'OTHER'].includes(reason)
      ? reason as 'LOST' | 'DAMAGED' | 'OTHER'
      : reason === 'Thẻ bị mất' ? 'LOST' : reason === 'Thẻ bị hỏng' ? 'DAMAGED' : reason ? 'OTHER' : undefined
    return backendApi.issueQr(context.backendId, {
      ...(replacementReason ? { reason: replacementReason } : {}),
      ...(tagCode?.trim() ? { tagCode: tagCode.trim() } : {}),
      ...(note ? { note } : {}),
      cattleVersion: context.backendVersion,
    })
  }
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
