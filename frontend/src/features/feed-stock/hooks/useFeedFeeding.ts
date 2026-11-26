import { useRef } from 'react'
import { useMutation } from '../../../shared/hooks/useMutation'
import { useQuery } from '../../../shared/hooks/useQuery'
import {
  correctFeedSession,
  feedFeedingServerBacked,
  feedingPeopleSuggestions,
  getFeedFeedingPlan,
  listFeedFeedingRecords,
  recordFeedSession,
  voidFeedSession,
} from '../api/feedFeedingApi'
import { listFeedReceipts } from '../api/feedReceiptApi'
import { listFeedRationFeeds, listFeedRationPens, listFeedRations } from '../api/feedRationApi'
import type {
  FeedFeedingCorrectionInput,
  FeedFeedingDraftInput,
  FeedFeedingPlan,
  FeedFeedingRange,
  FeedFeedingRecord,
} from '../types/feedFeeding'
import type { FeedRation, FeedRationPenOption } from '../types/feedRation'
import type { FeedStockRow } from '../types'
import type { FeedReceipt } from '../types/feedReceipt'
import type { FeedCommandOptions } from '../api/command'
import { newFeedCommandKey } from '../api/command'

export type FeedFeedingScreenData = { records: FeedFeedingRecord[]; rations: FeedRation[]; pens: FeedRationPenOption[]; feeds: FeedStockRow[]; receipts: FeedReceipt[] }

type CommandInput<T> = { input: T; options?: FeedCommandOptions }

function commandOptions(options: FeedCommandOptions | undefined, keyRef: { current?: string }) {
  return { ...options, key: options?.key ?? (keyRef.current ??= newFeedCommandKey('feed-session')) }
}

/** Owns feeding command identity so a retry of one user intent reuses its key. */
export function useFeedFeedingCommands() {
  const keyRef = useRef<string>()
  const record = useMutation<CommandInput<FeedFeedingDraftInput>, FeedFeedingRecord>(({ input, options }) => recordFeedSession(input, commandOptions(options, keyRef)))
  const correct = useMutation<{ id: number; input: FeedFeedingCorrectionInput; options?: FeedCommandOptions }, FeedFeedingRecord>(({ id, input, options }) => correctFeedSession(id, input, commandOptions(options, keyRef)))
  const voidRecord = useMutation<{ id: number; reason: string; expectedVersion?: number; options?: FeedCommandOptions }, FeedFeedingRecord>(({ id, reason, expectedVersion, options }) => voidFeedSession(id, reason, expectedVersion, commandOptions(options, keyRef)))
  return {
    record: record.mutate,
    recording: record.loading,
    recordError: record.error,
    correct: correct.mutate,
    correcting: correct.loading,
    correctError: correct.error,
    voidRecord: voidRecord.mutate,
    voiding: voidRecord.loading,
    voidError: voidRecord.error,
    resetCommandKey: () => { keyRef.current = undefined },
  }
}

/** Server plan boundary used by the record-feeding dialog. */
export function useFeedFeedingSession(input: { penId?: number; date: string; sessionNo: number }) {
  const query = useQuery(() => feedFeedingServerBacked && input.penId !== undefined
    ? getFeedFeedingPlan({ penId: input.penId, date: input.date, sessionNo: input.sessionNo })
    : Promise.resolve(null), [input.penId, input.date, input.sessionNo])
  return { ...query, serverBacked: feedFeedingServerBacked, peopleSuggestions: (sessionName?: string) => feedingPeopleSuggestions(sessionName) }
}

/** Complete read boundary for the feeding journal page. */
export function useFeedFeedingScreen(range: FeedFeedingRange, canViewStock: boolean) {
  const query = useQuery(async (): Promise<FeedFeedingScreenData> => {
    const [records, rations, pens, feeds, receipts] = await Promise.all([
      listFeedFeedingRecords(range), listFeedRations(), listFeedRationPens(),
      canViewStock ? listFeedRationFeeds() : Promise.resolve([]),
      canViewStock ? listFeedReceipts().catch(() => []) : Promise.resolve([]),
    ])
    return { records, rations, pens, feeds, receipts }
  }, [range.from, range.to, canViewStock])
  return { ...query, data: query.data }
}

export { feedFeedingServerBacked }
