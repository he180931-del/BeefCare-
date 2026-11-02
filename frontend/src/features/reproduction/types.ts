export type ReproductiveStatus = 'AWAITING_BREEDING' | 'IN_ESTRUS' | 'BRED' | 'PREGNANT' | 'POST_CALVING'
export type ReproductionRole = 'OWNER' | 'MANAGER' | 'TECHNICIAN'
export type EligibilityStatus = 'MET' | 'NOT_MET'
export type ReproductionEventType = 'ESTRUS' | 'BREEDING' | 'PREGNANCY_CHECK' | 'PREGNANCY_UPDATE' | 'CALVING'
export type ReproductionEventStatus = 'VALID' | 'VOIDED'
export type DataSource = 'DIRECT_OBSERVATION' | 'FARM_NOTEBOOK' | 'EXTERNAL_REPORT'
export type PregnancyCheckResult = 'PREGNANT' | 'NOT_PREGNANT' | 'INCONCLUSIVE'
export type CalfOutcomeType = 'LIVE' | 'STILLBORN'
export type CalfRegistrationChoice = 'DRAFT' | 'REGISTER_NOW'

export interface BreedingEligibility {
  status: EligibilityStatus
  minimumAgeMet: boolean
  minimumWeightMet: boolean
  noOpenHealthCase: boolean
  requiredAgeMonths: number
  actualAgeMonths: number
  requiredWeightKg: number
  actualWeightKg: number | null
  failedConditions: string[]
}

export interface ReproductionEvent {
  id: string
  type: ReproductionEventType
  occurredAt: string
  recordedAt: string
  recorder: string
  status: ReproductionEventStatus
  dataSource?: DataSource
  summary: string
  details?: string
  corrected?: boolean
  voidReason?: string
  linkedEstrusId?: string | null
  linkedBreedingId?: string | null
  pregnancyId?: string | null
  result?: PregnancyCheckResult
  estimatedMonths?: number | null
  expectedCalvingAt?: string | null
  expectedDateBasis?: 'CONFIRMED' | 'TENTATIVE' | 'ESTIMATED' | null
  method?: string
  observer?: string
  performer?: string
  sireLabel?: string
  semenCode?: string
  semenSupplier?: string
  signs?: string[]
  examiner?: string
  updateType?: 'OBSERVATION' | 'COMPLICATION' | 'LOSS'
  linkedHealthCaseId?: string | null
  version: number
}

export interface OpenPregnancy {
  id: string
  pregnancyNumber: number
  linkedBreedingId: string | null
  confirmedAt: string
  expectedCalvingAt: string | null
  expectedDateBasis: 'CONFIRMED' | 'TENTATIVE' | 'ESTIMATED' | null
  estimatedMonths: number | null
  status: 'OPEN'
}

export interface CalfOutcome {
  id: string
  number: number
  outcome: CalfOutcomeType
  sex: 'MALE' | 'FEMALE' | 'UNKNOWN'
  weightKg: number | null
  weightBasis: 'MEASURED' | 'ESTIMATED' | null
  earTag: string | null
  penId: string | null
  penCode: string | null
  breed: string | null
  registrationChoice: CalfRegistrationChoice | null
  registrationStatus: 'PENDING_CONFIRMATION' | 'REGISTERED' | null
  productionPurpose: string | null
  status?: ReproductionEventStatus
  voidReason?: string
}

export interface CalvingRecord {
  id: string
  birthAt: string
  recordedAt: string
  recorder: string
  attendant?: string
  dataSource: DataSource
  pregnancyId: string | null
  course: 'NORMAL' | 'ASSISTED' | 'CAESAREAN'
  damCondition: 'GOOD' | 'MONITORING' | 'CRITICAL'
  retainedPlacenta: boolean
  calves: CalfOutcome[]
  status: ReproductionEventStatus
  corrected?: boolean
  voidReason?: string
  version: number
}

