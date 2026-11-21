import { useMutation } from '../../../shared/hooks/useMutation'
import { useQuery } from '../../../shared/hooks/useQuery'
import { listFeedStock } from '../api/feedStockApi'
import { feedStockAdjustmentServerBacked, getFeedStockAdjustment, listFeedStockAdjustmentAttachments, listFeedStockAdjustments, postFeedStockAdjustment, saveFeedStockAdjustmentDraft } from '../api/feedStockAdjustmentApi'
import type { FeedCommandOptions } from '../api/command'
import type { FeedReceiptAttachment } from '../types/feedReceipt'
import type { FeedStockAdjustment, FeedStockAdjustmentDraftInput } from '../types/feedStockAdjustment'
import type { FeedStockRow } from '../types'

export type FeedStockAdjustmentFormData = { stock: FeedStockRow[]; record: FeedStockAdjustment | null; adjustments: FeedStockAdjustment[]; attachments: FeedReceiptAttachment[] }

/** Owns adjustment editor reads and draft/post workflow; attachment operations stay explicit in the form. */
export function useFeedStockAdjustmentForm(id?: string) {
  const query = useQuery(async (): Promise<FeedStockAdjustmentFormData> => {
    const [stock, record, adjustments, attachments] = await Promise.all([
      listFeedStock(), id ? getFeedStockAdjustment(id) : Promise.resolve(null), feedStockAdjustmentServerBacked || id ? Promise.resolve([] as FeedStockAdjustment[]) : listFeedStockAdjustments(), id && feedStockAdjustmentServerBacked ? listFeedStockAdjustmentAttachments(Number(id)) : Promise.resolve([] as FeedReceiptAttachment[]),
    ])
    return { stock, record, adjustments, attachments }
  }, [id])
  const saveDraft = useMutation<{ input: FeedStockAdjustmentDraftInput; options?: FeedCommandOptions }, FeedStockAdjustment>(({ input, options }) => saveFeedStockAdjustmentDraft(input, options))
  const post = useMutation<{ id: number; version?: number; options?: FeedCommandOptions }, FeedStockAdjustment>(({ id: adjustmentId, version, options }) => postFeedStockAdjustment(adjustmentId, version, options))
  return { ...query, saveDraft: saveDraft.mutate, savingDraft: saveDraft.loading, post: post.mutate, posting: post.loading }
}
