import { asRecord, asRows, nullableNumber, textValue } from '../../../shared/api/parse'
import { backendFarmId } from '../../../api/backendTransport'
import { backendMode, type BackendMode } from '../../../shared/config/runtime'
import { backendTransport, type BackendTransport } from '../../../shared/api/backendTransport'
import type { FeedReceiptAttachment } from '../types/feedReceipt'
import type { FeedStockAdjustment, FeedStockAdjustmentDemoStore, FeedStockAdjustmentDraftInput } from '../types/feedStockAdjustment'
import {
  feedStockAdjustmentDemoStore,
  resetFeedStockAdjustmentDemoStore as resetDemoStore,
} from '../data/feedReceiptDemoStore'

type MutationOptions = { key?: string }

const commandKey = () => globalThis.crypto?.randomUUID?.() ?? `feed-adjustment:${Date.now()}:${Math.random().toString(36).slice(2)}`

const requiredNumber = (value: unknown, field: string) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`AdjustmentView.${field} is missing or invalid`)
  return value
}

const requiredString = (value: unknown, field: string) => {
  if (typeof value !== 'string') throw new TypeError(`AdjustmentView.${field} is missing or invalid`)
  return value
}

function mapLine(value: unknown) {
  const row = asRecord(value)
  return {
    feedItemId: requiredNumber(row.feedItemId, 'lines[].feedItemId'),
    feedCode: requiredString(row.feedCode, 'lines[].feedCode'),
    feedName: requiredString(row.feedName, 'lines[].feedName'),
    systemKg: requiredNumber(row.systemKg, 'lines[].systemKg'),
    countedKg: requiredNumber(row.countedKg, 'lines[].countedKg'),
    differenceKg: requiredNumber(row.differenceKg, 'lines[].differenceKg'),
    reason: row.reason === null ? null : textValue(row.reason),
    unitCost: nullableNumber(row.unitCost),
    differenceValue: nullableNumber(row.differenceValue),
  }
}

/** Explicitly maps the Java AdjustmentView DTO; the FE never treats an arbitrary response as its own type. */
function mapAdjustment(value: unknown): FeedStockAdjustment {
  const row = asRecord(value)
  return {
    id: requiredNumber(row.id, 'id'),
    code: requiredString(row.code, 'code'),
    countDate: requiredString(row.countDate, 'countDate'),
    adjustmentType: requiredString(row.adjustmentType, 'adjustmentType'),
    countedBy: row.countedBy === null ? '' : textValue(row.countedBy),
    status: requiredString(row.status, 'status'),
    totalDifferenceKg: requiredNumber(row.totalDifferenceKg, 'totalDifferenceKg'),
    totalValue: nullableNumber(row.totalValue),
    postedAt: row.postedAt === null ? null : textValue(row.postedAt) || null,
    version: requiredNumber(row.version, 'version'),
    lines: asRows(row.lines).map(mapLine),
  }
}

function mapAttachment(value: unknown): FeedReceiptAttachment {
  const row = asRecord(value)
  return {
    id: requiredNumber(row.id, 'AttachmentDTO.id'),
    contentType: requiredString(row.contentType, 'AttachmentDTO.contentType'),
    fileSize: requiredNumber(row.fileSize, 'AttachmentDTO.fileSize'),
    originalFilename: requiredString(row.originalFilename, 'AttachmentDTO.originalFilename'),
    createdAt: requiredString(row.createdAt, 'AttachmentDTO.createdAt'),
  }
}

function adjustmentRequest(input: FeedStockAdjustmentDraftInput) {
  return {
    countDate: input.countDate,
    adjustmentType: input.adjustmentType,
    countedBy: input.countedBy.trim() || null,
    lines: input.lines.map((line) => ({
      feedItemId: line.feedItemId,
      countedKg: line.countedKg,
      reason: line.reason.trim() || null,
    })),
  }
}

