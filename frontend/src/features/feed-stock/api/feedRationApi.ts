import { backendFarmId, backendMode, backendTransport, type BackendMode, type BackendTransport, asRecord, asRows, numberValue, textValue } from '../../../api/backendTransport'
import { seedPens } from '../../../data/pensData'
import type { FeedStockRow } from '../types'
import type { FeedRation, FeedRationDemoStore, FeedRationPenOption, SaveFeedRationInput } from '../types/feedRation'
import { listFeedStock } from './feedStockApi'
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
  }
}

const feedRationApi = createFeedRationApi({ mode: backendMode, farmId: backendFarmId, transport: backendTransport })

/** Reads the server list in backend mode; writes persist only to the separate local ration demo store. */
export const listFeedRations = () => feedRationApi.list()
export const getFeedRation = (id: string) => feedRationApi.get(id)
export const saveFeedRationVersion = (input: SaveFeedRationInput) => feedRationApi.saveVersion(input)
export const saveFeedRationDemoVersion = (input: SaveFeedRationInput) => feedRationApi.saveVersion(input)
export const resetFeedRationDemoStore = () => resetDemoStore()

export async function listFeedRationPens(): Promise<FeedRationPenOption[]> {
  if (backendMode === 'backend') {
    return backendPens(await backendTransport.get(backendTransport.farmPath(backendFarmId, '/pens')))
  }
  return seedPens.map((pen, index) => ({ id: index + 1, code: pen.code, name: pen.name, headcount: pen.count, status: pen.status ?? 'ACTIVE' }))
}

export const listFeedRationFeeds = (): Promise<FeedStockRow[]> => listFeedStock()
