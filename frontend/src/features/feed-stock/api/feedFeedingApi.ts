import { backendFarmId, backendMode, backendTransport, type BackendMode, type BackendTransport, asRows, numberValue, textValue } from '../../../api/backendTransport'
import type { FeedFeedingCorrectionInput, FeedFeedingDemoStore, FeedFeedingDraftInput, FeedFeedingRange, FeedFeedingRecord } from '../types/feedFeeding'
import {
  correctFeedFeedingDemo,
  feedFeedingDemoStore,
  listFeedFeedingDemo,
  recordFeedFeedingDemo,
  resetFeedFeedingDemoStore as resetDemoStore,
  voidFeedFeedingDemo,
} from '../data/feedReceiptDemoStore'

const backendMutationMessage = 'Ghi, sửa và hủy cữ cho ăn hiện chỉ hoạt động trong bản demo.'

function backendFeedingRecords(value: unknown): FeedFeedingRecord[] {
  return asRows(value).map((row) => {
    const lines = asRows(row.lines).map((line) => ({
      feedItemId: numberValue(line.feedItemId),
      feedCode: textValue(line.feedCode),
      feedName: null,
      plannedKg: numberValue(line.plannedKg),
      actualKg: numberValue(line.actualKg),
      inRation: null,
      unitCost: typeof line.unitCost === 'number' ? line.unitCost : null,
      totalCost: typeof line.totalCost === 'number' ? line.totalCost : null,
    }))
    return {
      id: numberValue(row.id),
      penId: numberValue(row.penId),
      penCode: null,
      penName: null,
      feedingDate: textValue(row.feedingDate),
      sessionNo: numberValue(row.sessionNo),
      time: null,
      headCount: numberValue(row.headCount),
      rationVersionId: typeof row.rationVersionId === 'number' ? row.rationVersionId : null,
      rationCode: null,
      rationVersion: null,
      status: textValue(row.status),
      version: numberValue(row.version),
      fedBy: null,
      recordedAt: null,
      leftoverKg: null,
      note: null,
      plannedTotalKg: lines.reduce((sum, line) => sum + line.plannedKg, 0),
      actualTotalKg: lines.reduce((sum, line) => sum + line.actualKg, 0),
      lines,
      revisions: [],
    }
  })
}

export function createFeedFeedingApi({
  mode,
  farmId,
  transport,
  demoStore = feedFeedingDemoStore,
}: {
  mode: BackendMode
  farmId: string | number
  transport: BackendTransport
  demoStore?: FeedFeedingDemoStore
}) {
  const list = async (range: FeedFeedingRange): Promise<FeedFeedingRecord[]> => {
    if (mode === 'backend') {
      const path = transport.farmPath(farmId, '/feed/feeding-records')
      const query = `?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`
      return backendFeedingRecords(await transport.get(`${path}${query}`))
    }
    return demoStore.list(range)
  }
  return {
    list,
    async record(input: FeedFeedingDraftInput) {
      if (mode === 'backend') throw new Error(backendMutationMessage)
      return demoStore.record(input)
    },
    async correct(id: number, input: FeedFeedingCorrectionInput) {
      if (mode === 'backend') throw new Error(backendMutationMessage)
      return demoStore.correct(id, input)
    },
    async voidRecord(id: number, reason: string) {
      if (mode === 'backend') throw new Error(backendMutationMessage)
      return demoStore.voidRecord(id, reason)
    },
  }
}

const api = createFeedFeedingApi({ mode: backendMode, farmId: backendFarmId, transport: backendTransport })

export const listFeedFeedingRecords = (range: FeedFeedingRange) => api.list(range)
export const recordFeedSession = (input: FeedFeedingDraftInput) => api.record(input)
export const correctFeedSession = (id: number, input: FeedFeedingCorrectionInput) => api.correct(id, input)
export const voidFeedSession = (id: number, reason: string) => api.voidRecord(id, reason)
export const recordFeedSessionDemo = (input: FeedFeedingDraftInput) => api.record(input)
export const correctFeedSessionDemo = (id: number, input: FeedFeedingCorrectionInput) => api.correct(id, input)
export const voidFeedSessionDemo = (id: number, reason: string) => api.voidRecord(id, reason)
export const resetFeedFeedingDemoStore = () => resetDemoStore()
