// Request / response shapes of the cattle REST resources (CattleResource, PenMoveResource) as the backend sends them.
// Mapping to the screen model is in cattleMapper.ts.

export type BackendProfile = {
  id?: number
  displayCode?: string
  earTagNumber?: string | null
  name?: string | null
  sex?: string | null
  birthDate?: string | null
  birthDateAccuracy?: string | null
  breedId?: number | null
  breedName?: string | null
  purposeId?: number | null
  purposeName?: string | null
  purposeType?: string | null
  lifeStage?: string | null
  herdStatus?: string | null
  herdGroup?: string | null
  exitPending?: boolean
  version?: number
  penId?: number | null
  penCode?: string | null
  penName?: string | null
  penSince?: string | null
  exitType?: string | null
  exitDate?: string | null
  latestWeightKg?: number | null
  latestWeightDate?: string | null
  weightBasis?: string | null
  latestBcs?: number | null
  adg90?: number | null
  healthState?: string | null
  withdrawalActive?: boolean
  withdrawalEndDate?: string | null
  suspectedContagious?: boolean | null
  vaccinationOverdue?: number | null
  reproductiveStatus?: string | null
  expectedCalvingDate?: string | null
  expectedBasis?: string | null
  breedingEligible?: boolean | null
  failedBreedingConditions?: string[] | null
  colourMarkings?: string | null
  notes?: string | null
  canUpdate?: boolean
  canChangePurpose?: boolean
  entry?: { id?: number | null; voucherId?: number | null; source?: string | null; entryDate?: string | null; weightKg?: number | null; weightBasis?: string | null; voucherCode?: string | null; seller?: string | null } | null
  quarantineUntil?: string | null
  photoUrl?: string | null
  damId?: number | null
  sireId?: number | null
  damCode?: string | null
  sireCode?: string | null
  externalSireCode?: string | null
}

export type BackendList = { items?: BackendProfile[]; total?: number; page?: number; size?: number; counts?: Record<string, number> }
export type BackendQrTag = { id?: number; tagCode?: string; status?: string; displayCode?: string; issuedAt?: string; endedAt?: string | null; reason?: string | null; version?: number; issuedByName?: string | null; note?: string | null }
export type BackendPurpose = { id?: number; code?: string; name?: string; purposeType?: string; available?: boolean }
export type BackendPen = { id?: number; code?: string; name?: string; capacity?: number; headcount?: number; status?: string; freePlaces?: number; acceptsSummary?: string; currentCriteria?: { purposeTypes?: string[]; lifeStages?: string[]; sex?: string; minAgeMonths?: number; minWeightKg?: number } | null }
export type BackendPenHistory = {
  current?: { penId?: number; penCode?: string; penName?: string; since?: string; headcount?: number; capacity?: number; acceptsSummary?: string } | null
  history?: Array<{ id?: number; penId?: number; penCode?: string; penName?: string; fromDate?: string; toDate?: string | null; source?: string; reason?: string | null; warningReason?: string | null; recordedByName?: string | null }>
}

export type ProfileUpdateCommand = {
  earTagNumber?: string
  name?: string
  colourMarkings?: string
  notes?: string
  productionPurposeId?: number
  lifeStage?: string
  effectiveDate: string
  reason: string
  expectedVersion: number
  acknowledgedReproductionChange?: boolean
}
export type QrIssueCommand = { reason?: 'LOST' | 'DAMAGED' | 'OTHER'; tagCode?: string; note?: string; cattleVersion: number }
export type PenMoveCheckCommand = { cattleId: number; toPenId: number; moveDate: string }
export type PenMoveCheck = {
  blocked?: boolean
  block?: { code?: string; text?: string; message?: string } | null
  cattle?: Array<{
    error?: { code?: string; text?: string; message?: string; params?: Record<string, unknown> } | null
    warningReasonRequired?: boolean
    warning?: { code?: string; text?: string; message?: string } | null
    /** One row per reception criterion (PenMoveCheckDTO.CattleCheck.results). */
    results?: Array<{ criterion?: string; outcome?: 'MET' | 'NOT_MET' | 'NOT_APPLICABLE'; expected?: string | null; actual?: string | null }>
  }>
}
export type PenMoveCommand = { cattleId: number; toPenId: number; moveDate: string; reason: string; warningReason?: string; cattleVersion?: number }
