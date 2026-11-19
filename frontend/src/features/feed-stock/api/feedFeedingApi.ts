import { asRecord, asRows } from '../../../shared/api/parse'
import { backendFarmId } from '../../../api/backendTransport'
import { backendMode, type BackendMode } from '../../../shared/config/runtime'
import { backendTransport, type BackendTransport } from '../../../shared/api/backendTransport'
import type { FeedFeedingCorrectionInput, FeedFeedingDemoStore, FeedFeedingDraftInput, FeedFeedingPlan, FeedFeedingRange, FeedFeedingRecord } from '../types/feedFeeding'
import {
  correctFeedFeedingDemo,
  feedFeedingDemoStore,
  listFeedFeedingDemo,
  recordFeedFeedingDemo,
  resetFeedFeedingDemoStore as resetDemoStore,
  voidFeedFeedingDemo,
} from '../data/feedReceiptDemoStore'

type MutationOptions = { key?: string }
const commandKey = () => globalThis.crypto?.randomUUID?.() ?? `feed-session:${Date.now()}:${Math.random().toString(36).slice(2)}`

const requiredNumber = (value: unknown, field: string) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`FeedingView.${field} is missing or invalid`)
  return value
}
const requiredString = (value: unknown, field: string) => {
  if (typeof value !== 'string') throw new TypeError(`FeedingView.${field} is missing or invalid`)
  return value
}
const nullableNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null
const nullableString = (value: unknown) => typeof value === 'string' ? value : null

function mapRecord(value: unknown): FeedFeedingRecord {
  const row = asRecord(value)
  const lines = asRows(row.lines).map((line) => ({
    feedItemId: requiredNumber(line.feedItemId, 'lines[].feedItemId'),
    feedCode: requiredString(line.feedCode, 'lines[].feedCode'),
    feedName: nullableString(line.feedName),
    plannedKg: requiredNumber(line.plannedKg, 'lines[].plannedKg'),
    actualKg: requiredNumber(line.actualKg, 'lines[].actualKg'),
    inRation: typeof line.inRation === 'boolean' ? line.inRation : null,
    unitCost: nullableNumber(line.unitCost),
    totalCost: nullableNumber(line.totalCost),
  }))
  const revisions = asRows(row.revisions).map((revision) => ({
    action: revision.action === 'VOID' || revision.action === 'VOIDED' ? 'VOIDED' as const : 'CORRECTED' as const,
    reason: requiredString(revision.reason, 'revisions[].reason'),
    changedAt: requiredString(revision.changedAt, 'revisions[].changedAt'),
    lines: asRows(revision.lines).map((line) => ({
      feedItemId: requiredNumber(line.feedItemId, 'revisions[].lines[].feedItemId'),
      feedCode: requiredString(line.feedCode, 'revisions[].lines[].feedCode'),
      feedName: nullableString(line.feedName),
      plannedKg: requiredNumber(line.plannedKg, 'revisions[].lines[].plannedKg'),
      actualKg: requiredNumber(line.actualKg, 'revisions[].lines[].actualKg'),
      inRation: typeof line.inRation === 'boolean' ? line.inRation : null,
      unitCost: nullableNumber(line.unitCost),
      totalCost: nullableNumber(line.totalCost),
    })),
  }))
  const record: FeedFeedingRecord = {
    id: requiredNumber(row.id, 'id'),
    penId: requiredNumber(row.penId, 'penId'),
    penCode: nullableString(row.penCode),
    penName: nullableString(row.penName),
    feedingDate: requiredString(row.feedingDate, 'feedingDate'),
    sessionNo: requiredNumber(row.sessionNo, 'sessionNo'),
    time: nullableString(row.time),
    headCount: requiredNumber(row.headCount, 'headCount'),
    rationVersionId: nullableNumber(row.rationVersionId),
    rationCode: nullableString(row.rationCode),
    rationVersion: nullableNumber(row.rationVersion),
    status: requiredString(row.status, 'status'),
    version: requiredNumber(row.version, 'version'),
    fedBy: nullableString(row.fedBy),
    recordedBy: nullableString(row.recordedBy),
    recordedAt: nullableString(row.recordedAt),
    leftoverKg: nullableNumber(row.leftoverKg),
    note: nullableString(row.note),
    voidReason: nullableString(row.voidReason),
    plannedTotalKg: requiredNumber(row.plannedTotalKg, 'plannedTotalKg'),
    actualTotalKg: requiredNumber(row.actualTotalKg, 'actualTotalKg'),
    lines,
    revisions,
  }
  return record
}

