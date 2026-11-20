export type Scenario = 'default' | 'new-farm'
export type ViewerRole = 'OWNER' | 'MANAGER' | 'TECHNICIAN'
export type HerdGroup = 'BREEDING_FEMALE' | 'YOUNG_STOCK' | 'FATTENING' | 'CALF' | 'BREEDING_BULL' | 'OTHER'
export type LifeStage = 'UNWEANED_CALF' | 'WEANED_CALF' | 'YOUNG_STOCK' | 'ADULT'
export type PeriodKey = '7' | '30' | '90' | 'custom'
export type Tone = 'ok' | 'err' | 'warn' | 'info'

// ---- Dashboard (GET /api/farms/{farmId}/dashboard) ----
export interface DashboardFilters {
  period: PeriodKey
  from?: string
  to?: string
  pen?: string
  herdGroup?: HerdGroup | ''
  lifeStage?: LifeStage | ''
}

export interface PenInfo { id?: number; code: string; name: string; capacity: number }

/** Một ô số liệu của đàn: chuồng x nhóm đàn x giai đoạn. Các chỉ số M01-M08 được cộng từ các ô này. */
export interface HerdCell {
  pen: string
  group: HerdGroup
  stage: LifeStage
  head: number
  zebu: number
  pregnant: number
  treating: number
  monitoring: number
  withdrawal: number
  dosesDue: number
  dosesOverdue: number
  calving30: number
  calving7: number
  weighOverdue: number
  adgN: number
  adg30: number
}

export interface AttentionSeed {
  code: string
  pen: string
  group?: HerdGroup
  stage?: LifeStage
  issue: string
  status: string
  tone: Tone
  kind: 'A01' | 'A02' | 'A03' | 'A04'
  to: string | null
  ownerOnly?: boolean
}
export interface AttentionRow extends Omit<AttentionSeed, 'to' | 'ownerOnly'> { to: string | null }

export interface OnboardingState { data: Record<string, boolean>; marked: string[]; dismissed: boolean }

export interface DashboardSeed {
  farmName: string
  serviceLabel: string
  serviceUntil: string
  generatedAt: string
  pens: PenInfo[]
  cells: HerdCell[]
  attention: AttentionSeed[]
  reproduction: { calvingIntervalDays: number; conceptionRate: number; overdueFemales: number } | null
  onboarding: OnboardingState
}

export interface HerdStructureRow { group: HerdGroup; label: string; head: number; pregnant: number | null }

export interface DashboardView {
  farmName: string
  activeCattle: number
  serviceStatus: string
  serviceUntil: string
  generatedAt: string
  timeZone?: string
  empty: boolean
  pens: PenInfo[]
  indicators: {
    m01: { total: number; zebu: number; sind: number; breedBreakdown?: Array<{ label: string; count: number }> }
    m02: { total: number; treating: number; withdrawal: number }
    m03: { total: number | null; overdue: number | null }
    m04: { total: number; within7: number }
    m05: { rows: HerdStructureRow[]; total: number; pregnant: number }
    m06: { value: number | null; byGroup: Array<{ label: string; value: number }>; days: number; unavailable: 'PERIOD_TOO_SHORT' | 'NO_DATA' | null }
    m07: { total: number } | null
    m08: { head: number; capacity: number; percent: number; fullPens: number } | null
    m08Unavailable?: 'FILTER_NOT_SUPPORTED' | null
    m09: { calvingIntervalDays: number | null; conceptionRate: number | null; overdueFemales: number; calvingIntervalN?: number; conceptionRateN?: number } | null
  }
  attention: AttentionRow[]
  attentionUnavailable?: boolean
}

export interface GettingStartedStep { step: string; label: string; screen: string; done: boolean; markable: boolean }
export interface GettingStarted { visible: boolean; dismissed: boolean; allDone: boolean; steps: GettingStartedStep[] }

