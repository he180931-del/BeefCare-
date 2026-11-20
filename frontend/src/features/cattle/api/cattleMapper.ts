import { businessDate, toFarmLocal } from '../../../shared/lib/date/farmTime'
import type { CowSeed } from '../../../data/cowsData'
import type { Pen } from '../../pen-management'
import type { BarnHistoryRow, CattleCare, CattleEvent, CattleStatus, QrHistoryRow, StatusChip, Tone } from '../types'
import type { BackendPen, BackendPenHistory, BackendProfile, BackendQrTag } from './cattle.dto'
import { mapTimeline, type BackendTimeline } from './cattleTimeline'

// `asRecord`, `rows`, `text` and `number` are the coercions this feature's API applies to backend JSON.
export const LIFE_STAGE_OPTIONS = [
  { value: 'UNWEANED_CALF', label: 'Bê chưa cai sữa' },
  { value: 'WEANED_CALF', label: 'Bê cai sữa' },
  { value: 'YOUNG_STOCK', label: 'Bò tơ' },
  { value: 'ADULT', label: 'Bò trưởng thành' },
] as const
const LIFE_STAGE_BY_LABEL = new Map<string, string>(LIFE_STAGE_OPTIONS.map((option) => [option.label, option.value]))
export const lifeStageValue = (value: string): string => LIFE_STAGE_OPTIONS.some((option) => option.value === value) ? value : LIFE_STAGE_BY_LABEL.get(value) || 'WEANED_CALF'

export const asRecord = (value: unknown): Record<string, unknown> => typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
export const rows = <T>(value: unknown, key: string): T[] => {
  const record = asRecord(value)
  return Array.isArray(record[key]) ? record[key] as T[] : Array.isArray(value) ? value as T[] : []
}
export const text = (value: unknown, fallback = ''): string => value == null ? fallback : String(value)
export const number = (value: unknown, fallback = 0): number => typeof value === 'number' && Number.isFinite(value) ? value : Number(value) || fallback
const dateLabel = (value: string | null | undefined): string => value ? value.split('-').reverse().join('/') : '—'
const localSex = (value: unknown): string => value === 'MALE' ? 'Đực' : value === 'FEMALE' ? 'Cái' : text(value, '—')
export const lifeStageLabel = (value: unknown): string => LIFE_STAGE_OPTIONS.find((option) => option.value === text(value))?.label || text(value, 'Chưa xác định')
const localStatus = (value: unknown): CattleStatus => ['ACTIVE', 'EXIT_PENDING', 'EXITED', 'VOIDED'].includes(text(value)) ? text(value) as CattleStatus : 'ACTIVE'
const toneForHealth = (value: unknown): Tone => text(value) === 'MONITORING' ? 'warn' : text(value).includes('TREAT') || text(value).includes('SICK') ? 'err' : text(value) ? 'ok' : 'grey'
const healthChip = (value: unknown): StatusChip | null => {
  if (!value) return null
  const labels: Record<string, string> = { HEALTHY: 'Khỏe', MONITORING: 'Theo dõi', UNDER_TREATMENT: 'Đang điều trị', SICK: 'Có bệnh', MEAT_WITHDRAWAL: 'Ngưng sử dụng thịt' }
  return { label: labels[text(value)] || text(value), tone: toneForHealth(value) }
}
const reproChip = (value: unknown): StatusChip | null => {
  if (!value) return null
  const labels: Record<string, string> = {
    AWAITING_BREEDING: 'Chờ phối', IN_ESTRUS: 'Động dục', BRED: 'Đã phối', PREGNANT: 'Mang thai',
    POST_CALVING: 'Sau đẻ', ESTRUS: 'Động dục', NOT_APPLICABLE: 'Không áp dụng',
  }
  return { label: labels[text(value)] || text(value), tone: 'info' }
}
const groupChip = (value: unknown): StatusChip | null => {
  const labels: Record<string, string> = { CALVES: 'Bê', FATTENING: 'Vỗ béo', BREEDING_FEMALES: 'Bò cái sinh sản', BREEDING_BULLS: 'Đực giống', YOUNG_STOCK: 'Bò tơ', OTHER: 'Khác' }
  return value ? { label: labels[text(value)] || text(value), tone: 'info' } : null
}
const combinedHealth = (state: unknown, withdrawal: boolean): StatusChip | null => {
  const health = healthChip(state)
  if (!health && !withdrawal) return null
  if (!health) return { label: 'Ngưng sử dụng thịt', tone: 'warn' }
  return withdrawal ? { label: `${health.label} · Ngưng sử dụng thịt`, tone: 'warn' } : health
}
/** SCR-19 #9: exact date; "~date (ước tính)"; "Không rõ" (and no age) when unknown. */
const birthLabel = (birthDate: string | null | undefined, accuracy: string | null | undefined): string => {
  if (accuracy === 'UNKNOWN' || !birthDate) return 'Không rõ'
  const date = dateLabel(birthDate)
  return accuracy === 'ESTIMATED' ? `~${date} (ước tính)` : date
}
export const calculateAge = (birthDate: string | null | undefined, asOfDate = businessDate()): { short: string; long: string; months: number } => {
  if (!birthDate) return { short: '—', long: '—', months: 0 }
  const birth = new Date(`${birthDate}T00:00:00Z`)
  const now = new Date(`${asOfDate}T00:00:00Z`)
  let months = (now.getUTCFullYear() - birth.getUTCFullYear()) * 12 + now.getUTCMonth() - birth.getUTCMonth()
  if (now.getUTCDate() < birth.getUTCDate()) months -= 1
  months = Math.max(0, months)
  const years = Math.floor(months / 12)
  const rest = months % 12
  return { short: years ? `${years}t ${rest ? `${rest}th` : ''}`.trim() : `${rest}th`, long: years ? `${years} tuổi${rest ? ` ${rest} tháng` : ''}` : `${rest} tháng`, months }
}

