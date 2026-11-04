import { expandLocalTable, isStressGenerated } from '../../app/localStressData'
import { initialCows, type CowSeed } from '../../data/cowsData'

export const REPRO_STORAGE_KEY = 'reproduction-state'
const ROOT_KEY = 'beefcare-ui-demo'

export type ReproEventType = 'ESTRUS' | 'BREEDING'
export type RecordStatus = 'VALID' | 'VOIDED'
export type PregnancyResult = 'PREGNANT' | 'NOT_PREGNANT' | 'INCONCLUSIVE'
export type PregnancyUpdateType = 'OBSERVATION' | 'COMPLICATION' | 'LOSS'
export type CalfOutcomeType = 'LIVE' | 'STILLBORN'
export type PregnancyEpisodeStatus = 'OPEN' | 'CALVED' | 'LOST' | 'DAM_EXITED' | 'VOIDED'
export type ReminderCode = 'REM-02' | 'REM-03' | 'REM-04' | 'REM-05' | 'REM-07' | 'REM-08' | 'REM-09'

export interface ReproEvent {
  id: string
  code: string
  type: ReproEventType
  at: string
  dataSource: string
  observer: string
  description: string
  method?: 'NATURAL' | 'AI'
  sireSource?: 'ON_FARM' | 'EXTERNAL'
  sire?: string
  sireBreed?: string
  semenBatch?: string
  semenSupplier?: string
  performer?: string
  linkedEstrusId?: string
  expectedCalvingDate?: string
  status: RecordStatus
  corrected?: boolean
  recordedAt: string
}

export interface PregnancyCheck {
  id: string
  code: string
  linkedBreedingId?: string
  checkedAt: string
  dataSource: string
  result: PregnancyResult
  method: string
  examiner: string
  expectedCalvingDate?: string
  note?: string
  status: RecordStatus
  corrected?: boolean
  recordedAt: string
  pregnancyEpisodeId?: string
}

export interface PregnancyEpisode {
  id: string
  code: string
  pregnancyNumber: string
  confirmingCheckId: string
  linkedBreedingId?: string
  expectedCalvingDate?: string
  expectedCalvingBasis?: 'TENTATIVE' | 'CONFIRMED'
  status: PregnancyEpisodeStatus
  openedAt: string
  closedAt?: string
  closingReason?: string
  version?: number
}

export interface PregnancyUpdate {
  id: string
  code: string
  pregnancyNumber: string
  occurredAt: string
  dataSource: string
  type: PregnancyUpdateType
  details: string
  healthCase?: string
  status: RecordStatus
  corrected?: boolean
  recordedAt: string
}

export interface CalfOutcome {
  id: string
  outcome: CalfOutcomeType
  sex: 'MALE' | 'FEMALE' | 'UNKNOWN'
  birthWeight: number
  weightBasis: 'MEASURED' | 'ESTIMATED'
  tag?: string
  initialPen?: string
  breed?: string
  registration?: 'DRAFT' | 'REGISTER_NOW'
  purpose?: string
  registeredCattleCode?: string
  registrationState?: 'PENDING_CONFIRMATION' | 'REGISTERED' | 'DIED_BEFORE_REGISTRATION'
  damCode?: string
  sireCode?: string
  proposedPen?: string
  lifeStage?: 'UNWEANED_CALF'
  status: RecordStatus
  corrected?: boolean
}

export interface CalvingRecord {
  id: string
  code: string
  pregnancyCheckId?: string
  birthAt: string
  dataSource: string
  attendant: string
  course: 'NORMAL' | 'ASSISTED' | 'CAESAREAN'
  damCondition: 'GOOD' | 'MONITOR' | 'CRITICAL'
  retainedPlacenta: boolean
  calves: CalfOutcome[]
  status: RecordStatus
  corrected?: boolean
  recordedAt: string
}

export interface AuditRevision {
  id: string
  recordType: 'ESTRUS' | 'BREEDING' | 'PREGNANCY_CHECK' | 'PREGNANCY_UPDATE' | 'CALVING' | 'CALF_OUTCOME'
  recordId: string
  action: 'CORRECT' | 'VOID'
  before: unknown
  after?: unknown
  reason: string
  version: number
  createdAt: string
  createdBy: string
}

export interface Reminder {
  id: string
  code: string
  type: 'BREEDING_WINDOW' | 'PREGNANCY_CHECK' | 'CALVING' | 'POST_CALVING'
  label: string
  due: string
  status: 'ACTIVE' | 'RESOLVED' | 'CANCELLED'
  reminderCode?: ReminderCode
}

export interface ReproductionState {
  events: ReproEvent[]
  checks: PregnancyCheck[]
  pregnancyEpisodes: PregnancyEpisode[]
  updates: PregnancyUpdate[]
  calvings: CalvingRecord[]
  revisions: AuditRevision[]
  reminders: Reminder[]
}

