/**
 * HTTP contract shapes used by the health adapter.
 *
 * These are intentionally kept separate from `types.ts`: the latter is the
 * feature's view model, while these values describe the wire format returned
 * by the backend (and the payloads sent to it).
 */
export type HealthBackendDto = Record<string, unknown>

export type HealthCattleDto = HealthBackendDto
export type HealthMedicineDto = HealthBackendDto
export type HealthCaseDto = HealthBackendDto
export type HealthTimelineDto = HealthBackendDto
export type HealthMemberDto = HealthBackendDto
export type HealthPenDto = HealthBackendDto
export type HealthPendingExitDto = HealthBackendDto

export interface HealthOpenCaseRequestDto {
  cattleId: number
  observedAt: string
  observerId: number | null
  temperatureC: number | null
  signs: string
  diagnosis: string | null
  suspectedContagious: boolean
  severity: string | null
}

export interface HealthTreatmentRequestDto {
  expectedVersion: number | null
  medicineId: number | null
  administeredAt: string
  dose: string
  route: string | null
  courseDays: number | null
  withdrawalDays: number | null
  performerId?: number
  performerName?: string | null
  veterinaryAdvice: string | null
  returnToOpen?: boolean
}

export interface HealthStatusRequestDto {
  expectedVersion: number | null
  action: string
  latestProgress: string | null
  progress: string | null
  suspectedDiagnosis: string | null
  suspectedContagious: boolean
  outcome: string | null
  confirmedById: number | null
  /** D58: thời điểm của lần cập nhật (theo dõi, ngày mạn tính, lúc đóng ca). */
  observedAt: string
  temperatureC: number | null
}

export interface HealthObservationCorrectionRequestDto {
  expectedVersion: number | null
  reason: string
  observedAt: string | null
  temperatureC: number | null
  signs: string | null
  progress: string | null
  observerId: number | null
}

export interface HealthTreatmentCorrectionRequestDto {
  expectedVersion: number | null
  reason: string
  medicineId: number | null
  administeredAt: string | null
  dose: string | null
  route: string | null
  courseDays: number | null
  withdrawalDays: number | null
  performerId?: number
  performerName?: string | null
}

export interface HealthVoidRequestDto {
  expectedVersion: number | null
  reason: string
}
