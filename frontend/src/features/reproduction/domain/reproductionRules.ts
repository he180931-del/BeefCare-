import type {
  BreedingEligibility,
  CalfOutcome,
  CalvingCommand,
  ReproductionIssue,
  ReproductiveStatus,
  ReproductionCommand,
  ReproductionFemale,
  WorklistFilters,
} from '../types'

export type ReproductionAction =
  | 'RECORD_ESTRUS'
  | 'RECORD_BREEDING'
  | 'RECORD_PREGNANCY_CHECK'
  | 'RECORD_PREGNANCY_UPDATE'
  | 'RECORD_CALVING'

const STATUS_ACTIONS: Record<ReproductiveStatus, ReproductionAction[]> = {
  AWAITING_BREEDING: ['RECORD_ESTRUS', 'RECORD_BREEDING'],
  IN_ESTRUS: ['RECORD_ESTRUS', 'RECORD_BREEDING'],
  BRED: ['RECORD_ESTRUS', 'RECORD_PREGNANCY_CHECK', 'RECORD_CALVING'],
  PREGNANT: ['RECORD_PREGNANCY_CHECK', 'RECORD_PREGNANCY_UPDATE', 'RECORD_CALVING'],
  POST_CALVING: ['RECORD_ESTRUS', 'RECORD_BREEDING'],
}

export function actionsForStatus(status: ReproductiveStatus | null): ReproductionAction[] {
  return status ? [...STATUS_ACTIONS[status]] : []
}

