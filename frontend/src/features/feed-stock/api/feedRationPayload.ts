// Request payload mapping moved out of src/features/feed-stock/data/feedRationForm.ts (refactor phase 2): form values → API input.
import type { FeedRationFormValues, SaveFeedRationInput } from '../types/feedRation'

export function toSaveFeedRationInput(values: FeedRationFormValues, rationCode?: string, replacesId?: number, baseVersion?: number): SaveFeedRationInput {
  return {
    ...(rationCode ? { rationCode } : {}),
    ...(replacesId === undefined ? {} : { replacesId }),
    ...(baseVersion === undefined ? {} : { baseVersion }),
    name: values.name,
    herdGroup: values.herdGroup,
    basis: values.basis,
    effectiveFrom: values.effectiveFrom,
    sessionsPerDay: values.sessionsPerDay,
    sessionTimes: [...values.sessionTimes],
    penIds: [...values.penIds],
    components: values.components.map((component) => ({
      feedItemId: Number(component.feedItemId),
      session1Kg: Number(component.session1Kg),
      session2Kg: Number(component.session2Kg),
      session3Kg: Number(component.session3Kg),
    })),
  }
}
