import { useMutation } from '../../../shared/hooks/useMutation'
import { useQuery } from '../../../shared/hooks/useQuery'
import { listFeedStock } from '../api/feedStockApi'
import { listFeedSuppliers } from '../api/feedCatalogueApi'
import { createAndPostFeedReceipt, getFeedReceipt, listFeedReceiptAttachments, listFeedReceipts, postFeedReceipt, saveFeedReceiptDraft } from '../api/feedReceiptApi'
import type { FeedCommandOptions } from '../api/command'
import type { FeedReceipt, FeedReceiptAttachment } from '../types/feedReceipt'
import type { FeedReceiptDemoRecord, FeedReceiptDraftInput } from '../types/feedReceiptDemo'
import type { FeedSupplier } from '../types/feedCatalogue'
import type { FeedStockRow } from '../types'

export type FeedReceiptFormData = { stock: FeedStockRow[]; suppliers: FeedSupplier[]; receipt: FeedReceipt | null; receipts: FeedReceipt[]; attachments: FeedReceiptAttachment[] }

/** Owns receipt editor reads and the draft/post workflow while payment and attachment contracts remain explicit. */
export function useFeedReceiptForm(id?: string) {
  const query = useQuery(async (): Promise<FeedReceiptFormData> => {
    const [stock, suppliers, receipt, receipts, attachments] = await Promise.all([
      listFeedStock(), listFeedSuppliers(), id ? getFeedReceipt(id) : Promise.resolve(null), listFeedReceipts(), id ? listFeedReceiptAttachments(Number(id)).catch(() => [] as FeedReceiptAttachment[]) : Promise.resolve([] as FeedReceiptAttachment[]),
    ])
    return { stock, suppliers, receipt, receipts, attachments }
  }, [id])
  const saveDraft = useMutation<{ input: FeedReceiptDraftInput; options?: FeedCommandOptions }, FeedReceipt | FeedReceiptDemoRecord>(({ input, options }) => saveFeedReceiptDraft(input, options))
  const createAndPost = useMutation<{ input: FeedReceiptDraftInput; options?: FeedCommandOptions }, FeedReceipt | FeedReceiptDemoRecord>(({ input, options }) => createAndPostFeedReceipt(input, options))
  const post = useMutation<{ id: number; version?: number; options?: FeedCommandOptions }, FeedReceipt>(({ id: receiptId, version, options }) => postFeedReceipt(receiptId, version, options))
  return { ...query, saveDraft: saveDraft.mutate, savingDraft: saveDraft.loading, createAndPost: createAndPost.mutate, creatingAndPosting: createAndPost.loading, post: post.mutate, posting: post.loading }
}