// ---- Reminders (GET /api/farms/{farmId}/reminders) ----
export type Urgency = 'OVERDUE' | 'TODAY' | 'UPCOMING'
export type ReminderType = 'vaccination' | 'calving' | 'breeding' | 'pregnancy-check' | 'pen-stage' | 'weighing' | 'draft-calf' | 'exit-finishing' | 'feed' | 'health'
export type ReminderTargetType =
  | 'CATTLE_PROFILE' | 'GROWTH_RECORD' | 'HERD_ENTRY' | 'REPRODUCTION_EVENT' | 'PREGNANCY_EPISODE'
  | 'VACCINATION_DOSE' | 'CALVING_EVENT' | 'CATTLE_LIFE_STAGE' | 'PEN_MOVE' | 'CALF_REGISTRATION'
  | 'FEED_ITEM' | 'FEEDING_LOG' | 'DEATH_VOUCHER'

export interface ReminderTarget {
  type: ReminderTargetType
  id: number | null
  cattleId: number | null
  penId: number | null
  date: string | null
  sessionNo: number | null
  code: string | null
}

export interface ReminderSeed {
  id: number | string
  rule: string
  type: ReminderType
  title: string
  code: string | null
  breed: string | null
  pen: string | null
  group?: string
  due: string | null
  windowEnd?: string
  highlighted?: boolean
  basis: string | null
  basisMissing?: string
  parameterVersion: number | null
  source: string
  to: string | null
  openLabel: string | null
  audience: ViewerRole[]
  cattleId?: number | null
  sex?: string | null
  ageMonths?: number | null
  sourceType?: string | null
  sourceId?: string | null
  sourceSummary?: string | null
  basisValues?: Record<string, number | string>
  cattleProfileTarget?: ReminderTarget | null
  sourceTarget?: ReminderTarget | null
  profileTo?: string | null
}

export interface ReminderItem extends Omit<ReminderSeed, 'audience' | 'due'> {
  dueAt: string | null
  urgency: Urgency
  lifecycleStatus: 'ACTIVE'
}

export interface ReminderList { today: string; timeZone?: string; items: ReminderItem[] }

/** SCR-74: the day's reminders (at most six) and the feeding sessions not recorded yet (REM-11). */
export interface TechnicianHome {
  today: string
  reminders: ReminderItem[]
  unrecordedFeedings: number
}

// ---- Management reports (POST /api/farms/{farmId}/dashboard/reports) ----
export type ReportCode = 'RPT-01' | 'RPT-02' | 'RPT-03' | 'RPT-04' | 'RPT-05' | 'RPT-06' | 'RPT-07'
export type ReportFilterKey = 'pen' | 'breed' | 'group' | 'stage'

export interface ReportRequest {
  reportType: ReportCode
  dateFrom: string
  dateTo: string
  pen?: string
  breed?: string
  herdGroup?: HerdGroup | ''
  lifeStage?: LifeStage | ''
}

export interface ReportRowSeed {
  pen: string
  label: string
  groups: HerdGroup[]
  stages: LifeStage[]
  v: Record<string, number>
  missing?: number
}

export type ReportCell = string | { text?: string; badge?: string }
export interface ReportTile { label: string; value: string; note: string }
export interface ReportSection {
  key: string
  title: string
  rowHeading: string
  columns: Array<{ key: string; label: string }>
  rows: Array<{ label: string; cells: Record<string, ReportCell> }>
  totalRow: { label: string; cells: Record<string, ReportCell> } | null
}
export interface ReportMetricChart {
  title: string
  sub: string
  unit: string
  bars: Array<{ label: string; value: number | null; sampleSize?: number | null; numerator?: number | null; denominator?: number | null }>
}
export interface ReportView {
  reportType: ReportCode
  title: string
  from: string
  to: string
  generatedAt: string
  timeZone?: string
  scope: string
  tiles: ReportTile[]
  columns: Array<{ key: string; label: string }>
  rows: Array<{ label: string; cells: Record<string, ReportCell> }>
  totalRow: { label: string; cells: Record<string, ReportCell> } | null
  chart: { title: string; sub: string; bars: Array<{ label: string; value: number | null; numerator?: number; denominator?: number }> } | null
  sections?: ReportSection[]
  charts?: ReportMetricChart[]
  unavailableData: string[]
}

export interface FarmOverviewSeed {
  dashboards: Record<Scenario, DashboardSeed>
  today: string
  reminders: ReminderSeed[]
  unrecordedFeedings: number
  reports: Record<ReportCode, ReportRowSeed[]>
  reportGeneratedAt: string
  conceptionByMonth: Array<{ label: string; value: number }>
}
