import type { FeedStockRow } from '../types'

/** Shapes of backend RationView and its feed lines; status/group remain open strings. */
export type FeedRationComponent = {
  feedItemId: number
  feedCode: string
  feedName: string
  session1Kg: number
  session2Kg: number
  session3Kg: number
  dailyKg: number
  estimatedDailyCost: number | null
}

export type FeedRation = {
  id: number
  rationCode: string
  versionNo: number
  name: string
  herdGroup: string
  basis: string
  effectiveFrom: string
  effectiveTo: string | null
  status: string
  sessionsPerDay: number
  /** Available in the local demo; current backend RationView does not return configured times yet. */
  sessionTimes?: string[]
  penIds: number[]
  components: FeedRationComponent[]
}

export type FeedRationPenOption = {
  id: number
  code: string
  name: string
  headcount: number
  status: string
}

export type FeedRationDraftComponentInput = {
  feedItemId: number
  session1Kg: number
  session2Kg: number
  session3Kg: number
}

export type SaveFeedRationInput = {
  rationCode?: string
  name: string
  herdGroup: string
  basis: string
  effectiveFrom: string
  sessionsPerDay: number
  sessionTimes: string[]
  penIds: number[]
  components: FeedRationDraftComponentInput[]
}

export type FeedRationDemoStore = {
  list: () => Promise<FeedRation[]>
  get: (id: string) => Promise<FeedRation>
  saveVersion: (input: SaveFeedRationInput, currentStock: readonly FeedStockRow[]) => Promise<FeedRation>
  reset: () => Promise<void>
}

export type FeedRationFormComponent = {
  feedItemId: string
  session1Kg: string
  session2Kg: string
  session3Kg: string
}

export type FeedRationFormValues = {
  name: string
  herdGroup: string
  basis: string
  effectiveFrom: string
  sessionsPerDay: number
  sessionTimes: string[]
  penIds: number[]
  components: FeedRationFormComponent[]
}

export type FeedRationFeedOption = FeedStockRow
