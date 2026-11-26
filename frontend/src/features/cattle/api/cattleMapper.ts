import { businessDate, toFarmLocal } from '../../../shared/lib/date/farmTime'
import type { CattleViewModel as CowSeed } from '../types'
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
const HEALTH_LABELS: Record<string, string> = { HEALTHY: 'Khỏe mạnh', MONITORING: 'Theo dõi', UNDER_TREATMENT: 'Đang điều trị' }
/** §3.2 health dimension only; meat withdrawal and the contagious flag are separate badges. */
const healthChip = (value: unknown): StatusChip | null => value ? { label: HEALTH_LABELS[text(value)] || text(value), tone: toneForHealth(value) } : null
export const REPRO_LABELS: Record<string, string> = {
  AWAITING_BREEDING: 'Chờ phối', IN_ESTRUS: 'Động dục', BRED: 'Đã phối – chờ khám thai', PREGNANT: 'Mang thai',
  POST_CALVING: 'Sau sinh', ESTRUS: 'Động dục', NOT_APPLICABLE: 'Không áp dụng',
}
const reproChip = (value: unknown): StatusChip | null => value ? { label: REPRO_LABELS[text(value)] || text(value), tone: 'info' } : null
export const CONTAGIOUS_LABEL = 'Nghi truyền nhiễm – cách ly'
/** SCR-19 #21: chỉ số mũi quá hạn; không có số liệu thì "—", trỏ sang tab Tiêm phòng. */
const vaccineChip = (overdue: number | null | undefined): StatusChip =>
  typeof overdue !== 'number' ? { label: '—', tone: 'grey' }
    : overdue > 0 ? { label: `${overdue} mũi quá hạn`, tone: 'err' } : { label: 'Đúng lịch', tone: 'grey' }
const withdrawalChip = (active: boolean, endDate: string | null | undefined): StatusChip | null =>
  active ? { label: endDate ? `Cách ly thịt đến ${dateLabel(endDate)}` : 'Cách ly thịt', tone: 'warn' } : null