const DAY_MS = 86_400_000
const localNowText = () => {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

/** Pregnant female whose expected calving date is within the next 30 days (tab "Sắp đẻ"). */
export function isDueSoon(row: ReproductionFemale, now: string = localNowText()): boolean {
  const expected = row.openPregnancy?.expectedCalvingAt
  return row.status === 'PREGNANT' && !!expected && Date.parse(expected) <= Date.parse(now) + 30 * DAY_MS
}

export function filterWorklist(rows: readonly ReproductionFemale[], filters: WorklistFilters, now: string = localNowText()): ReproductionFemale[] {
  const query = filters.query?.trim().toLocaleLowerCase('vi')
  return rows.filter((row) => {
    if (!row.applicable || row.herdStatus !== 'ACTIVE' || !row.status) return false
    if (filters.status === 'DUE_SOON') { if (!isDueSoon(row, now)) return false }
    else if (filters.status && filters.status !== 'ALL' && row.status !== filters.status) return false
    if (filters.penCode && filters.penCode !== 'ALL' && row.penCode !== filters.penCode) return false
    if (filters.breed && filters.breed !== 'ALL' && row.breed !== filters.breed) return false
    if (filters.eligibility && filters.eligibility !== 'ALL' && row.eligibility?.status !== filters.eligibility) return false
    if (query) {
      const haystack = [row.cattleCode, row.name, row.earTag, row.breed, row.penCode, row.penName]
        .join(' ').toLocaleLowerCase('vi')
      if (!haystack.includes(query)) return false
    }
    return true
  })
}

export const REPRODUCTION_STATUSES: ReproductiveStatus[] = [
  'AWAITING_BREEDING', 'IN_ESTRUS', 'BRED', 'PREGNANT', 'POST_CALVING',
]

export function statusCounts(rows: readonly ReproductionFemale[]): Record<ReproductiveStatus, number> {
  return Object.fromEntries(REPRODUCTION_STATUSES.map((status) => [
    status,
    rows.filter((row) => row.applicable && row.herdStatus === 'ACTIVE' && row.status === status).length,
  ])) as Record<ReproductiveStatus, number>
}

const occurredAtError = (value: string, today: string): string | null => {
  if (!value || Number.isNaN(Date.parse(value))) return 'Nhập thời điểm sự kiện hợp lệ.'
  if (value > today) return 'Thời điểm sự kiện không được ở tương lai.'
  return null
}

export function validateReproductionCommand(
  command: ReproductionCommand,
  context: { today: string; profile: ReproductionFemale },
): string[] {
  const errors: string[] = []
  const dateError = occurredAtError(command.occurredAt, context.today)
  if (dateError) errors.push(dateError)
  if (context.profile.herdStatus !== 'ACTIVE') errors.push('Chỉ ghi sự kiện cho bò đang nuôi.')
  if (context.profile.sex && context.profile.sex !== 'FEMALE') errors.push('Sự kiện sinh sản chỉ áp dụng cho bò cái.')

  if (command.type === 'BREEDING') {
    if (command.linkedEstrusId) {
      const estrus = context.profile.events.find((event) => event.id === command.linkedEstrusId && event.type === 'ESTRUS' && event.status === 'VALID')
      if (estrus && command.occurredAt < estrus.occurredAt) errors.push('Ngày phối không được trước sự kiện động dục đã chọn.')
    }
    if (command.method === 'NATURAL_SERVICE' && command.sireSource === 'FARM' && !command.farmSireId?.trim()) {
      errors.push('Chọn bò đực giống trong trại.')
    }
    if (command.sireSource === 'EXTERNAL' && !command.externalSireBreed?.trim()) {
      errors.push('Nhập giống bò đực hoặc giống tinh ngoài trại.')
    }
    if (command.method === 'ARTIFICIAL_INSEMINATION' && command.sireSource === 'FARM' && !command.farmSireId?.trim()) {
      errors.push('Chọn bò đực giống trong trại.')
    }
    if (command.semenCode && command.semenCode.length > 50) errors.push('Mã lô tinh tối đa 50 ký tự.')
    if (command.performer && command.performer.length > 100) errors.push('Người thực hiện tối đa 100 ký tự.')
  }

  if (command.type === 'PREGNANCY_CHECK') {
    if (command.estimatedMonths != null && (!Number.isInteger(command.estimatedMonths) || command.estimatedMonths < 1 || command.estimatedMonths > 9)) {
      errors.push('Số tháng mang thai phải từ 1 đến 9.')
    }
    if (command.result !== 'PREGNANT' && command.estimatedMonths != null) errors.push('Chỉ nhập số tháng khi kết quả là Có thai.')
    if (command.linkedBreedingId) {
      const breeding = context.profile.events.find((event) => event.id === command.linkedBreedingId && event.type === 'BREEDING' && event.status === 'VALID')
      if (breeding && command.occurredAt < breeding.occurredAt) errors.push('Ngày khám thai không được trước lần phối đã chọn.')
    }
    if (command.note && command.note.length > 500) errors.push('Ghi chú tối đa 500 ký tự.')
  }

  if (command.type === 'PREGNANCY_UPDATE') {
    if (!context.profile.openPregnancy) errors.push('Không có thai kỳ đang mở để ghi diễn biến.')
    else if (command.occurredAt < context.profile.openPregnancy.confirmedAt) errors.push('Diễn biến thai không được trước ngày xác nhận có thai.')
    if (!command.details.trim()) errors.push('Nhập chi tiết diễn biến.')
    if (command.details.length > 1000) errors.push('Chi tiết tối đa 1.000 ký tự.')
    if (command.updateType !== 'COMPLICATION' && command.linkedHealthCaseId) errors.push('Chỉ liên kết ca sức khỏe khi ghi biến chứng.')
  }

  if (command.type === 'ESTRUS' && command.description && command.description.length > 1000) {
    errors.push('Mô tả tối đa 1.000 ký tự.')
  }

  return errors
}

export class ReproductionValidationError extends Error {
  readonly issues: ReproductionIssue[]
  constructor(issues: ReproductionIssue[]) {
    super(issues[0]?.message ?? 'Dữ liệu sinh sản chưa hợp lệ.')
    this.name = 'ReproductionValidationError'
    this.issues = issues
  }
}

export interface CalvingContext {
  today: string
  existingEarTags: readonly string[]
  /** Lower-cased tag -> who uses it, e.g. "bò BC-000112" (MSG-FE12-08 names the owner). */
  tagOwners?: Readonly<Record<string, string>>
  openPregnancyId?: string | null
  openPregnancyConfirmedAt?: string | null
}

const SEX_NOUN = { MALE: 'đực', FEMALE: 'cái' } as const

/** Field-level problems of a calving (GBR-57, GBR-58, MSG-FE12-06/07/08, MSG-FE05-12). */
export function calvingIssues(command: CalvingCommand, context: CalvingContext): ReproductionIssue[] {
  const issues: ReproductionIssue[] = []
  const dateError = occurredAtError(command.birthAt, context.today)
  if (dateError) issues.push({ field: 'birthAt', message: dateError })
  if (context.openPregnancyId && command.pregnancyId && context.openPregnancyId !== command.pregnancyId) {
    issues.push({ field: 'pregnancyId', message: 'Thai kỳ đã thay đổi. Tải lại hồ sơ trước khi lưu.' })
  }
  if (context.openPregnancyId && context.openPregnancyConfirmedAt && command.birthAt < context.openPregnancyConfirmedAt) {
    issues.push({ field: 'birthAt', message: 'Thời điểm đẻ không được trước ngày xác nhận có thai.' })
  }
  if (command.calves.length < 1 || command.calves.length > 4) issues.push({ message: 'Sự kiện đẻ cần từ 1 đến 4 bê.' })

  const normalize = (tag: string) => tag.trim().toLocaleLowerCase('vi')
  const knownTags = new Set(context.existingEarTags.map(normalize).filter(Boolean))
  for (const [index, calf] of command.calves.entries()) {
    const label = `Bê số ${index + 1}`
    const add = (field: string, message: string) => issues.push({ calf: index, field, message })
    if (calf.outcome === 'LIVE') {
      const registerNow = calf.registration === 'REGISTER_NOW'
      if (calf.sex === 'UNKNOWN') add('sex', `${label}: chọn giới tính.`)
      if (!calf.penId) add('penId', `${label}: chọn chuồng ban đầu.`)
      if (!calf.registration) add('registration', `${label}: chọn cách đăng ký.`)
      if (registerNow && !calf.productionPurpose) add('purpose', `${label}: chọn mục đích nuôi.`)
      if (registerNow && ((calf.productionPurpose === 'SIRE' && calf.sex === 'FEMALE') || (calf.productionPurpose === 'BREEDING' && calf.sex === 'MALE'))) {
        const sex = SEX_NOUN[calf.sex === 'FEMALE' ? 'FEMALE' : 'MALE']
        const other = calf.sex === 'FEMALE' ? 'đực' : 'cái'
        add('purpose', `${label}: mục đích này chỉ dành cho bò ${other}, còn bê là bò ${sex}. Chọn Vỗ béo, Chưa xác định hoặc mục đích hợp giới tính.`)
      }
      const tag = calf.earTag?.trim() ?? ''
      if (!tag && registerNow) add('earTag', `${label}: nhập mã thẻ tai / QR để đăng ký ngay.`)
      if (tag) {
        if (tag.length > 50) add('earTag', `Mã thẻ tai ${label.toLocaleLowerCase('vi')}: tối đa 50 ký tự.`)
        const owner = context.tagOwners?.[normalize(tag)]
        if (knownTags.has(normalize(tag))) add('earTag', owner ? `Mã ${tag} đã dùng cho ${owner}` : `Số tai ${tag} đã được sử dụng.`)
        knownTags.add(normalize(tag))
      }
    }
    if (calf.weightKg != null) {
      if (!Number.isFinite(calf.weightKg) || calf.weightKg < 1 || calf.weightKg > 80) add('weight', `${label}: cân nặng phải từ 1 đến 80 kg.`)
      if (!calf.weightBasis) add('weightBasis', `${label}: chọn cơ sở cân.`)
    }
  }
  return issues
}

export function validateCalving(command: CalvingCommand, context: CalvingContext): string[] {
  return calvingIssues(command, context).map((issue) => issue.message)
}

/** "2 bê: Sống · Đực · 25 kg · BC-000198; Chết lúc sinh · Cái · 19 kg" (voided outcomes are left out). */
export function calvingSummary(calves: readonly CalfOutcome[]): string {
  const valid = calves.filter((calf) => calf.status !== 'VOIDED')
  const describe = (calf: CalfOutcome) => [
    calf.outcome === 'LIVE' ? 'Sống' : 'Chết lúc sinh',
    calf.sex === 'MALE' ? 'Đực' : calf.sex === 'FEMALE' ? 'Cái' : null,
    calf.weightKg != null ? `${calf.weightKg} kg` : null,
    calf.earTag,
  ].filter(Boolean).join(' · ')
  return `${valid.length} bê: ${valid.map(describe).join('; ')}`
}

export const GESTATION_DAYS = 283
/** Tentative (breeding) expected calving date, GBR-53. */
export const expectedCalvingDate = (bredAt: string, days: number = GESTATION_DAYS): string => addDaysText(bredAt, days)

/** Breeding eligibility as "met / 3" over age, weight and open health case (GBR-55), advisory only. */
export function eligibilityScore(eligibility: BreedingEligibility): { met: number; total: 3; label: string; failed: string[]; badge: string } {
  const checks: Array<[boolean, string]> = [
    [eligibility.minimumAgeMet, 'tuổi'], [eligibility.minimumWeightMet, 'cân nặng'], [eligibility.noOpenHealthCase, 'sức khỏe'],
  ]
  const failed = checks.filter(([ok]) => !ok).map(([, name]) => name)
  const met = 3 - failed.length
  const label = failed.length ? `Chưa đạt ${met}/3` : 'Đạt 3/3'
  return { met, total: 3, label, failed, badge: `${label} · ${failed.length ? failed.join(', ') : 'tuổi, cân nặng, sức khỏe'}` }
}

export const METHOD_TEXT = { NATURAL_SERVICE: 'Phối tự nhiên', ARTIFICIAL_INSEMINATION: 'Thụ tinh nhân tạo' } as const

/** Timeline line of a breeding: method · sire + semen code · performer. */
export function breedingDetails(event: { method?: string; sireLabel?: string; semenCode?: string; performer?: string }): string {
  return [
    event.method ? METHOD_TEXT[event.method as keyof typeof METHOD_TEXT] ?? event.method : null,
    [event.sireLabel, event.semenCode].filter(Boolean).join(' ') || null,
    event.performer,
  ].filter(Boolean).join(' · ')
}


export type WorklistTab = ReproductiveStatus | 'DUE_SOON'

export function tabCounts(rows: readonly ReproductionFemale[], now: string = localNowText()): Record<WorklistTab, number> {
  return { ...statusCounts(rows), DUE_SOON: filterWorklist(rows, { status: 'DUE_SOON' }, now).length }
}

const two = (value: number) => String(value).padStart(2, '0')

/** Local date-times are plain `yyyy-mm-ddThh:mm` strings; format them without a Date to avoid time-zone shifts. */
export function formatDateTime(value?: string | null): string {
  if (!value) return '—'
  const [date = '', time = ''] = value.slice(0, 16).split('T')
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}${time ? ` ${time}` : ''}`
}
export const formatDate = (value?: string | null): string => (value ? formatDateTime(value).slice(0, 10) : '—')
export const formatShort = (value?: string | null): string => (value ? formatDateTime(value).slice(0, 16).replace(/\/\d{4}/, '') : '—')

export function addDaysText(value: string, days: number): string {
  const [date = '', time = '00:00'] = value.slice(0, 16).split('T')
  const [year = 1970, month = 1, day = 1] = date.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, day + days))
  return `${shifted.getUTCFullYear()}-${two(shifted.getUTCMonth() + 1)}-${two(shifted.getUTCDate())}T${time}`
}

export function daysBetween(from: string, to: string): number {
  return Math.floor((Date.parse(to) - Date.parse(from)) / DAY_MS)
}

const windowText = (window: { from: string; to: string }) => `${formatShort(window.from)}–${window.to.slice(11, 16)}`

/** Deadline column of the worklist: the suggested window for an estrus female, otherwise the due date. */
export function dueLabel(row: ReproductionFemale): string {
  if (row.eligibility?.status === 'NOT_MET') return '—'
  if (row.status === 'IN_ESTRUS' && row.breedingWindow) return windowText(row.breedingWindow)
  return row.dueAt ? formatDate(row.dueAt) : '—'
}

export function eligibilityLabel(eligibility: NonNullable<ReproductionFemale['eligibility']>): string {
  if (eligibility.status === 'MET') return 'Đạt'
  const details = [
    !eligibility.minimumAgeMet && `tuổi ${eligibility.actualAgeMonths} tháng`,
    !eligibility.minimumWeightMet && (eligibility.actualWeightKg == null ? 'chưa có cân' : `cân ${eligibility.actualWeightKg} kg`),
    !eligibility.noOpenHealthCase && 'có ca bệnh mở',
  ].filter(Boolean)
  return `Chưa đạt${details.length ? ` · ${details.join(' · ')}` : ''}`
}

/** Position of the window and of "now" on a 24 hour bar, in percent. */
export function windowBar(window: { from: string; to: string }, now: string): { left: number; width: number; now: number } {
  const minutes = (value: string) => Number(value.slice(11, 13)) * 60 + Number(value.slice(14, 16))
  return {
    left: (minutes(window.from) / 1440) * 100,
    width: ((minutes(window.to) - minutes(window.from)) / 1440) * 100,
    now: (minutes(now) / 1440) * 100,
  }
}

const STATUS_NOUN: Record<ReproductiveStatus, string> = {
  AWAITING_BREEDING: 'chờ phối', IN_ESTRUS: 'động dục', BRED: 'đã phối', PREGNANT: 'mang thai', POST_CALVING: 'sau sinh',
}

export function technicianRowInfo(row: ReproductionFemale, now: string = localNowText()): { subtitle: string; badge: { label: string; tone: 'ok' | 'warn' | 'err' | 'info' | 'outline' } } {
  const base = `${row.breed} · ${row.penCode}`
  if (row.eligibility?.status === 'NOT_MET' && row.status === 'IN_ESTRUS') {
    return { subtitle: `${base} · ${row.latestWeightKg ?? '—'} kg`, badge: { label: 'Chưa đủ điều kiện', tone: 'err' } }
  }
  const subtitle = row.status ? `${base} · ${STATUS_NOUN[row.status]} ${formatShort(row.statusAt)}` : base
  if (row.status === 'IN_ESTRUS' && row.breedingWindow) {
    return { subtitle, badge: { label: `Phối ${row.breedingWindow.from.slice(11, 16)}–${row.breedingWindow.to.slice(11, 16)}`, tone: 'warn' } }
  }
  if (row.status === 'BRED') return { subtitle, badge: { label: 'Chờ khám thai', tone: 'info' } }
  if (row.status === 'PREGNANT') return isDueSoon(row, now) ? { subtitle, badge: { label: 'Sắp đẻ', tone: 'warn' } } : { subtitle, badge: { label: 'Mang thai', tone: 'ok' } }
  return { subtitle, badge: { label: row.status ? STATUS_NOUN[row.status] : 'Không theo dõi', tone: 'outline' } }
}

/** The action the cattle profile header highlights for a reproductive status. */
export function primaryActionFor(status: ReproductiveStatus | null): ReproductionAction | null {
  if (!status) return null
  return { AWAITING_BREEDING: 'RECORD_ESTRUS', IN_ESTRUS: 'RECORD_BREEDING', BRED: 'RECORD_PREGNANCY_CHECK', PREGNANT: 'RECORD_CALVING', POST_CALVING: 'RECORD_ESTRUS' }[status] as ReproductionAction
}

/** Query value `?m=` that opens the matching dialog on the Reproduction tab (calving is a page instead). */
export const MODAL_FOR_ACTION: Record<Exclude<ReproductionAction, 'RECORD_CALVING'>, string> = {
  RECORD_ESTRUS: 'ghi-dong-duc', RECORD_BREEDING: 'ghi-phoi-giong',
  RECORD_PREGNANCY_CHECK: 'ghi-kham-thai', RECORD_PREGNANCY_UPDATE: 'ghi-dien-bien-thai',
}
export const ACTION_FOR_MODAL = Object.fromEntries(Object.entries(MODAL_FOR_ACTION).map(([action, name]) => [name, action])) as Record<string, Exclude<ReproductionAction, 'RECORD_CALVING'>>

/** Same-type event of this female within 12 hours of the entered time (MSG-FE11-03). */
export function findNearbyEvent(profile: ReproductionFemale, type: 'ESTRUS' | 'BREEDING', occurredAt: string) {
  return profile.events.find((event) => event.type === type && event.status === 'VALID'
    && Math.abs(Date.parse(event.occurredAt) - Date.parse(occurredAt)) < 12 * 3_600_000)
}