export interface ReproductionFemale {
  cattleId: string
  cattleCode: string
  name: string
  earTag: string
  sex: 'FEMALE'
  breed: string
  penId: string
  penCode: string
  penName: string
  herdStatus: 'ACTIVE' | 'EXIT_PENDING' | 'EXITED' | 'VOIDED'
  lifeStage: 'YOUNG_STOCK' | 'ADULT' | 'OTHER'
  purposeType: 'BREEDING' | 'UNDECIDED' | 'OTHER'
  applicable: boolean
  status: ReproductiveStatus | null
  statusAt: string | null
  ageMonths: number
  latestWeightKg: number | null
  parity: number
  earlierCalvings: number
  servicesInCurrentCycle: number
  lastCalvingAt: string | null
  breedingWindow: { from: string; to: string } | null
  nextAction: string
  dueAt: string | null
  eligibility: BreedingEligibility | null
  openHealthCase: boolean
  openPregnancy: OpenPregnancy | null
  events: ReproductionEvent[]
  calvings: CalvingRecord[]
  revisions: ReproductionRevision[]
  indicators: {
    ageAtFirstCalvingMonths: number | null
    lastCalvingIntervalDays: number | null
    daysSinceLastCalving: number | null
    daysOpen: number | null
    conceptionSummary: string
    conceptionDetail?: string
    overdueForConception: boolean
  }
  declaredPregnancyAtEntryMonths: number | null
  version: number
}

export interface WorklistFilters {
  status?: ReproductiveStatus | 'DUE_SOON' | 'ALL'
  query?: string
  penCode?: string
  breed?: string
  eligibility?: EligibilityStatus | 'ALL'
}

export type ReproductionCommand =
  | {
      type: 'ESTRUS'
      occurredAt: string
      observer?: string
      signs?: string[]
      description?: string
      dataSource?: DataSource
    }
  | {
      type: 'BREEDING'
      occurredAt: string
      linkedEstrusId?: string | null
      dataSource?: DataSource
      method: 'NATURAL_SERVICE' | 'ARTIFICIAL_INSEMINATION'
      sireSource: 'FARM' | 'EXTERNAL'
      farmSireId?: string
      externalSireBreed?: string
      semenCode?: string
      semenSupplier?: string
      performer?: string
      note?: string
    }
  | {
      type: 'PREGNANCY_CHECK'
      occurredAt: string
      linkedBreedingId?: string | null
      dataSource?: DataSource
      result: PregnancyCheckResult
      method?: 'ULTRASOUND' | 'RECTAL' | 'OTHER'
      estimatedMonths?: number | null
      examiner?: string
      note?: string
    }
  | {
      type: 'PREGNANCY_UPDATE'
      occurredAt: string
      dataSource?: DataSource
      updateType: 'OBSERVATION' | 'COMPLICATION' | 'LOSS'
      details: string
      linkedHealthCaseId?: string | null
    }

export interface CalvingCommand {
  birthAt: string
  pregnancyId?: string | null
  dataSource?: DataSource
  attendant?: string
  course: 'NORMAL' | 'ASSISTED' | 'CAESAREAN'
  damCondition: 'GOOD' | 'MONITORING' | 'CRITICAL'
  retainedPlacenta: boolean
  calves: Array<{
    outcome: CalfOutcomeType
    sex: 'MALE' | 'FEMALE' | 'UNKNOWN'
    weightKg?: number | null
    weightBasis?: 'MEASURED' | 'ESTIMATED' | null
    earTag?: string
    penId?: string
    penCode?: string
    breed?: string
    registration?: CalfRegistrationChoice
    productionPurpose?: string
  }>
}

export interface ReproductionRevision {
  id: string
  eventId: string
  reason: string
  changedAt: string
  changedBy: string
  before: Partial<ReproductionEvent | CalvingRecord>
  after: Partial<ReproductionEvent | CalvingRecord>
}


/** One validation problem; `calf` (0-based) and `field` point at the input to mark red, none means the whole form. */
export interface ReproductionIssue {
  calf?: number
  field?: string
  message: string
}
