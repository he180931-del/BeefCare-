import type { CowSeed } from '../../../data/cowsData'
import { dm, dmy } from '../../../shared/lib/format'
import { backendFarmId } from '../../../api/backendTransport'
import { backendMode } from '../../../shared/config/runtime'
import { backendTransport } from '../../../shared/api/backendTransport'
import { createCattleBackendApi, lifeStageValue, type CattleListOptions, type CattlePage, type PenMoveCheck, type PurposeOption, type ProfileUpdateCommand } from './cattleBackendApi'
import type { Pen } from '../../pen-management'
import type { Cattle, CattleEvent, QrHistoryRow, Tone } from '../types'
import { toFarmLocal, businessDate } from '../../../shared/lib/date/farmTime'
import { demo } from '../../../demo/demoModules'

const backendApi = createCattleBackendApi({ transport: backendTransport, farmId: backendFarmId })
export const listCattleTimeline = backendApi.timeline

/**
 * SCR-12 ở bản mô phỏng: lọc, đếm và lựa chọn tính tại trình duyệt từ đàn mẫu. Máy chủ thật không có giá trị này (null):
 * lọc, đếm và phân trang ở máy chủ.
 */
export const localCattleList = backendMode === 'backend' ? null : { breeds: demo.cattleLocal.BREEDS, barns: Object.keys(demo.cattleLocal.BARNS0), stages: demo.cattleLocal.STAGES, exported: demo.cattleLocal.EXPORTED_COUNT, groupCount: demo.cattleLocal.groupCount }

/** Người thực hiện chọn được ở bản mô phỏng. Máy chủ thật ghi theo phiên đăng nhập nên không có lựa chọn. */
export const demoActors: ReadonlyArray<{ value: string; label: string }> = backendMode === 'backend' ? [] : [{ value: demo.cattleLocal.MANAGER, label: 'Quản lý' }, { value: demo.cattleLocal.OWNER, label: 'Chủ trại' }]

/** Người ghi của bản mô phỏng; máy chủ thật bỏ qua trường này. */
export const demoRecorder = backendMode === 'backend' ? '' : demo.cattleLocal.MANAGER

/** Nội dung Figma điền sẵn cho một con bò mẫu; bò của máy chủ thật không có. */
export const demoCowPrefill = (cow: { code: string; backendId?: number | null }) => (backendMode === 'backend' || cow.backendId != null
  ? null
  : demo.cattleLocal.COW_PREFILL[cow.code] ?? null)

/** Ngày nghiệp vụ hiện tại; bản mô phỏng đứng ở ngày của dữ liệu mẫu. */
export const cattleToday = (): string => (backendMode === 'backend' ? businessDate() : demo.cattleLocal.TODAY)

const isCowSeed = (cow: Cattle): cow is CowSeed => Boolean(cow.ageLong && cow.stage && cow.purpose && cow.qr && cow.care)
const asCowSeed = (cow: Cattle): CowSeed => {
  if (!isCowSeed(cow)) throw new Error(`Incomplete cattle profile: ${cow.code}`)
  return cow
}

const event = (cat: string, at: string, title: string, badge: { label: string; tone: Tone }, detail: string, meta: string): CattleEvent => ({ id: `ev-${Date.now()}`, at, cat, title, badge, detail, meta })

const getActiveCow = async (code: string): Promise<CowSeed> => {
  const cow = asCowSeed(await demo.cattleLocal.cattle.get(code))
  if (cow.status !== 'ACTIVE') throw new Error(`Cattle not active: ${code}`)
  return cow
}

export const listCows = async (): Promise<CowSeed[]> => backendMode === 'backend'
  ? (await backendApi.listPage()).items
  : (await demo.cattleLocal.cattle.list()).filter(isCowSeed)
export const listCowsPage = (options: CattleListOptions = {}): Promise<CattlePage> => backendMode === 'backend'
  ? backendApi.listPage(options)
  : listCows().then((items) => ({ items, total: items.length, page: 0, size: items.length, counts: {} }))
export const listPurposes = (): Promise<PurposeOption[]> => backendMode === 'backend' ? backendApi.purposes() : Promise.resolve([])
export const listBreeds = (): Promise<Array<{ id: number; name: string; code: string }>> => backendMode === 'backend' ? backendApi.breeds() : Promise.resolve([])
export const listBarns = () => backendMode === 'backend' ? backendApi.pens() : demo.cattleLocal.pens.list()

/** Hồ sơ một bò kèm danh sách chuồng (để hiển thị tiêu chí và sức chứa). */
export async function loadProfile(code: string): Promise<{ cow: CowSeed; barns: Pen[] }> {
  if (backendMode === 'backend') return backendApi.profile(code)
  const [cow, barnRows, photo] = await Promise.all([demo.cattleLocal.cattle.get(code), demo.cattleLocal.pens.list(), demo.cattleLocal.readDemoCattlePhoto(code)])
  return { cow: photo === undefined ? asCowSeed(cow) : { ...asCowSeed(cow), photoUrl: photo ?? undefined }, barns: barnRows }
}

type BackendMutationContext = {
  backendId?: number; backendVersion?: number; effectiveDate?: string; reason?: string
  currentProfile?: Partial<Pick<ProfileUpdateCommand, 'earTagNumber' | 'name' | 'colourMarkings' | 'notes' | 'productionPurposeId' | 'lifeStage'>>
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
  effectiveDate: context.effectiveDate || businessDate(),
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
  return demo.cattleLocal.cattle.update(code, { name, tag, description })
}

