import { useMutation } from '../../../shared/hooks/useMutation'
import { useQuery } from '../../../shared/hooks/useQuery'
import { cancelFeedRationVersion, listFeedRationPens, listFeedRations, stopFeedRation } from '../api/feedRationApi'
import type { FeedCommandOptions } from '../api/command'
import type { FeedRation, FeedRationPenOption } from '../types/feedRation'

export type FeedRationListData = { rows: FeedRation[]; pens: FeedRationPenOption[] }

/** Shared list read and lifecycle command boundary for the ration list and its dialogs. */
export function useFeedRationList() {
  const query = useQuery(async (): Promise<FeedRationListData> => {
    const [rows, pens] = await Promise.all([listFeedRations(), listFeedRationPens()])
    return { rows, pens }
  }, [])
  const cancel = useMutation<{ id: number; versionNo: number; version: number; options?: FeedCommandOptions }, FeedRation>(({ id, versionNo, version, options }) => cancelFeedRationVersion(id, versionNo, version, options))
  const stop = useMutation<{ id: number; endDate: string; version: number; options?: FeedCommandOptions }, FeedRation>(({ id, endDate, version, options }) => stopFeedRation(id, endDate, version, options))
  return { ...query, rows: query.data?.rows ?? [], pens: query.data?.pens ?? [], cancel: cancel.mutate, cancelling: cancel.loading, cancelError: cancel.error, stop: stop.mutate, stopping: stop.loading, stopError: stop.error }
}