function exitLabel(profile: BackendProfile): string | undefined {
  if (profile.herdStatus !== 'EXITED') return undefined
  const type: Record<string, string> = { SALE: 'Bán', DEATH: 'Chết / mất', CULL: 'Loại thải', OTHER: 'Khác' }
  return `Đã xuất · ${type[text(profile.exitType)] || text(profile.exitType, 'Khác')} · ${dateLabel(profile.exitDate)}`
}

// The backend stores the replacement reason on the tag that was replaced; a tag that replaced none was the first issue.
const REPLACEMENT_LABELS: Record<string, string> = { LOST: 'Mất', DAMAGED: 'Hỏng', OTHER: 'Khác' }
const mapQrTag = (tag: BackendQrTag): QrHistoryRow => ({
  code: text(tag.tagCode, '—'), status: text(tag.status, 'UNKNOWN'), from: dateLabel(toFarmLocal(tag.issuedAt).slice(0, 10)), to: dateLabel(toFarmLocal(tag.endedAt).slice(0, 10)),
  reason: tag.reason ? REPLACEMENT_LABELS[tag.reason] ?? tag.reason : '—', by: text(tag.issuedByName, '—'), note: text(tag.note),
})
/** SCR-21 #6: the issue reason of each tag is the replacement reason of the tag before it, or "Cấp lần đầu". */
const withIssueReasons = (rows: QrHistoryRow[]): QrHistoryRow[] =>
  rows.map((row, index) => ({ ...row, reason: index === rows.length - 1 ? 'Cấp lần đầu' : rows[index + 1].reason }))
const ENTRY_SOURCE_LABELS: Record<string, string> = { EXTERNAL: 'Mua ngoài', FARM_BORN: 'Sinh tại trại' }
/** SCR-19 #10: purchase shows date, seller, entry weight and basis, voucher code; farm-born shows the birth date. */
const entrySourceLabel = (profile: BackendProfile): string => {
  const entry = profile.entry
  if (!entry?.source) return '—'
  const label = ENTRY_SOURCE_LABELS[entry.source] ?? entry.source
  if (entry.source === 'FARM_BORN') return `${label} · ${dateLabel(profile.birthDate)}`
  const weight = entry.weightKg == null ? '' : `${entry.weightKg} kg${entry.weightBasis === 'ESTIMATED' ? ' (ước tính)' : ''}`
  return [label, dateLabel(entry.entryDate), entry.seller, weight, entry.voucherCode].filter((part) => part && part !== '—').join(' · ')
}

