import { backendFarmId } from '../../../api/backendTransport'
import { backendMode, type BackendMode } from '../../../shared/config/runtime'
import { backendTransport, type BackendTransport } from '../../../shared/api/backendTransport'
import { asRecord, asRows, nullableNumber, numberValue, textValue } from '../../../shared/api/parse'
import { FEED_DEMO_PENS } from '../data/feedPenMock'
import type { FeedStockRow } from '../types'
import type { FeedRation, FeedRationDemoStore, FeedRationPenOption, SaveFeedRationInput } from '../types/feedRation'
import { listFeedStock } from './feedStockApi'
import {
  feedRationDemoStore,
  resetFeedRationDemoStore as resetDemoStore,
} from '../data/feedRationDemoStore'

type MutationOptions = { key?: string }
const commandKey = () => globalThis.crypto?.randomUUID?.() ?? `feed-ration:${Date.now()}:${Math.random().toString(36).slice(2)}`
export const newFeedRationCommandKey = commandKey

function mapRation(value: unknown): FeedRation {
  const row = asRecord(value)
  return {
    id: numberValue(row.id),
    rationCode: textValue(row.rationCode),
    version: numberValue(row.version),
    versionNo: numberValue(row.versionNo),
    name: textValue(row.name),
    herdGroup: textValue(row.herdGroup),
    basis: textValue(row.basis),
    effectiveFrom: textValue(row.effectiveFrom),
    effectiveTo: typeof row.effectiveTo === 'string' ? row.effectiveTo : null,
    status: textValue(row.status),
    sessionsPerDay: numberValue(row.sessionsPerDay),
    sessionTimes: Array.isArray(row.sessionTimes) ? row.sessionTimes.filter((item): item is string => typeof item === 'string') : [],
    penIds: Array.isArray(row.penIds) ? row.penIds.map((id) => numberValue(id)) : [],
    components: asRows(row.components).map((component) => ({
      feedItemId: numberValue(component.feedItemId),
      feedCode: textValue(component.feedCode),
      feedName: textValue(component.feedName),
      session1Kg: numberValue(component.session1Kg),
      session2Kg: numberValue(component.session2Kg),
      session3Kg: numberValue(component.session3Kg),
      dailyKg: numberValue(component.dailyKg),
      estimatedDailyCost: nullableNumber(component.estimatedDailyCost),
      outOfStock: component.outOfStock === true,
    })),
  }
}

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
    if (mode === 'backend') return asRows(await transport.get(transport.farmPath(farmId, '/feed/rations'))).map(mapRation)
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
    async saveVersion(input: SaveFeedRationInput, options: MutationOptions = {}) {
      if (mode === 'backend') {
        const body = {
          rationCode: input.rationCode ?? null,
          name: input.name.trim(),
          herdGroup: input.herdGroup || null,
          basis: input.basis.trim() || null,
          effectiveFrom: input.effectiveFrom,
          sessionsPerDay: input.sessionsPerDay,
          sessionTimes: input.sessionTimes,
          penIds: input.penIds,
          components: input.components,
          baseVersion: input.baseVersion ?? null,
        }
        return mapRation(await transport.command(transport.farmPath(farmId, '/feed/rations'), body, { key: options.key ?? commandKey() }))
      }
      const currentStock = await getFeedStock()
      return demoStore.saveVersion(input, currentStock)
    },
    async cancelVersion(id: number, versionNo: number, version: number, options: MutationOptions = {}) {
      if (mode === 'backend') {
        const url = transport.farmPath(farmId, `/feed/rations/${id}/versions/${versionNo}/cancel`)
        return mapRation(await transport.command(url, { version }, { key: options.key ?? commandKey() }))
      }
      return demoStore.cancelVersion(id, versionNo, version)
    },
    async stop(id: number, endDate: string, version: number, options: MutationOptions = {}) {
      if (mode === 'backend') {
        return mapRation(await transport.command(transport.farmPath(farmId, `/feed/rations/${id}/stop`), { endDate, version }, { key: options.key ?? commandKey() }))
      }
      return demoStore.stop(id, endDate, version)
    },
  }
}

const feedRationApi = createFeedRationApi({ mode: backendMode, farmId: backendFarmId, transport: backendTransport })

/** Máy chủ cấp mã khẩu phần khi lưu; bản mô phỏng tự đánh mã tiếp theo. */
export const feedRationServerBacked = backendMode === 'backend'

/** Reads the server list in backend mode; writes persist only to the separate local ration demo store. */
export const listFeedRations = () => feedRationApi.list()
export const getFeedRation = (id: string) => feedRationApi.get(id)
export const saveFeedRationVersion = (input: SaveFeedRationInput, options?: MutationOptions) => feedRationApi.saveVersion(input, options)
export const cancelFeedRationVersion = (id: number, versionNo: number, version: number, options?: MutationOptions) => feedRationApi.cancelVersion(id, versionNo, version, options)
export const stopFeedRation = (id: number, endDate: string, version: number, options?: MutationOptions) => feedRationApi.stop(id, endDate, version, options)
export const saveFeedRationDemoVersion = (input: SaveFeedRationInput, options?: MutationOptions) => feedRationApi.saveVersion(input, options)
export const resetFeedRationDemoStore = () => resetDemoStore()

export async function listFeedRationPens(): Promise<FeedRationPenOption[]> {
  if (backendMode === 'backend') {
    return backendPens(await backendTransport.get(backendTransport.farmPath(backendFarmId, '/pens')))
  }
  return FEED_DEMO_PENS.map((pen) => ({ ...pen }))
}

export const listFeedRationFeeds = (): Promise<FeedStockRow[]> => listFeedStock()