const blankState = (): ReproductionState => ({ events: [], checks: [], pregnancyEpisodes: [], updates: [], calvings: [], revisions: [], reminders: [] })

const storedRoot = (): Record<string, any> => {
  try { return JSON.parse(window.localStorage.getItem(ROOT_KEY) || '{}') as Record<string, any> } catch { return {} }
}

const generatedTag = (code: string) => `TAI-${code.replace(/\D/g, '').slice(-6).padStart(6, '0')}`

export function readReproductionCows(): CowSeed[] {
  if (typeof window === 'undefined') return initialCows
  const raw = (storedRoot().account?.['cattle-preview'] as CowSeed[] | undefined) || initialCows
  return expandLocalTable('reproduction-cattle', raw).map((cow) => isStressGenerated(cow) ? {
    ...cow,
    sex: 'Cái',
    status: 'ACTIVE',
    purpose: 'Sinh sản',
    stage: 'Bò cái sinh sản',
    name: `Bò cái ${cow.code}`,
    tag: generatedTag(cow.code),
  } : cow)
}

export function readReproductionState(): ReproductionState {
  if (typeof window === 'undefined') return seededState()
  try {
    const root = storedRoot()
    const saved = root.account?.[REPRO_STORAGE_KEY] as Partial<ReproductionState> | undefined
    if (saved && Array.isArray(saved.events)) return { ...blankState(), ...saved, pregnancyEpisodes: Array.isArray(saved.pregnancyEpisodes) ? saved.pregnancyEpisodes : [] }
  } catch { /* use fixture */ }
  return seededState()
}

export function writeReproductionState(state: ReproductionState) {
  if (typeof window === 'undefined') return
  const root = storedRoot()
  window.localStorage.setItem(ROOT_KEY, JSON.stringify({ ...root, account: { ...(root.account || {}), [REPRO_STORAGE_KEY]: state } }))
}

export function selectedCowCode(): string | undefined {
  if (typeof window === 'undefined') return undefined
  const fromUrl = new URLSearchParams(window.location.search).get('cattle')
  if (fromUrl) return fromUrl
  try { return (storedRoot().account?.['selected-cattle'] as { code?: string } | undefined)?.code } catch { return undefined }
}

export function selectCow(code: string) {
  if (typeof window === 'undefined') return
  const root = storedRoot()
  window.localStorage.setItem(ROOT_KEY, JSON.stringify({ ...root, account: { ...(root.account || {}), 'selected-cattle': { code } } }))
}

function seededState(): ReproductionState {
  const now = '2026-10-20T09:30'
  return {
    events: [
      { id: 'repro-125-estrus', code: 'BC-000125', type: 'ESTRUS', at: '2026-10-16T06:30', dataSource: 'DIRECT', observer: 'Nguyễn An', description: 'Đứng yên khi cưỡi, dịch nhầy trong', status: 'VALID', recordedAt: '2026-10-16T07:00' },
      { id: 'repro-125-breeding', code: 'BC-000125', type: 'BREEDING', at: '2026-10-18T07:30', dataSource: 'DIRECT', observer: 'Trần Quốc Long', description: 'Phối theo biểu hiện động dục', method: 'AI', sireSource: 'EXTERNAL', sireBreed: 'Brahman đỏ', semenBatch: 'AI-221', semenSupplier: 'Trại giống Mộc Châu', performer: 'Nguyễn An', linkedEstrusId: 'repro-125-estrus', expectedCalvingDate: '2027-07-28', status: 'VALID', recordedAt: now },
      { id: 'repro-087-estrus', code: 'BC-000087', type: 'ESTRUS', at: '2026-09-01T05:45', dataSource: 'DIRECT', observer: 'Nguyễn An', description: 'Dịch nhầy, đứng yên khi cưỡi', status: 'VALID', recordedAt: '2026-09-01T06:00' },
      { id: 'repro-087-breeding', code: 'BC-000087', type: 'BREEDING', at: '2026-09-03T07:00', dataSource: 'DIRECT', observer: 'Trần Quốc Long', description: 'Phối tự nhiên', method: 'NATURAL', sireSource: 'ON_FARM', sire: 'BC-000017', performer: 'Trần Quốc Long', linkedEstrusId: 'repro-087-estrus', expectedCalvingDate: '2027-06-13', status: 'VALID', recordedAt: now },
    ],
    checks: [{ id: 'check-087-1', code: 'BC-000087', linkedBreedingId: 'repro-087-breeding', checkedAt: '2026-10-01T09:00', dataSource: 'DIRECT', result: 'PREGNANT', method: 'ULTRASOUND', examiner: 'BS Trần Văn Bình', expectedCalvingDate: '2027-06-13', note: 'Thai phát triển bình thường', status: 'VALID', recordedAt: now }],
    pregnancyEpisodes: [],
    updates: [{ id: 'update-087-1', code: 'BC-000087', pregnancyNumber: 'PREG-087-2026-01', occurredAt: '2026-10-12T08:00', dataSource: 'DIRECT', type: 'OBSERVATION', details: 'Ăn uống tốt, thai ổn định', status: 'VALID', recordedAt: now }],
    calvings: [], revisions: [], reminders: [
      { id: 'rem-125-check', code: 'BC-000125', type: 'PREGNANCY_CHECK', label: 'Khám thai lần 1', due: '2026-11-17', status: 'ACTIVE' },
      { id: 'rem-087-calving', code: 'BC-000087', type: 'CALVING', label: 'Chuẩn bị chuồng đẻ', due: '2027-05-14', status: 'ACTIVE' },
    ],
  }
}