function requireExpectedVersion(version: number | undefined) {
  if (!Number.isInteger(version) || version! < 0) {
    throw new Error('Thiếu phiên bản hiện tại của phiếu kiểm kê. Vui lòng tải lại phiếu rồi thử lại.')
  }
  return version!
}

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
  const root = transport.farmPath(farmId, '/feed/adjustments')
  const versionByCommandKey = new Map<string, number>()
  const uploadKeyByFile = new WeakMap<File, string>()
  const attachmentPath = (id: number) => `${root}/${id}/attachments`
  const getAdjustment = async (id: string) => mapAdjustment(await transport.get(`${root}/${encodeURIComponent(id)}`))

  return {
    async list(): Promise<FeedStockAdjustment[]> {
      if (mode === 'backend') return asRows(await transport.get(root)).map(mapAdjustment)
      if (mockRows) return mockRows.map((row) => ({ ...row, lines: row.lines.map((line) => ({ ...line })) }))
      return demoStore.list()
    },
    async get(id: string): Promise<FeedStockAdjustment> {
      if (mode === 'backend') return getAdjustment(id)
      return demoStore.get(id)
    },
    async saveDraft(input: FeedStockAdjustmentDraftInput, options: MutationOptions = {}): Promise<FeedStockAdjustment> {
      if (mode !== 'backend') return demoStore.saveDraft(input)
      const key = options.key ?? commandKey()
      let response: unknown
      if (input.id === undefined) {
        response = await transport.command(root, { ...adjustmentRequest(input), postNow: false }, { key })
      } else {
        const expected = requireExpectedVersion(input.expectedVersion)
        const version = options.key ? versionByCommandKey.get(key) ?? expected : expected
        if (options.key && !versionByCommandKey.has(key)) versionByCommandKey.set(key, expected)
        response = await transport.command(`${root}/${input.id}/draft`, {
          ...adjustmentRequest(input), expectedVersion: version,
        }, { method: 'PUT', key })
      }
      const result = mapAdjustment(response)
      if (options.key) versionByCommandKey.delete(key)
      return result
    },
    async post(id: number, expectedVersion?: number, options: MutationOptions = {}): Promise<FeedStockAdjustment> {
      if (mode !== 'backend') return demoStore.post(id)
      const key = options.key ?? commandKey()
      let version = options.key ? versionByCommandKey.get(key) : undefined
      if (version === undefined) {
        version = requireExpectedVersion(expectedVersion ?? (await getAdjustment(String(id))).version)
        if (options.key) versionByCommandKey.set(key, version)
      }
      const result = mapAdjustment(await transport.command(`${root}/${id}/post`, { expectedVersion: version }, { key }))
      if (options.key) versionByCommandKey.delete(key)
      return result
    },
    async attachments(id: number): Promise<FeedReceiptAttachment[]> {
      if (mode !== 'backend') return []
      return asRows(await transport.get(attachmentPath(id))).map(mapAttachment)
    },
    async uploadAttachment(id: number, file: File, options: MutationOptions = {}): Promise<FeedReceiptAttachment> {
      if (mode !== 'backend') throw new Error('Lưu chứng từ kiểm kê chỉ hoạt động trong chế độ backend.')
      const data = new FormData()
      data.append('file', file)
      const key = options.key ?? uploadKeyByFile.get(file) ?? commandKey()
      if (!options.key) uploadKeyByFile.set(file, key)
      const attachment = mapAttachment(await transport.command(attachmentPath(id), data, { key }))
      if (!options.key) uploadKeyByFile.delete(file)
      return attachment
    },
    async removeAttachment(id: number, attachmentId: number, options: MutationOptions = {}): Promise<FeedReceiptAttachment> {
      if (mode !== 'backend') throw new Error('Xóa chứng từ kiểm kê chỉ hoạt động trong chế độ backend.')
      return mapAttachment(await transport.command(`${attachmentPath(id)}/${attachmentId}`, undefined, { method: 'DELETE', key: options.key ?? commandKey() }))
    },
    async downloadAttachment(id: number, attachmentId: number): Promise<Blob> {
      if (mode !== 'backend') throw new Error('Tải chứng từ kiểm kê chỉ hoạt động trong chế độ backend.')
      const result = await transport.get(`${attachmentPath(id)}/${attachmentId}`)
      if (!(result instanceof Blob)) throw new TypeError('Adjustment attachment response is not a file')
      return result
    },
  }
}

const feedStockAdjustmentApi = createFeedStockAdjustmentApi({ mode: backendMode, farmId: backendFarmId, transport: backendTransport })

export const listFeedStockAdjustments = () => feedStockAdjustmentApi.list()
export const getFeedStockAdjustment = (id: string) => feedStockAdjustmentApi.get(id)
export const saveFeedStockAdjustmentDraft = (input: FeedStockAdjustmentDraftInput, options?: MutationOptions) => feedStockAdjustmentApi.saveDraft(input, options)
export const postFeedStockAdjustment = (id: number, expectedVersion?: number, options?: MutationOptions) => feedStockAdjustmentApi.post(id, expectedVersion, options)
export const listFeedStockAdjustmentAttachments = (id: number) => feedStockAdjustmentApi.attachments(id)
export const uploadFeedStockAdjustmentAttachment = (id: number, file: File, options?: MutationOptions) => feedStockAdjustmentApi.uploadAttachment(id, file, options)
export const removeFeedStockAdjustmentAttachment = (id: number, attachmentId: number, options?: MutationOptions) => feedStockAdjustmentApi.removeAttachment(id, attachmentId, options)
export const downloadFeedStockAdjustmentAttachment = (id: number, attachmentId: number) => feedStockAdjustmentApi.downloadAttachment(id, attachmentId)

/** Kept for callers that specifically exercise the local demo store. */
export const saveFeedStockAdjustmentDemoDraft = saveFeedStockAdjustmentDraft
export const postFeedStockAdjustmentDemo = postFeedStockAdjustment
export const resetFeedStockAdjustmentDemoStore = () => resetDemoStore()
