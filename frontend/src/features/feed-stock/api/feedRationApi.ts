import { backendFarmId, backendMode, backendTransport, type BackendMode, type BackendTransport, asRecord, asRows, numberValue, textValue } from '../../../api/backendTransport'
import { FEED_DEMO_PENS } from '../data/feedPenMock'
import type { FeedStockRow } from '../types'
import type { FeedRation, FeedRationDemoStore, FeedRationPenOption, SaveFeedRationInput } from '../types/feedRation'
import { listFeedStock } from './feedStockApi'
import { backendPending } from '../../../api/backendPending'
import {
  feedRationDemoStore,
  resetFeedRationDemoStore as resetDemoStore,
} from '../data/feedRationDemoStore'

const backendMutationMessage = 'Lưu và tạo phiên bản khẩu phần hiện chỉ hoạt động trong bản demo.'

function backendPens(value: unknown): FeedRationPenOption[] {
  const body = asRecord(value)
  const rows = Array.isArray(value) ? asRows(value) : asRows(body.pens)
  return rows.map((row) => ({
    id: numberValue(row.id),
    code: textValue(row.code),
    name: textValue(row.name, textValue(row.code)),
    headcount: numberValue(row.headcount),
    status: textValue(row.status),
  }))
}

export function createFeedRationApi({
  mode,
  farmId,
  transport,
  mockRows,
  demoStore = feedRationDemoStore,
  getFeedStock = listFeedStock,
}: {
  mode: BackendMode
  farmId: string | number
  transport: BackendTransport
  mockRows?: readonly FeedRation[]
  demoStore?: FeedRationDemoStore
  getFeedStock?: () => Promise<readonly FeedStockRow[]>
}) {
  const list = async (): Promise<FeedRation[]> => {
    if (mode === 'backend') return await transport.get(transport.farmPath(farmId, '/feed/rations')) as FeedRation[]
    if (mockRows) return mockRows.map((row) => ({ ...row, penIds: [...row.penIds], components: row.components.map((component) => ({ ...component })) }))
    return demoStore.list()
  }
  return {
    list,
    async get(id: string): Promise<FeedRation> {
      const row = (await list()).find((ration) => String(ration.id) === String(id))
      if (!row) throw new Error(`Không tìm thấy khẩu phần ${id}.`)
      return row
    },
    async saveVersion(input: SaveFeedRationInput) {
      if (mode === 'backend') throw new Error(backendMutationMessage)
      const currentStock = await getFeedStock()
      return demoStore.saveVersion(input, currentStock)
    },
    // chưa có API: OpenAPI has no route to cancel a scheduled ration version.
    async cancelVersion(id: number) {
      if (mode === 'backend') throw backendPending('hủy phiên bản khẩu phần')
      return demoStore.cancelVersion(id)
    },
    // chưa có API: OpenAPI has no route to stop an effective ration from a future date.
    async stop(id: number, endDate: string) {
      if (mode === 'backend') throw backendPending('ngừng khẩu phần')
      return demoStore.stop(id, endDate)
    },
  }
}

const feedRationApi = createFeedRationApi({ mode: backendMode, farmId: backendFarmId, transport: backendTransport })

/** Reads the server list in backend mode; writes persist only to the separate local ration demo store. */
export const listFeedRations = () => feedRationApi.list()
export const getFeedRation = (id: string) => feedRationApi.get(id)
export const saveFeedRationVersion = (input: SaveFeedRationInput) => feedRationApi.saveVersion(input)
export const cancelFeedRationVersion = (id: number) => feedRationApi.cancelVersion(id)
export const stopFeedRation = (id: number, endDate: string) => feedRationApi.stop(id, endDate)
export const saveFeedRationDemoVersion = (input: SaveFeedRationInput) => feedRationApi.saveVersion(input)
export const resetFeedRationDemoStore = () => resetDemoStore()

export async function listFeedRationPens(): Promise<FeedRationPenOption[]> {
  if (backendMode === 'backend') {
    return backendPens(await backendTransport.get(backendTransport.farmPath(backendFarmId, '/pens')))
  }
  return FEED_DEMO_PENS.map((pen) => ({ ...pen }))
}

export const listFeedRationFeeds = (): Promise<FeedStockRow[]> => listFeedStock()