export function femaleApplies(cow: CowSeed): boolean {
  const stage = String(cow.stage || '').trim().toUpperCase()
  const stageApplies = stage === 'BÒ TƠ' || stage === 'BÒ CÁI SINH SẢN' || stage === 'YOUNG_STOCK' || stage === 'ADULT'
  return cow.sex === 'Cái' && cow.status === 'ACTIVE' && cow.purpose === 'Sinh sản' && stageApplies
}

export type ReproStatus = 'AWAITING_BREEDING' | 'IN_ESTRUS' | 'BRED' | 'PREGNANT' | 'POST_CALVING' | 'NOT_APPLICABLE'

export function validFor<T extends { code: string; status: RecordStatus }>(rows: T[], code: string) { return rows.filter((row) => row.code === code && row.status === 'VALID') }

export function openPregnancyFor(state: ReproductionState, code: string): PregnancyEpisode | undefined {
  const explicit = (state.pregnancyEpisodes || []).filter((row) => row.code === code && row.status === 'OPEN').sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime())
  if (explicit[0]) return explicit[0]
  const checks = validFor(state.checks, code).filter((row) => row.result === 'PREGNANT')
  const latestCheck = latest(checks)
  if (!latestCheck) return undefined
  const laterUpdate = validFor(state.updates, code).find((row) => row.occurredAt >= latestCheck.checkedAt && row.type === 'LOSS')
  const laterCalving = validFor(state.calvings, code).find((row) => row.birthAt >= latestCheck.checkedAt)
  return laterUpdate || laterCalving ? undefined : {
    id: latestCheck.pregnancyEpisodeId || `episode-${latestCheck.id}`,
    code,
    pregnancyNumber: `PREG-${code.slice(-3)}-${new Date(latestCheck.checkedAt).getFullYear()}`,
    confirmingCheckId: latestCheck.id,
    linkedBreedingId: latestCheck.linkedBreedingId,
    expectedCalvingDate: latestCheck.expectedCalvingDate,
    expectedCalvingBasis: 'CONFIRMED',
    status: 'OPEN',
    openedAt: latestCheck.checkedAt,
  }
}