export function mapBackendCattle(profile: BackendProfile, penHistory: BackendPenHistory | null = null, qrTags: BackendQrTag[] = [], timeline: BackendTimeline[] = [], unavailable: { qr?: boolean; timeline?: boolean } = {}, asOfDate?: string): CowSeed {
  const code = text(profile.displayCode, `BC-${profile.id ?? ''}`)
  // TC-05-37: an estimated birth date gives "~" on the age; an unknown one gives no age at all.
  const rawAges = profile.birthDateAccuracy === 'UNKNOWN' ? calculateAge(null, asOfDate) : calculateAge(profile.birthDate, asOfDate)
  const estimated = profile.birthDateAccuracy === 'ESTIMATED' && rawAges.short !== '—'
  const ages = estimated ? { ...rawAges, short: `~${rawAges.short}`, long: `~${rawAges.long}` } : rawAges
  const status = localStatus(profile.herdStatus)
  const current = penHistory?.current
  const history = (penHistory?.history ?? []).map((row): BarnHistoryRow => ({
    from: dateLabel(row.fromDate), to: dateLabel(row.toDate), barn: text(row.penCode, '—'), reason: text(row.reason, 'Phân chuồng'), by: text(row.recordedByName, '—'),
  }))
  const qrHistory: QrHistoryRow[] = withIssueReasons(qrTags.map(mapQrTag))
  const qrCode = qrHistory.find((tag) => tag.status === 'ACTIVE')?.code || qrHistory[0]?.code || '—'
  const weight = profile.latestWeightKg == null ? null : number(profile.latestWeightKg)
  const care: CattleCare = {
    last: weight == null ? '—' : `${weight} kg`,
    adg: profile.adg90 == null ? '—' : `${profile.adg90} kg/ngày`,
    bcs: profile.latestBcs == null ? '—' : `${profile.latestBcs} / 5`,
    healthCase: combinedHealth(profile.healthState, Boolean(profile.withdrawalActive))?.label || 'Không có ca mở',
    repro: profile.reproductiveStatus ? (reproChip(profile.reproductiveStatus)?.label || text(profile.reproductiveStatus)) : '—',
    vaccine: { label: 'Chưa có dữ liệu', tone: 'grey' }, reminders: [],
  }
  const events: CattleEvent[] = timeline.filter((event) => event.occurredAt || event.recordedAt).map(mapTimeline)
  return {
    code, tag: text(profile.earTagNumber), name: text(profile.name), breed: text(profile.breedName), sex: localSex(profile.sex),
    barn: current?.penCode ?? profile.penCode ?? '', status, ageShort: ages.short, ageLong: ages.long, months: ages.months,
    purpose: text(profile.purposeName, 'Chưa xác định'), purposeId: profile.purposeId ?? undefined, stage: lifeStageLabel(profile.lifeStage), lifeStage: text(profile.lifeStage), herdGroup: text(profile.herdGroup), exitPending: Boolean(profile.exitPending), inList: status === 'ACTIVE',
    weight, weightEst: profile.weightBasis === 'ESTIMATED', weightDate: dateLabel(profile.latestWeightDate), withdrawalUntil: profile.withdrawalEndDate ?? undefined,
    health: combinedHealth(profile.healthState, Boolean(profile.withdrawalActive)), repro: reproChip(profile.reproductiveStatus),
    headerBadges: [combinedHealth(profile.healthState, Boolean(profile.withdrawalActive)), groupChip(profile.herdGroup), reproChip(profile.reproductiveStatus)].filter(Boolean).map((chip) => [chip!.label, chip!.tone || 'grey']),
    qr: qrCode, qrHistory, barnHistory: history, barnSince: current ? dateLabel(current.since) : dateLabel(profile.penSince), purposeSince: dateLabel(profile.entry?.entryDate || profile.birthDate),
    internalId: profile.id == null ? '—' : String(profile.id), birth: birthLabel(profile.birthDate, profile.birthDateAccuracy), source: entrySourceLabel(profile),
    // GBR-23: never show internal ids; dam / sire are shown by display code, external sire code as text, else "Không rõ".
    mother: text(profile.damCode, 'Không rõ'), father: text(profile.sireCode || profile.externalSireCode, 'Không rõ'),
    damCode: profile.damCode ?? undefined, sireCode: profile.sireCode ?? undefined,
    purposeType: text(profile.purposeType), sexCode: text(profile.sex), entryDate: profile.entry?.entryDate ?? undefined,
    photoUrl: profile.photoUrl ?? undefined,
    description: text(profile.colourMarkings || profile.notes, '—'), birthDateAccuracy: text(profile.birthDateAccuracy), colourMarkings: text(profile.colourMarkings), notes: text(profile.notes), care, events, importRecord: null, exitStatusLabel: exitLabel(profile), backendId: profile.id, backendVersion: profile.version,
    canUpdate: profile.canUpdate === true, canChangePurpose: profile.canChangePurpose === true, qrUnavailable: unavailable.qr, timelineUnavailable: unavailable.timeline,
  }
}

export const mapPen = (row: BackendPen): Pen => ({
  code: text(row.code), name: text(row.name, text(row.code)), count: number(row.headcount), capacity: number(row.capacity), status: row.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE', cows: [],
  accept: text(row.acceptsSummary), purpose: text(row.currentCriteria?.purposeTypes?.join(', ')), stage: text(row.currentCriteria?.lifeStages?.join(', ')), minAge: row.currentCriteria?.minAgeMonths, minKg: row.currentCriteria?.minWeightKg,
  backendId: row.id,
})