function mapPlan(value: unknown): FeedFeedingPlan {
  const row = asRecord(value)
  const rationValue = row.ration
  return {
    penId: requiredNumber(row.penId, 'penId'),
    penCode: requiredString(row.penCode, 'penCode'),
    feedingDate: requiredString(row.feedingDate, 'feedingDate'),
    sessionNo: requiredNumber(row.sessionNo, 'sessionNo'),
    feedingTime: requiredString(row.feedingTime, 'feedingTime'),
    ration: rationValue == null ? null : (() => {
      const ration = asRecord(rationValue)
      return {
        id: requiredNumber(ration.id, 'ration.id'),
        rationCode: requiredString(ration.rationCode, 'ration.rationCode'),
        versionNo: requiredNumber(ration.versionNo, 'ration.versionNo'),
        name: requiredString(ration.name, 'ration.name'),
        sessionsPerDay: requiredNumber(ration.sessionsPerDay, 'ration.sessionsPerDay'),
      }
    })(),
    headCount: requiredNumber(row.headCount, 'headCount'),
    lines: asRows(row.lines).map((line) => ({
      feedItemId: requiredNumber(line.feedItemId, 'lines[].feedItemId'),
      feedCode: requiredString(line.feedCode, 'lines[].feedCode'),
      feedName: requiredString(line.feedName, 'lines[].feedName'),
      kgPerHead: requiredNumber(line.kgPerHead, 'lines[].kgPerHead'),
      plannedKg: requiredNumber(line.plannedKg, 'lines[].plannedKg'),
      stockKg: requiredNumber(line.stockKg, 'lines[].stockKg'),
      available: line.available === true,
    })),
    existingRecordId: nullableNumber(row.existingRecordId),
  }
}

function requireVersion(version: number | undefined) {
  if (!Number.isInteger(version) || version! < 0) throw new Error('Thiếu phiên bản hiện tại của bản ghi cho ăn. Vui lòng tải lại rồi thử lại.')
  return version!
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
  const root = transport.farmPath(farmId, '/feed/feeding-records')
  const list = async (range: FeedFeedingRange): Promise<FeedFeedingRecord[]> => {
    if (mode === 'backend') {
      const query = `?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`
      return asRows(await transport.get(`${root}${query}`)).map(mapRecord)
    }
    return demoStore.list(range)
  }
  return {
    list,
    async plan(input: { penId: number; date: string; sessionNo: number }): Promise<FeedFeedingPlan> {
      if (mode !== 'backend') throw new Error('Kế hoạch của cữ demo được tính từ dữ liệu demo.')
      const query = `?penId=${encodeURIComponent(input.penId)}&date=${encodeURIComponent(input.date)}&session=${encodeURIComponent(input.sessionNo)}`
      return mapPlan(await transport.get(`${root}/plan${query}`))
    },
    async record(input: FeedFeedingDraftInput, options: MutationOptions = {}) {
      if (mode !== 'backend') return demoStore.record(input)
      const body = {
        penId: input.penId,
        feedingDate: input.feedingDate,
        sessionNo: input.sessionNo,
        feedingTime: input.time || null,
        fedBy: input.fedBy?.trim() || null,
        leftoverKg: input.leftoverKg,
        note: input.note.trim() || null,
        lines: input.lines.map((line) => ({ feedItemId: line.feedItemId, actualKg: line.actualKg })),
      }
      return mapRecord(await transport.command(root, body, { key: options.key ?? commandKey() }))
    },
    async correct(id: number, input: FeedFeedingCorrectionInput, options: MutationOptions = {}) {
      if (mode !== 'backend') return demoStore.correct(id, input)
      const body = {
        expectedVersion: requireVersion(input.expectedVersion),
        reason: input.reason.trim(),
        fedBy: input.fedBy?.trim() || null,
        lines: input.lines.map((line) => ({ feedItemId: line.feedItemId, actualKg: line.actualKg })),
      }
      return mapRecord(await transport.command(`${root}/${id}/correct`, body, { key: options.key ?? commandKey() }))
    },
    async voidRecord(id: number, reason: string, expectedVersion?: number, options: MutationOptions = {}) {
      if (mode !== 'backend') return demoStore.voidRecord(id, reason)
      const body = { reason: reason.trim(), expectedVersion: requireVersion(expectedVersion) }
      return mapRecord(await transport.command(`${root}/${id}/void`, body, { key: options.key ?? commandKey() }))
    },
    recordDemo: (input: FeedFeedingDraftInput) => demoStore.record(input),
    correctDemo: (id: number, input: FeedFeedingCorrectionInput) => demoStore.correct(id, input),
    voidDemo: (id: number, reason: string) => demoStore.voidRecord(id, reason),
  }
}

const api = createFeedFeedingApi({ mode: backendMode, farmId: backendFarmId, transport: backendTransport })

export const listFeedFeedingRecords = (range: FeedFeedingRange) => api.list(range)
export const getFeedFeedingPlan = (input: { penId: number; date: string; sessionNo: number }) => api.plan(input)
export const recordFeedSession = (input: FeedFeedingDraftInput, options?: MutationOptions) => api.record(input, options)
export const correctFeedSession = (id: number, input: FeedFeedingCorrectionInput, options?: MutationOptions) => api.correct(id, input, options)
export const voidFeedSession = (id: number, reason: string, expectedVersion?: number, options?: MutationOptions) => api.voidRecord(id, reason, expectedVersion, options)
export const recordFeedSessionDemo = (input: FeedFeedingDraftInput) => api.recordDemo(input)
export const correctFeedSessionDemo = (id: number, input: FeedFeedingCorrectionInput) => api.correctDemo(id, input)
export const voidFeedSessionDemo = (id: number, reason: string) => api.voidDemo(id, reason)
export const resetFeedFeedingDemoStore = () => resetDemoStore()
