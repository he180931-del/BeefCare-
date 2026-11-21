import { useMutation } from '../../../shared/hooks/useMutation'
import { useQuery } from '../../../shared/hooks/useQuery'
import { listFeedRationFeeds, listFeedRationPens, listFeedRations, saveFeedRationVersion } from '../api/feedRationApi'
import type { FeedCommandOptions } from '../api/command'
import type { FeedRation, FeedRationPenOption, SaveFeedRationInput } from '../types/feedRation'
import type { FeedStockRow } from '../types'

export type FeedRationFormData = { record: FeedRation | null; rows: FeedRation[]; pens: FeedRationPenOption[]; feeds: FeedStockRow[] }

/** Loads the editor's complete catalogue and owns the version-save mutation. */
export function useFeedRationForm(id?: string) {
  const query = useQuery(async (): Promise<FeedRationFormData> => {
    const [rows, pens, feeds] = await Promise.all([listFeedRations(), listFeedRationPens(), listFeedRationFeeds()])
    return { record: id ? rows.find((row) => String(row.id) === id) ?? null : null, rows, pens, feeds }
  }, [id])
  const save = useMutation<{ input: SaveFeedRationInput; options?: FeedCommandOptions }, FeedRation>((payload) => saveFeedRationVersion(payload.input, payload.options))
  return { ...query, save: save.mutate, saving: save.loading, saveError: save.error }
}
