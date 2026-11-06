export type FeedFeedingLine = {
  feedItemId: number
  feedCode: string
  feedName: string | null
  plannedKg: number
  actualKg: number
  inRation: boolean | null
  unitCost: number | null
  totalCost: number | null
}

export type FeedFeedingRevision = {
  action: 'CORRECTED' | 'VOIDED'
  reason: string
  changedAt: string
  lines: FeedFeedingLine[]
}

/** Local demo record with the fields shown by FeedingView plus display-only snapshots. */
export type FeedFeedingRecord = {
  id: number
  penId: number
  penCode: string | null
  penName: string | null
  feedingDate: string
  sessionNo: number
  time: string | null
  headCount: number
  /** Backend FeedingView identifier; absent from older local demo saves. */
  rationVersionId?: number | null
  rationCode: string | null
  rationVersion: number | null
  status: string
  version: number
  fedBy: string | null
  /** Local demo: who entered the record when it differs from who fed (Người ghi column). */
  recordedBy?: string | null
  recordedAt: string | null
  leftoverKg: number | null
  note: string | null
  plannedTotalKg: number
  actualTotalKg: number
  lines: FeedFeedingLine[]
  revisions: FeedFeedingRevision[]
  [key: string]: unknown
}

export type FeedFeedingLineInput = {
  feedItemId: number
  plannedKg: number
  actualKg: number
  inRation: boolean
}

export type FeedFeedingDraftInput = {
  penId: number
  feedingDate: string
  sessionNo: number
  time: string
  fedBy: string
  leftoverKg: number | null
  note: string
  rationCode: string | null
  rationVersion: number | null
  lines: FeedFeedingLineInput[]
}

export type FeedFeedingCorrectionInput = {
  expectedVersion?: number
  reason: string
  time?: string
  fedBy?: string
  leftoverKg?: number | null
  note?: string
  lines: FeedFeedingLineInput[]
}

export type FeedFeedingRange = { from: string; to: string }

export type FeedFeedingDemoStore = {
  list: (range: FeedFeedingRange) => Promise<FeedFeedingRecord[]>
  record: (input: FeedFeedingDraftInput) => Promise<FeedFeedingRecord>
  correct: (id: number, input: FeedFeedingCorrectionInput) => Promise<FeedFeedingRecord>
  voidRecord: (id: number, reason: string) => Promise<FeedFeedingRecord>
  reset: () => Promise<void>
}
