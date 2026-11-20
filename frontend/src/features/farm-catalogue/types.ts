export type AvailabilityFilter = '' | 'ACTIVE' | 'INACTIVE'
export interface CatalogueFilters { q?: string; status?: AvailabilityFilter }

export type Route = 'INTRAMUSCULAR' | 'SUBCUTANEOUS' | 'INTRAVENOUS' | 'ORAL' | 'INTRANASAL' | 'TOPICAL' | 'OTHER'
export type PurposeType = 'BREEDING' | 'FATTENING' | 'SIRE' | 'UNDECIDED'

export interface CatalogueBase { id: number; code: string; name: string; available: boolean; version: number }

// ---- Giống bò (BreedView / BreedWrite) ----
/** referencedCount: records using the breed (MSG-FE18-03); 0 means it may be deleted (Q4). */
export interface Breed extends CatalogueBase { group: string; description: string; activeCattle: number; referenced: boolean; referencedCount?: number }
export interface BreedCommand { code: string; name: string; group: string; description: string; available: boolean; expectedVersion?: number }

// ---- Mục đích nuôi (PurposeView / PurposeWrite) ----
export interface ReceivingPen { id: number; code: string; name: string }
export interface Purpose extends CatalogueBase {
  purposeType: PurposeType
  description: string
  activeCattle: number
  referenced: boolean
  receivingPens: ReceivingPen[]
  /** Cattle, calf outcomes and pen criteria using the purpose (MSG-FE18-03 / -09); 0 = may be deleted (Q4). */
  referencedCount?: number
}
export interface PurposeCommand { code: string; name: string; purposeType: PurposeType; description: string; available: boolean; expectedVersion?: number }

// ---- Vắc-xin (CatalogueItem / VaccineCommand) ----
// scheduleCount / recordCount chưa có trong CatalogueItem: backend cần trả số lịch và mũi tiêm đang tham chiếu.
export interface Vaccine extends CatalogueBase {
  diseasePrevented: string
  manufacturer: string
  dose: string
  route: Route | ''
  boosterInterval: number | null
  withdrawalDays: number
  scheduleCount: number
  recordCount: number
  /** Missing reference dose or route: the record takes them from the label (R-18-07). */
  completeFromLabel?: boolean
}
export interface VaccineCommand {
  code: string
  name: string
  diseasePrevented: string
  manufacturer: string
  dose: string
  route: Route | ''
  boosterInterval: number | null
  withdrawalDays: number | null
  available: boolean
  expectedVersion?: number
}

// ---- Thuốc tham chiếu (CatalogueItem / MedicineCommand) ----
export interface Medicine extends CatalogueBase {
  description: string
  dose: string
  route: Route | ''
  withdrawalDays: number
  usageCount: number
}
export interface MedicineCommand {
  code: string
  name: string
  description: string
  dose: string
  route: Route | ''
  withdrawalDays: number | null
  available: boolean
  expectedVersion?: number
}

// ---- Tham số trạng thái & nhắc việc ----
export const NUMERIC_PARAMETER_KEYS = [
  'weaningAgeMonths', 'youngStockAgeMonths', 'adultAgeMonths',
  'minBreedingAgeMonths', 'minBreedingWeightKg',
  'gestationLengthDays', 'pregnancyCheckDays', 'recheckDays',
  'calvingPrepLeadDays', 'postCalvingIntervalDays',
  'windowStartHours', 'windowEndHours', 'estrusCycleDays',
  'weighingIntervalDays', 'vaccinationLeadDays', 'targetFinishingWeightKg',
] as const
export type NumericParameterKey = (typeof NUMERIC_PARAMETER_KEYS)[number]
export type BcsScale = '1-5' | '1-9'
// null chỉ hợp lệ với targetFinishingWeightKg (để trống = tắt dự báo xuất bán).
export type ParameterValues = Record<NumericParameterKey, number | null> & { bcsScale: BcsScale }

export interface ParameterVersionRecord {
  id: number
  versionNo: number
  effectiveFrom: string
  parameters: ParameterValues
  sourceNote: string
  savedBy: string
}
export type ParameterVersionStatus = 'CURRENT' | 'SCHEDULED' | 'PAST'
export interface ParameterVersion extends ParameterVersionRecord { changes: string; status: ParameterVersionStatus }

// ParameterVersionCommand: gestationLengthDays nằm riêng trong DTO nên được nhân đôi từ parameters.
export interface ParameterVersionCommand {
  parameters: ParameterValues
  gestationLengthDays: number | null
  effectiveFrom: string
  sourceNote: string
  /** Version number the form was loaded with: another save in between answers MSG-COM-05 (R-18-15). */
  baseVersion?: number
}
