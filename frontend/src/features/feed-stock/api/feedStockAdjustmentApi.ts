import { backendFarmId, backendMode, backendTransport, type BackendMode, type BackendTransport } from '../../../api/backendTransport'
import type { FeedStockAdjustment, FeedStockAdjustmentDemoStore, FeedStockAdjustmentDraftInput } from '../types/feedStockAdjustment'
import {
  feedStockAdjustmentDemoStore,
  resetFeedStockAdjustmentDemoStore as resetDemoStore,
} from '../data/feedReceiptDemoStore'

const backendMutationMessage = 'Ghi nhận và lưu nháp kiểm kê hiện chỉ hoạt động trong bản demo.'

export function createFeedStockAdjustmentApi({
  mode,
  farmId,
  transport,
  mockRows,
  demoStore = feedStockAdjustmentDemoStore,
}: {
  mode: BackendMode
  farmId: string | number
  transport: BackendTransport
  mockRows?: readonly FeedStockAdjustment[]
  demoStore?: FeedStockAdjustmentDemoStore
}) {
  return {
    async list(): Promise<FeedStockAdjustment[]> {
      if (mode === 'backend') {
        return await transport.get(transport.farmPath(farmId, '/feed/adjustments')) as FeedStockAdjustment[]
      }
      if (mockRows) return mockRows.map((row) => ({ ...row, lines: row.lines.map((line) => ({ ...line })) }))
      return demoStore.list()
    },
    async get(id: string): Promise<FeedStockAdjustment> {
      if (mode === 'backend') {
        return await transport.get(transport.farmPath(farmId, `/feed/adjustments/${encodeURIComponent(id)}`)) as FeedStockAdjustment
      }
      return demoStore.get(id)
    },
    async saveDraft(input: FeedStockAdjustmentDraftInput) {
      if (mode === 'backend') throw new Error(backendMutationMessage)
      return demoStore.saveDraft(input)
    },
    async post(id: number) {
      if (mode === 'backend') throw new Error(backendMutationMessage)
      return demoStore.post(id)
    },
  }
}

const feedStockAdjustmentApi = createFeedStockAdjustmentApi({ mode: backendMode, farmId: backendFarmId, transport: backendTransport })

/** Backend mode reads real adjustment rows; local mutations are confined to the demo state. */
export const listFeedStockAdjustments = () => feedStockAdjustmentApi.list()
export const getFeedStockAdjustment = (id: string) => feedStockAdjustmentApi.get(id)
export const saveFeedStockAdjustmentDemoDraft = (input: FeedStockAdjustmentDraftInput) => feedStockAdjustmentApi.saveDraft(input)
export const postFeedStockAdjustmentDemo = (id: number) => feedStockAdjustmentApi.post(id)
export const resetFeedStockAdjustmentDemoStore = () => resetDemoStore()