export function nowDateTimeInput(now = new Date()): string {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

export function reminderCodeFor(type: Reminder['type']): ReminderCode {
  return ({ BREEDING_WINDOW: 'REM-02', PREGNANCY_CHECK: 'REM-04', CALVING: 'REM-05', POST_CALVING: 'REM-07' } as const)[type]
}

/** Rebuilds only the derived reminder rows for one dam; history remains auditable. */
export function reconcileReminders(state: ReproductionState, code: string, now = new Date()): Reminder[] {
  const historical = state.reminders.filter((row) => row.code !== code || row.status !== 'ACTIVE')
  const active: Reminder[] = []
  const events = validFor(state.events, code)
  const latestEstrus = events.find((row) => row.type === 'ESTRUS')
  const latestBreeding = events.find((row) => row.type === 'BREEDING')
  const checks = validFor(state.checks, code)
  const latestCheck = checks[0] ? [...checks].sort(byTime('checkedAt'))[0] : undefined
  const episode = openPregnancyFor(state, code)
  const latestCalving = latest(validFor(state.calvings, code))
  if (latestEstrus && now.getTime() - new Date(latestEstrus.at).getTime() <= 24 * 60 * 60 * 1000 && (!latestBreeding || latestEstrus.at > latestBreeding.at)) active.push({ id: `REM-02-${latestEstrus.id}`, code, type: 'BREEDING_WINDOW', reminderCode: 'REM-02', label: 'Cửa sổ phối giống', due: new Date(new Date(latestEstrus.at).getTime() + 24 * 60 * 60 * 1000).toISOString(), status: 'ACTIVE' })
  if (latestBreeding && (!latestCheck || latestBreeding.at > latestCheck.checkedAt)) active.push({ id: `REM-03-${latestBreeding.id}`, code, type: 'PREGNANCY_CHECK', reminderCode: 'REM-03', label: 'Khám thai', due: new Date(new Date(latestBreeding.at).getTime() + 30 * 86400000).toISOString(), status: 'ACTIVE' })
  if (latestCheck?.result === 'INCONCLUSIVE' && (!latestBreeding || latestCheck.checkedAt >= latestBreeding.at)) active.push({ id: `REM-04-${latestCheck.id}`, code, type: 'PREGNANCY_CHECK', reminderCode: 'REM-04', label: 'Khám thai lại', due: new Date(new Date(latestCheck.checkedAt).getTime() + 14 * 86400000).toISOString(), status: 'ACTIVE' })
  if (episode) active.push({ id: `REM-05-${episode.id}`, code, type: 'CALVING', reminderCode: 'REM-05', label: 'Theo dõi thai kỳ / chuẩn bị đẻ', due: episode.expectedCalvingDate || 'Chưa xác định', status: 'ACTIVE' })
  if (latestCalving?.status === 'VALID') active.push({ id: `REM-07-${latestCalving.id}`, code, type: 'POST_CALVING', reminderCode: 'REM-07', label: latestCalving.retainedPlacenta ? 'Theo dõi sau sinh · nhau thai' : 'Theo dõi sau sinh', due: new Date(new Date(latestCalving.birthAt).getTime() + 86400000).toISOString(), status: 'ACTIVE' })
  return [...active, ...historical]
}

export function statusFor(state: ReproductionState, cow: CowSeed, now = new Date()): ReproStatus {
  if (!femaleApplies(cow)) return 'NOT_APPLICABLE'
  const checks = validFor(state.checks, cow.code).sort(byTime('checkedAt'))
  const calvings = validFor(state.calvings, cow.code).sort(byTime('birthAt'))
  const updates = validFor(state.updates, cow.code).sort(byTime('occurredAt'))
  const events = validFor(state.events, cow.code).sort(byTime('at'))
  const latestCalving = calvings[0]
  const latestBreeding = events.find((row) => row.type === 'BREEDING')
  const latestEstrus = events.find((row) => row.type === 'ESTRUS')
  const latestCheck = checks[0]
  const latestUpdate = updates[0]
  const openEpisode = openPregnancyFor(state, cow.code)
  if (latestCalving && (!latestCheck || latestCalving.birthAt > latestCheck.checkedAt) && (now.getTime() - new Date(latestCalving.birthAt).getTime()) < 45 * 86400000) return 'POST_CALVING'
  if (openEpisode) return 'PREGNANT'
  if (latestUpdate?.type === 'LOSS' && (!latestCheck || latestUpdate.occurredAt > latestCheck.checkedAt)) return 'AWAITING_BREEDING'
  if (latestCheck && latestCheck.result === 'NOT_PREGNANT' && (!latestBreeding || latestCheck.checkedAt >= latestBreeding.at)) return 'AWAITING_BREEDING'
  if (latestCheck && latestCheck.result === 'INCONCLUSIVE' && (!latestBreeding || latestCheck.checkedAt >= latestBreeding.at)) return 'BRED'
  if (latestBreeding && (!latestCheck || latestBreeding.at > latestCheck.checkedAt)) return 'BRED'
  if (latestEstrus && (now.getTime() - new Date(latestEstrus.at).getTime()) <= 24 * 60 * 60 * 1000) return 'IN_ESTRUS'
  return 'AWAITING_BREEDING'
}

export function latest<T extends { at?: string; checkedAt?: string; occurredAt?: string; birthAt?: string }>(rows: T[]): T | undefined {
  return [...rows].sort((a, b) => timeOf(b) - timeOf(a))[0]
}

export function timeOf(row: { at?: string; checkedAt?: string; occurredAt?: string; birthAt?: string }) { return new Date(row.at || row.checkedAt || row.occurredAt || row.birthAt || 0).getTime() }
export function byTime(field: 'at' | 'checkedAt' | 'occurredAt' | 'birthAt') { return (a: any, b: any) => new Date(b[field]).getTime() - new Date(a[field]).getTime() }

export function statusLabel(status: ReproStatus) {
  return { AWAITING_BREEDING: 'Chờ phối', IN_ESTRUS: 'Động dục', BRED: 'Đã phối · chờ khám', PREGNANT: 'Mang thai', POST_CALVING: 'Sau sinh', NOT_APPLICABLE: 'Không áp dụng' }[status]
}

export function formatDate(value?: string) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: value.includes('T') ? 'short' : undefined })
}
