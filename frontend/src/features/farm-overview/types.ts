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

export interface PenInfo { code: string; name: string; capacity: number }

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
  group: HerdGroup
  stage: LifeStage
  issue: string
  status: string
  tone: Tone
  kind: 'A01' | 'A02' | 'A03' | 'A04'
  to: string
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
  empty: boolean
  pens: PenInfo[]
  indicators: {
    m01: { total: number; zebu: number; sind: number }
    m02: { total: number; treating: number; withdrawal: number }
    m03: { total: number; overdue: number }
    m04: { total: number; within7: number }
    m05: { rows: HerdStructureRow[]; total: number; pregnant: number }
    m06: { value: number | null; byGroup: Array<{ label: string; value: number }>; days: number; unavailable: 'PERIOD_TOO_SHORT' | 'NO_DATA' | null }
    m07: { total: number } | null
    m08: { head: number; capacity: number; percent: number; fullPens: number } | null
    m09: { calvingIntervalDays: number; conceptionRate: number; overdueFemales: number } | null
  }
  attention: AttentionRow[]
}

export interface GettingStartedStep { step: string; label: string; screen: string; done: boolean; markable: boolean }
export interface GettingStarted { visible: boolean; dismissed: boolean; allDone: boolean; steps: GettingStartedStep[] }

// ---- Reminders (GET /api/farms/{farmId}/reminders) ----
export type Urgency = 'OVERDUE' | 'TODAY' | 'UPCOMING'
export type ReminderType = 'vaccination' | 'calving' | 'breeding' | 'pregnancy-check' | 'pen-stage' | 'weighing' | 'draft-calf' | 'exit-finishing' | 'feed' | 'health'

export interface ReminderSeed {
  id: number
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
  to: string
  openLabel: string
  audience: ViewerRole[]
}

export interface ReminderItem extends Omit<ReminderSeed, 'audience' | 'due'> {
  dueAt: string | null
  urgency: Urgency
  lifecycleStatus: 'ACTIVE'
}

export interface ReminderList { today: string; items: ReminderItem[] }

export interface TechnicianHome {
  farmName: string
  today: string
  feeding: { label: string; unrecorded: number; total: number }
  reminders: ReminderItem[]
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
export interface ReportView {
  reportType: ReportCode
  title: string
  from: string
  to: string
  generatedAt: string
  scope: string
  tiles: ReportTile[]
  columns: Array<{ key: string; label: string }>
  rows: Array<{ label: string; cells: Record<string, ReportCell> }>
  totalRow: { label: string; cells: Record<string, ReportCell> } | null
  chart: { title: string; sub: string; bars: Array<{ label: string; value: number }> } | null
  unavailableData: string[]
}

export interface FarmOverviewSeed {
  dashboards: Record<Scenario, DashboardSeed>
  today: string
  reminders: ReminderSeed[]
  feeding: TechnicianHome['feeding']
  reports: Record<ReportCode, ReportRowSeed[]>
  reportGeneratedAt: string
  conceptionByMonth: Array<{ label: string; value: number }>
}