export async function updateStage(code: string, { stage, date, reason, acknowledgedReproductionChange }: { stage: string; date: string; reason: string; acknowledgedReproductionChange?: boolean }, context: BackendMutationContext = {}) {
  if (backendMode === 'backend' && context.backendId != null && context.backendVersion != null) {
    return backendApi.updateProfile(context.backendId, profileBody({ ...context, effectiveDate: date, reason }, { lifeStage: lifeStageValue(stage), acknowledgedReproductionChange: acknowledgedReproductionChange === true }))
  }
  const cow = await getActiveCow(code)
  const change = event('stage', `${date}T08:00`, `Đổi giai đoạn: ${cow.stage} → ${stage}`, { label: 'Thực tế', tone: 'ok' }, reason, `Hiệu lực ${dm(date)} · ghi ${dm(demo.cattleLocal.TODAY)} · ${demo.cattleLocal.MANAGER}`)
  return demo.cattleLocal.cattle.update(code, { stage, events: [change, ...(cow.events ?? [])] })
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
  const moved = await demo.cattleLocal.moveCattle(code, { to, date, reason, by })
  const d = dmy(date)
  const change = event('barn', `${date}T08:00`, `Chuyển chuồng ${from} → ${to}`, { label: 'Thực tế', tone: 'ok' }, reason, `Hiệu lực ${dm(date)} · ghi ${dm(demo.cattleLocal.TODAY)} · ${by}`)
  return demo.cattleLocal.cattle.update(code, {
    barnSince: d,
    barnHistory: (moved.barnHistory ?? []).map((row, index) => index === 0 ? { ...row, from: d } : row.to === date ? { ...row, to: d } : row),
    events: [change, ...(cow.events ?? [])],
  })
}

/** A4 uses the private upload endpoint. The offline demo persists photos on this browser. */
export async function saveCattlePhoto(code: string, context: BackendMutationContext, file: File | null) {
  if (backendMode === 'backend') {
    if (context.backendId == null || context.backendVersion == null) throw new Error('Vui lòng tải lại hồ sơ trước khi lưu ảnh.')
    return file
      ? backendApi.uploadPhoto(context.backendId, file, context.backendVersion)
      : backendApi.removePhoto(context.backendId, context.backendVersion)
  }
  if ((await getActiveCow(code)).exitPending) throw new Error('Bò đang chờ xuất đàn. Hồ sơ chỉ có thể xem.')
  const photo = file && !file.type
    ? file.slice(0, file.size, /\.png$/i.test(file.name) ? 'image/png' : 'image/jpeg')
    : file
  return demo.cattleLocal.saveDemoCattlePhoto(code, photo)
}
export const resolveScannedCode = (code: string) => backendApi.resolveCode(code)

export const checkPenMove = (code: string, { date, toPenId }: { date: string; toPenId: number }, context: { backendId?: number } = {}): Promise<PenMoveCheck | null> => {
  if (backendMode === 'backend' && context.backendId != null) return backendApi.checkPenMove({ cattleId: context.backendId, toPenId, moveDate: date })
  return Promise.resolve(null)
}

export async function reissueQr(code: string, { reason, note, by, tagCode }: { reason: string; note: string; by: string; tagCode?: string }, context: BackendMutationContext = {}) {
  if (backendMode === 'backend') {
    if (context.backendId == null || context.backendVersion == null) throw new Error('Vui lòng tải lại hồ sơ trước khi cấp thẻ.')
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
  if (cow.exitPending) throw new Error('Bò đang chờ xuất đàn. Hồ sơ chỉ có thể xem.')
  const newCode = tagCode?.trim() || `QR-${Array.from(crypto.getRandomValues(new Uint8Array(12)), (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase()}`
  if (tagCode && (await demo.cattleLocal.cattle.list()).some((row) => row.qr === newCode || row.qrHistory?.some((tag) => tag.code === newCode))) {
    throw new Error('Mã thẻ này đã được dùng. Vui lòng nhập mã khác hoặc để hệ thống tạo.')
  }
  const at = toFarmLocal(new Date().toISOString())
  const issuedOn = dmy(at.slice(0, 10))
  const change = event('qr', at, reason ? 'Cấp lại thẻ QR' : 'Cấp thẻ QR', { label: 'Thực tế', tone: 'ok' }, note || reason, `Ghi ${issuedOn} · ${by}`)
  return demo.cattleLocal.cattle.update(code, {
    qr: newCode,
    qrHistory: [
      { code: newCode, status: 'ACTIVE', from: issuedOn, to: '—', reason: reason || 'Cấp lần đầu', note, by },
      ...(cow.qrHistory ?? []).map((q): QrHistoryRow => (q.status === 'ACTIVE' ? { ...q, status: 'REPLACED', to: issuedOn, reason } : q)),
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
  const change = event('barn', `${demo.cattleLocal.TODAY}T08:00`, 'Sửa bản ghi nhập đàn', { label: 'Thực tế', tone: 'ok' }, reason, `Ghi ${dm(demo.cattleLocal.TODAY)} · ${demo.cattleLocal.MANAGER}`)
  return demo.cattleLocal.cattle.update(code, { weight, importRecord: { ...cow.importRecord, fields }, events: [change, ...(cow.events ?? [])] })
}

export async function voidImportRecord(code: string, { reason }: { reason: string }) {
  const cow = asCowSeed(await demo.cattleLocal.cattle.get(code))
  const change = event('barn', `${demo.cattleLocal.TODAY}T08:00`, 'Hủy bản ghi nhập đàn', { label: 'Thực tế', tone: 'err' }, reason, `Ghi ${dm(demo.cattleLocal.TODAY)} · ${demo.cattleLocal.MANAGER}`)
  return demo.cattleLocal.cattle.update(code, {
    status: 'VOIDED',
    qrHistory: (cow.qrHistory ?? []).map((q, i) => (i === 0 ? { ...q, status: 'REVOKED' } : q)),
    events: [change, ...(cow.events ?? [])],
  })
}
