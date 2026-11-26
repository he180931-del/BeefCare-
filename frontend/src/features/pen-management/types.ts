export type PenStatus = 'ACTIVE' | 'INACTIVE'

export type PenCode = string

/** Serialized cattle identifier and display label; kept local to avoid a type dependency cycle with Cattle. */
export type PenCowLink = [string, string]

export interface Pen {
  id?: number
  code: PenCode
  name: string
  count: number
  capacity: number
  /** Backend-computed free places; use this for availability displays when present. */
  freePlaces?: number
  status: PenStatus
  cows: PenCowLink[]
  accept?: string
  purpose?: string
  stage?: string
  minAge?: number | null
  minAgeOp?: string
  minWeight?: number | null
  minWeightOp?: string
  minMonths?: number
  minKg?: number
  sex?: string
  tag?: string
  version?: string
  /** Backend optimistic-lock version of the pen (sent back as expectedVersion). */
  lockVersion?: number
  /** Current reception-criteria version (SCR-17 field 12). */
  criteriaVersionNo?: number
  criteriaEffectiveFrom?: string
  desc?: string
  /** Reception constraints returned by the backend pen catalogue. */
  receptionCriteria?: {
    purposeTypes?: string[]
    lifeStages?: string[]
    sex?: string
    minAgeMonths?: number | null
    minWeightKg?: number | null
  }
  [key: string]: unknown
}