/** GBR-55 failed criteria of BreedingCriterion.name. */
const BREEDING_CONDITION_LABELS: Record<string, string> = { MINIMUM_AGE: 'tuổi', MINIMUM_WEIGHT: 'cân nặng', OPEN_HEALTH_CASE: 'sức khỏe', POSTPARTUM_INTERVAL: 'khoảng cách sau sinh' }
const EXPECTED_BASIS_LABELS: Record<string, string> = { CONFIRMED: 'đã xác nhận', TENTATIVE: 'tạm tính', ESTIMATED: 'ước tính' }
/** SCR-19 #20: status · eligibility · expected calving with its basis; "Không áp dụng" outside reproduction tracking. */
const reproSummary = (profile: BackendProfile): string => {
  const status = text(profile.reproductiveStatus)
  if (!status || status === 'NOT_APPLICABLE') return 'Không áp dụng'
  const eligibility = profile.breedingEligible == null ? ''
    : profile.breedingEligible ? 'Đủ điều kiện phối'
      : `Chưa đủ: ${(profile.failedBreedingConditions ?? []).map((c) => BREEDING_CONDITION_LABELS[c] ?? c).join('; ')}`
  const basis = profile.expectedBasis ? ` (${EXPECTED_BASIS_LABELS[profile.expectedBasis] ?? profile.expectedBasis})` : ''
  const expected = profile.expectedCalvingDate ? `Dự kiến đẻ ${dateLabel(profile.expectedCalvingDate)}${basis}` : ''
  return [REPRO_LABELS[status] ?? status, eligibility, expected].filter(Boolean).join(' · ')
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

const EXIT_TYPE_LABELS: Record<string, string> = { SALE: 'Bán', DEATH: 'Chết / mất', CULL: 'Loại thải', OTHER: 'Khác' }
const exitTypeLabel = (profile: BackendProfile): string | undefined =>
  profile.herdStatus === 'EXITED' ? EXIT_TYPE_LABELS[text(profile.exitType)] || text(profile.exitType, 'Khác') : undefined
function exitLabel(profile: BackendProfile): string | undefined {
  if (profile.herdStatus !== 'EXITED') return undefined
  return `Đã xuất · ${exitTypeLabel(profile)} · ${dateLabel(profile.exitDate)}`
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

/** Herd-entry date, or the birth date of a farm-born calf: the fallback "from" date of purpose and life stage. */
const herdSince = (profile: BackendProfile): string | null | undefined => profile.entry?.entryDate || profile.birthDate
/** SCR-19 #12 / #13: effective date (occurredAt) of the latest valid PROFILE_CHANGE of the field group. */
const changedSince = (timeline: BackendTimeline[], fieldGroup: 'PURPOSE' | 'LIFE_STAGE'): string | null => {
  const dates = timeline
    .filter((event) => event.type === 'PROFILE_CHANGE' && asRecord(event.values).fieldGroup === fieldGroup && event.occurredAt && !['VOIDED', 'VOID', 'EXCLUDED'].includes(text(event.status)))
    .map((event) => { const at = String(event.occurredAt); return /^\d{4}-\d{2}-\d{2}$/.test(at) ? at : toFarmLocal(at).slice(0, 10) })
    .filter(Boolean)
    .sort()
  return dates.length ? dates[dates.length - 1] : null
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
    from: dateLabel(row.fromDate), to: dateLabel(row.toDate), barn: text(row.penCode, '—'), reason: text(row.reason, 'Phân chuồng'), warningReason: row.warningReason || undefined, by: text(row.recordedByName, '—'),
  }))
  const qrHistory: QrHistoryRow[] = withIssueReasons(qrTags.map(mapQrTag))
  const qrCode = qrHistory.find((tag) => tag.status === 'ACTIVE')?.code || qrHistory[0]?.code || '—'
  const weight = profile.latestWeightKg == null ? null : number(profile.latestWeightKg)
  const care: CattleCare = {
    last: weight == null ? '—' : `${weight} kg`,
    adg: profile.adg90 == null ? '—' : `${profile.adg90} kg/ngày`,
    // The measurement has no historical scale; attaching the current farm scale would mislabel old scores.
    bcs: profile.latestBcs == null ? '—' : profile.latestBcs.toLocaleString('vi-VN', { maximumFractionDigits: 1 }),
    healthCase: [healthChip(profile.healthState)?.label, profile.suspectedContagious ? CONTAGIOUS_LABEL : ''].filter(Boolean).join(' · ') || '—',
    repro: reproSummary(profile),
    // SCR-19 #21: số mũi quá hạn do backend tính (vaccinationOverdue); chỉ tô đỏ khi còn mũi quá hạn.
    vaccine: vaccineChip(profile.vaccinationOverdue), reminders: [],
  }
  const events: CattleEvent[] = timeline.filter((event) => event.occurredAt || event.recordedAt).map(mapTimeline)
  return {
    code, tag: text(profile.earTagNumber), name: text(profile.name), breed: text(profile.breedName), sex: localSex(profile.sex),
    barn: current?.penCode ?? profile.penCode ?? '', status, ageShort: ages.short, ageLong: ages.long, months: ages.months,
    purpose: text(profile.purposeName, 'Chưa xác định'), purposeId: profile.purposeId ?? undefined, stage: lifeStageLabel(profile.lifeStage), lifeStage: text(profile.lifeStage), herdGroup: text(profile.herdGroup), exitPending: Boolean(profile.exitPending), inList: status === 'ACTIVE',
    weight, weightEst: profile.weightBasis === 'ESTIMATED', weightDate: dateLabel(profile.latestWeightDate), withdrawalUntil: profile.withdrawalEndDate ?? undefined,
    health: healthChip(profile.healthState), repro: reproChip(profile.reproductiveStatus),
    // SCR-19 #4, §3.2 (D78): sức khỏe → nghi truyền nhiễm → cách ly thịt → sinh sản; nhóm đàn không còn là huy hiệu.
    headerBadges: [
      healthChip(profile.healthState),
      profile.suspectedContagious ? { label: CONTAGIOUS_LABEL, tone: 'err' as Tone } : null,
      // "Không áp dụng" không phải trạng thái cần báo – không thành huy hiệu (như cột Sinh sản ở SCR-18, D75).
      withdrawalChip(Boolean(profile.withdrawalActive), profile.withdrawalEndDate),
      profile.reproductiveStatus === 'NOT_APPLICABLE' ? null : reproChip(profile.reproductiveStatus),
    ].filter((chip): chip is StatusChip => chip != null).map((chip) => [chip.label, chip.tone || 'grey']),
    qr: qrCode, qrHistory, barnHistory: history, barnSince: current ? dateLabel(current.since) : dateLabel(profile.penSince), purposeSince: dateLabel(changedSince(timeline, 'PURPOSE') || herdSince(profile)), stageSince: dateLabel(changedSince(timeline, 'LIFE_STAGE') || herdSince(profile)),
    internalId: profile.id == null ? '—' : String(profile.id), birth: birthLabel(profile.birthDate, profile.birthDateAccuracy), source: entrySourceLabel(profile),
    // GBR-23: never show internal ids; dam / sire are shown by display code, external sire code as text, else "Không rõ".
    mother: text(profile.damCode, 'Không rõ'), father: text(profile.sireCode || profile.externalSireCode, 'Không rõ'),
    damCode: profile.damCode ?? undefined, sireCode: profile.sireCode ?? undefined,
    purposeType: text(profile.purposeType), sexCode: text(profile.sex), entryDate: profile.entry?.entryDate ?? undefined,
    entryId: profile.entry?.id ?? undefined, entryVoucherCode: profile.entry?.voucherCode ?? undefined,
    photoUrl: profile.photoUrl ?? undefined, quarantineUntil: profile.quarantineUntil ?? undefined,
    entrySource: profile.entry?.source ?? undefined,
    description: text(profile.colourMarkings || profile.notes, '—'), birthDateAccuracy: text(profile.birthDateAccuracy), colourMarkings: text(profile.colourMarkings), notes: text(profile.notes), care, events, importRecord: null, exitStatusLabel: exitLabel(profile), exitTypeLabel: exitTypeLabel(profile), exitDateLabel: profile.exitDate ? dateLabel(profile.exitDate) : undefined, backendId: profile.id, backendVersion: profile.version,
    suspectedContagious: profile.suspectedContagious ?? undefined, expectedCalvingDate: profile.expectedCalvingDate ?? undefined, expectedBasis: profile.expectedBasis ?? undefined,
    breedingEligible: profile.breedingEligible ?? undefined, failedBreedingConditions: profile.failedBreedingConditions ?? undefined,
    canUpdate: profile.canUpdate === true, canChangePurpose: profile.canChangePurpose === true, qrUnavailable: unavailable.qr, timelineUnavailable: unavailable.timeline,
  }
}

export const mapPen = (row: BackendPen): Pen => ({
  code: text(row.code), name: text(row.name, text(row.code)), count: number(row.headcount), capacity: number(row.capacity), status: row.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE', cows: [],
  accept: text(row.acceptsSummary), purpose: text(row.currentCriteria?.purposeTypes?.join(', ')), stage: text(row.currentCriteria?.lifeStages?.join(', ')), minAge: row.currentCriteria?.minAgeMonths, minKg: row.currentCriteria?.minWeightKg,
  backendId: row.id,
})
