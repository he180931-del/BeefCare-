import { useMutation } from '../../../shared/hooks/useMutation'
import { useQuery } from '../../../shared/hooks/useQuery'
import {
  correctFeedSession,
  getFeedFeedingPlan,
  listFeedFeedingRecords,
  recordFeedSession,
  voidFeedSession,
} from '../api/feedFeedingApi'
import type {
  FeedFeedingCorrectionInput,
  FeedFeedingDraftInput,
  FeedFeedingPlan,
  FeedFeedingRange,
  FeedFeedingRecord,
} from '../types/feedFeeding'
import type { FeedCommandOptions } from '../api/command'

type CommandInput<T> = { input: T; options?: FeedCommandOptions }

/** Shared feeding data/command boundary for screens that need the same range and optimistic-version rules. */
export function useFeedFeeding(range: FeedFeedingRange) {
  const query = useQuery(() => listFeedFeedingRecords(range), [range.from, range.to])
  const plan = useMutation<{ penId: number; date: string; sessionNo: number }, FeedFeedingPlan>(getFeedFeedingPlan)
  const record = useMutation<CommandInput<FeedFeedingDraftInput>, FeedFeedingRecord>(({ input, options }) => recordFeedSession(input, options))
  const correct = useMutation<{ id: number; input: FeedFeedingCorrectionInput; options?: FeedCommandOptions }, FeedFeedingRecord>(({ id, input, options }) => correctFeedSession(id, input, options))
  const voidRecord = useMutation<{ id: number; reason: string; expectedVersion?: number; options?: FeedCommandOptions }, FeedFeedingRecord>(({ id, reason, expectedVersion, options }) => voidFeedSession(id, reason, expectedVersion, options))
  return { ...query, records: query.data ?? [], plan: plan.mutate, planLoading: plan.loading, planError: plan.error, record: record.mutate, recording: record.loading, recordError: record.error, correct: correct.mutate, correcting: correct.loading, correctError: correct.error, voidRecord: voidRecord.mutate, voiding: voidRecord.loading, voidError: voidRecord.error }
}
