import { asRecord, asRows, backendFarmId, backendMode, backendTransport, numberValue, type BackendMode, type BackendTransport } from '../../../api/backendTransport'
import type { FeedReceipt, FeedReceiptAttachment, FeedReceiptPayment, FeedReceiptPaymentResult } from '../types/feedReceipt'
import type { FeedReceiptDemoStore, FeedReceiptDraftInput, FeedReceiptVoidCheckRow } from '../types/feedReceiptDemo'
import { feedReceiptDemoStore } from '../data/feedReceiptDemoStore'

type ReceiptMutationOptions = { key?: string }
type RecordPaymentInput = {
  amount: number
  method: 'CASH' | 'BANK_TRANSFER'
  date: string
  reference?: string
  note?: string
}

const commandKey = () => globalThis.crypto?.randomUUID?.() ?? `feed-receipt:${Date.now()}:${Math.random().toString(36).slice(2)}`
const requiredNumber = (value: unknown, field: string) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`ReceiptView.${field} is missing or invalid`)
  return value
}
const requiredString = (value: unknown, field: string) => {
  if (typeof value !== 'string') throw new TypeError(`ReceiptView.${field} is missing or invalid`)
  return value
}
const optionalString = (value: unknown): string | undefined => typeof value === 'string' ? value : undefined
const optionalNullableString = (value: unknown): string | null | undefined => value === null ? null : optionalString(value)
const nullableResponseText = (row: Record<string, unknown>, field: string): string | undefined =>
  Object.hasOwn(row, field) ? (row[field] === null ? '' : optionalString(row[field])) : undefined
const optionalNumber = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) ? value : undefined
const paymentMethod = (value: unknown): 'CASH' | 'BANK_TRANSFER' | null => value === 'CASH' || value === 'BANK_TRANSFER' ? value : null

function mapPayment(value: unknown): FeedReceiptPayment {
  const row = asRecord(value)
  return {
    id: requiredNumber(row.id, 'payments[].id'),
    voucherType: requiredString(row.voucherType, 'payments[].voucherType'),
    voucherId: requiredNumber(row.voucherId, 'payments[].voucherId'),
    voucherCode: requiredString(row.voucherCode, 'payments[].voucherCode'),
    direction: requiredString(row.direction, 'payments[].direction'),
    paymentDate: requiredString(row.paymentDate, 'payments[].paymentDate'),
    amount: requiredNumber(row.amount, 'payments[].amount'),
    method: row.method === 'CASH' ? 'CASH' : row.method === 'BANK_TRANSFER' ? 'BANK_TRANSFER' : (() => { throw new TypeError('VoucherPaymentDTO.method is missing or invalid') })(),
    reference: optionalNullableString(row.reference),
    note: optionalNullableString(row.note),
    status: requiredString(row.status, 'payments[].status'),
    recordedById: row.recordedById === null ? null : optionalNumber(row.recordedById),
    recordedByName: optionalNullableString(row.recordedByName),
    recordedAt: optionalNullableString(row.recordedAt),
    voidReason: optionalNullableString(row.voidReason),
    voidedAt: optionalNullableString(row.voidedAt),
    version: row.version === null ? null : optionalNumber(row.version),
    attachments: Array.isArray(row.attachments) ? row.attachments.map(mapAttachment) : undefined,
  }
}

function mapPaymentResult(value: unknown): FeedReceiptPaymentResult {
  const body = asRecord(value)
  const rawSummary = asRecord(body.summary)
  const summary = {
    voucherType: requiredString(rawSummary.voucherType, 'summary.voucherType'),
    voucherId: requiredNumber(rawSummary.voucherId, 'summary.voucherId'),
    voucherCode: requiredString(rawSummary.voucherCode, 'summary.voucherCode'),
    total: requiredNumber(rawSummary.total, 'summary.total'),
    paid: requiredNumber(rawSummary.paid, 'summary.paid'),
    outstanding: requiredNumber(rawSummary.outstanding, 'summary.outstanding'),
    overpaid: requiredNumber(rawSummary.overpaid, 'summary.overpaid'),
    state: requiredString(rawSummary.state, 'summary.state'),
    voucherVersion: requiredNumber(rawSummary.voucherVersion, 'summary.voucherVersion'),
  }
  return {
    payment: body.payment == null ? null : mapPayment(body.payment),
    summary,
    payments: Array.isArray(body.payments) ? body.payments.map(mapPayment) : null,
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

async function attachmentKey(receiptId: number, file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let digest = 2166136261
  for (const byte of bytes) digest = Math.imul(digest ^ byte, 16777619)
  const hash = (digest >>> 0).toString(16).padStart(8, '0')
  return `feed-receipt-attachment:${receiptId}:${file.size}:${hash}`
}

/** Explicitly maps the Java ReceiptView contract and its additive detail fields. */
function mapReceipt(value: unknown): FeedReceipt {
  const row = asRecord(value)
  const lines = asRows(row.lines).map((line) => ({
    id: requiredNumber(line.id, 'lines[].id'),
    feedItemId: requiredNumber(line.feedItemId, 'lines[].feedItemId'),
    feedCode: requiredString(line.feedCode, 'lines[].feedCode'),
    feedName: requiredString(line.feedName, 'lines[].feedName'),
    lotNumber: line.lotNumber === null ? null : optionalString(line.lotNumber) ?? null,
    expiryDate: line.expiryDate === null ? null : optionalString(line.expiryDate) ?? null,
    quantityPurchase: requiredNumber(line.quantityPurchase, 'lines[].quantityPurchase'),
    purchaseUnit: line.purchaseUnit === null ? null : optionalString(line.purchaseUnit) ?? null,
    kgReceived: requiredNumber(line.kgReceived, 'lines[].kgReceived'),
    unitPrice: requiredNumber(line.unitPrice, 'lines[].unitPrice'),
    lineAmount: requiredNumber(line.lineAmount, 'lines[].lineAmount'),
  }))
  const draftAmount = row.initialPaymentAmount
  const draftPaymentMethod = row.initialPaymentMethod
  const receipt: FeedReceipt = {
    id: requiredNumber(row.id, 'id'),
    code: requiredString(row.code, 'code'),
    receiptDate: requiredString(row.receiptDate, 'receiptDate'),
    supplierId: requiredNumber(row.supplierId, 'supplierId'),
    supplierName: requiredString(row.supplierName, 'supplierName'),
    status: requiredString(row.status, 'status'),
    goodsAmount: requiredNumber(row.goodsAmount, 'goodsAmount'),
    transportFee: requiredNumber(row.transportFee, 'transportFee'),
    totalPayable: requiredNumber(row.totalPayable, 'totalPayable'),
    version: requiredNumber(row.version, 'version'),
    lines,
    ...(nullableResponseText(row, 'invoiceNumber') !== undefined ? { invoiceNumber: nullableResponseText(row, 'invoiceNumber') } : {}),
    ...(nullableResponseText(row, 'receivedBy') !== undefined ? { receivedBy: nullableResponseText(row, 'receivedBy') } : {}),
    ...(nullableResponseText(row, 'storageLocation') !== undefined ? { storageLocation: nullableResponseText(row, 'storageLocation') } : {}),
    ...(nullableResponseText(row, 'note') !== undefined ? { note: nullableResponseText(row, 'note') } : {}),
    ...(optionalNumber(row.amountPaid) !== undefined ? { amountPaid: optionalNumber(row.amountPaid) } : {}),
    ...(optionalNumber(draftAmount) !== undefined ? { initialPaymentAmount: optionalNumber(draftAmount) } : {}),
    ...(optionalNumber(row.outstandingAmount) !== undefined ? { outstanding: optionalNumber(row.outstandingAmount) } : {}),
    ...(optionalString(row.paymentState) !== undefined ? { paymentState: optionalString(row.paymentState) } : {}),
    ...(draftPaymentMethod === null || draftPaymentMethod === 'CASH' || draftPaymentMethod === 'BANK_TRANSFER' ? { paymentMethod: paymentMethod(draftPaymentMethod) } : {}),
    ...(optionalString(row.initialPaymentDate) !== undefined ? { paymentDate: optionalString(row.initialPaymentDate) } : {}),
    ...(optionalString(row.paymentDueDate) !== undefined ? { paymentDueDate: optionalString(row.paymentDueDate) } : {}),
    ...(row.createdById !== undefined ? { createdById: row.createdById === null ? null : optionalNumber(row.createdById) ?? null } : {}),
    ...(nullableResponseText(row, 'createdByName') !== undefined ? { createdByName: nullableResponseText(row, 'createdByName') } : {}),
    ...(optionalString(row.createdAt) !== undefined ? { createdAt: optionalString(row.createdAt) } : {}),
    ...(row.postedById !== undefined ? { postedById: row.postedById === null ? null : optionalNumber(row.postedById) ?? null } : {}),
    ...(optionalString(row.voidReason) !== undefined ? { voidReason: optionalString(row.voidReason) } : {}),
    ...(optionalString(row.postedAt) !== undefined ? { postedAt: optionalString(row.postedAt) } : {}),
    ...(optionalString(row.postedByName) !== undefined ? { postedByName: optionalString(row.postedByName) } : {}),
    ...(row.voidedById !== undefined ? { voidedById: row.voidedById === null ? null : optionalNumber(row.voidedById) ?? null } : {}),
    ...(optionalString(row.voidedAt) !== undefined ? { voidedAt: optionalString(row.voidedAt) } : {}),
    ...(optionalString(row.voidedByName) !== undefined ? { voidedByName: optionalString(row.voidedByName) } : {}),
  }
  return receipt
}

function receiptRequest(input: FeedReceiptDraftInput, postNow?: boolean) {
  return {
    receiptDate: input.receiptDate,
    supplierId: input.supplierId,
    invoiceNumber: input.invoiceNumber.trim() || null,
    receivedBy: input.receivedBy.trim() || null,
    storageLocation: input.storageLocation.trim() || null,
    note: input.note.trim() || null,
    transportFee: input.transportFee,
    amountPaid: input.amountPaid,
    method: input.amountPaid > 0 ? input.paymentMethod : null,
    paymentDate: input.amountPaid > 0 ? input.paymentDate || input.receiptDate : null,
    paymentDueDate: input.balanceDueDate || null,
    lines: input.lines.map((line) => ({
      feedItemId: line.feedItemId,
      lotNumber: line.lotNumber,
      expiryDate: line.expiryDate,
      quantityPurchase: line.quantityPurchase,
      purchaseUnit: line.purchaseUnit,
      unitPrice: line.unitPrice,
    })),
    ...(postNow === undefined ? {} : { postNow }),
  }
}

function mapDemoReceipt(row: Awaited<ReturnType<FeedReceiptDemoStore['get']>>): FeedReceipt {
  return {
    id: row.id,
    code: row.code,
    receiptDate: row.receiptDate,
    supplierId: row.supplierId,
    supplierName: row.supplierName,
    status: row.status,
    goodsAmount: row.goodsAmount,
    transportFee: row.transportFee,
    totalPayable: row.totalPayable,
    version: row.version,
    invoiceNumber: row.invoiceNumber,
    receivedBy: row.receivedBy,
    storageLocation: row.storageLocation,
    note: row.note,
    amountPaid: row.amountPaid,
    paymentMethod: row.paymentMethod,
    paymentDate: row.paymentDate,
    paymentDueDate: row.balanceDueDate,
    ...(row.voidReason ? { voidReason: row.voidReason } : {}),
    lines: row.lines.map((line) => ({
      id: line.id,
      feedItemId: line.feedItemId,
      feedCode: line.feedCode,
      feedName: line.feedName,
      lotNumber: line.lotNumber,
      expiryDate: line.expiryDate,
      quantityPurchase: line.quantityPurchase,
      purchaseUnit: line.purchaseUnit,
      kgReceived: line.kgReceived,
      unitPrice: line.unitPrice,
      lineAmount: line.lineAmount,
    })),
  }
}

function mapDemoPaymentResult(row: Awaited<ReturnType<FeedReceiptDemoStore['recordPayment']>>): FeedReceiptPaymentResult {
  const paid = row.amountPaid
  return {
    payment: null,
    summary: {
      voucherType: 'FEED_RECEIPT', voucherId: row.id, voucherCode: row.code,
      total: row.totalPayable, paid, outstanding: row.totalPayable - paid, overpaid: 0,
      state: paid >= row.totalPayable ? 'PAID' : paid > 0 ? 'PARTIAL' : 'UNPAID', voucherVersion: row.version,
    },
    payments: null,
  }
}

export function createFeedReceiptApi({
  mode,
  farmId,
  transport,
  mockRows,
  demoStore = feedReceiptDemoStore,
}: {
  mode: BackendMode
  farmId: string | number
  transport: BackendTransport
  mockRows?: readonly FeedReceipt[]
  demoStore?: FeedReceiptDemoStore
}) {
  const root = transport.farmPath(farmId, '/feed/receipts')
  // Keep the version attached to a caller's idempotency key across ambiguous network failures.
  const versionByCommandKey = new Map<string, number>()
  const paymentsPath = (id: number) => `${root}/${id}/payments`
  const attachmentsPath = (id: number) => `${root}/${id}/attachments`
  const paymentAttachmentsPath = (id: number, paymentId: number) => `${paymentsPath(id)}/${paymentId}/attachments`
  const listPayments = async (id: number) => mapPaymentResult(await transport.get(paymentsPath(id)))
  const listPaymentAttachments = async (id: number, paymentId: number) => asRows(await transport.get(paymentAttachmentsPath(id, paymentId))).map(mapAttachment)
  const withPaymentAttachments = async (receiptId: number, result: FeedReceiptPaymentResult): Promise<FeedReceiptPaymentResult> => ({
    ...result,
    payments: result.payments ? await Promise.all(result.payments.map(async (payment) => ({
      ...payment,
      attachments: await listPaymentAttachments(receiptId, payment.id),
    }))) : null,
  })
  const getFromList = async (id: number) => mapReceipt(await transport.get(`${root}/${id}`))
  const withPaymentSummary = async (receipt: FeedReceipt): Promise<FeedReceipt> => {
    if (receipt.amountPaid !== undefined && receipt.outstanding !== undefined) return receipt
    if (receipt.status === 'DRAFT') return { ...receipt, amountPaid: 0, outstanding: receipt.totalPayable }
    const result = await listPayments(receipt.id)
    return { ...receipt, amountPaid: result.summary.paid, outstanding: result.summary.outstanding }
  }
  const expectedVersion = async (id: number, provided?: number) => provided ?? (await getFromList(id)).version

  return {
    async list(): Promise<FeedReceipt[]> {
      if (mode === 'backend') {
        const rows = asRows(await transport.get(root)).map(mapReceipt)
        return await Promise.all(rows.map(withPaymentSummary))
      }
      if (mockRows) return mockRows.map((row) => ({ ...row, lines: row.lines.map((line) => ({ ...line })) }))
      return (await demoStore.list()).map(mapDemoReceipt)
    },
    async get(id: string): Promise<FeedReceipt> {
      if (mode === 'backend') {
        const receipt = await withPaymentSummary(await getFromList(Number(id)))
        const result = await listPayments(Number(id))
        return {
          ...receipt,
          ...(receipt.status === 'DRAFT' ? {} : { amountPaid: result.summary.paid }),
          outstanding: result.summary.outstanding,
          payments: (await withPaymentAttachments(Number(id), result)).payments ?? [],
        }
      }
      return mapDemoReceipt(await demoStore.get(id))
    },
    async saveDraft(input: FeedReceiptDraftInput, options: ReceiptMutationOptions = {}): Promise<FeedReceipt> {
      if (mode === 'backend') {
        const key = options.key ?? commandKey()
        const body = receiptRequest(input, input.id === undefined ? false : undefined)
        let result: unknown
        if (input.id === undefined) {
          result = await transport.command(root, body, { key })
        } else {
          const current = await getFromList(input.id)
          const missingRoundTripFields = ['invoiceNumber', 'receivedBy', 'storageLocation', 'note']
            .filter((field) => current[field as keyof FeedReceipt] === undefined)
          if (missingRoundTripFields.length) {
            throw new Error(`Máy chủ chưa trả lại ${missingRoundTripFields.join(', ')}; không thể sửa nháp an toàn.`)
          }
          const expected = options.key ? versionByCommandKey.get(key) ?? current.version : current.version
          if (options.key && !versionByCommandKey.has(key)) versionByCommandKey.set(key, expected)
          result = await transport.command(`${root}/${input.id}/draft`, { ...body, expectedVersion: expected }, { method: 'PUT', key })
        }
        const receipt = mapReceipt(result)
        if (options.key) versionByCommandKey.delete(key)
        return receipt
      }
      return mapDemoReceipt(await demoStore.saveDraft(input))
    },
    async createAndPost(input: FeedReceiptDraftInput, options: ReceiptMutationOptions = {}): Promise<FeedReceipt> {
      if (mode === 'backend') return mapReceipt(await transport.command(root, receiptRequest(input, true), { key: options.key ?? commandKey() }))
      const saved = await demoStore.saveDraft(input)
      return mapDemoReceipt(await demoStore.post(saved.id))
    },
    async voidCheck(id: number): Promise<FeedReceiptVoidCheckRow[]> {
      if (mode === 'backend') {
        const [receipt, stock] = await Promise.all([
          getFromList(id),
          transport.get(transport.farmPath(farmId, '/feed/stock')),
        ])
        const neededByFeed = new Map<number, number>()
        receipt.lines.forEach((line) => neededByFeed.set(line.feedItemId, (neededByFeed.get(line.feedItemId) ?? 0) + line.kgReceived))
        return [...neededByFeed.entries()].map(([feedItemId, neededKg]) => {
          const stockRow = asRows(stock).find((row) => numberValue(row.feedItemId) === feedItemId)
          const onHandKg = optionalNumber(stockRow?.onHandKg) ?? 0
          const hasStock = stockRow !== undefined && optionalNumber(stockRow.onHandKg) !== undefined
          return {
            feedItemId,
            code: receipt.lines.find((line) => line.feedItemId === feedItemId)?.feedCode ?? '',
            name: receipt.lines.find((line) => line.feedItemId === feedItemId)?.feedName ?? '',
            onHandKg,
            neededKg,
            ok: hasStock && onHandKg >= neededKg,
          }
        })
      }
      return demoStore.voidCheck(id)
    },
    async void(id: number, reason: string, version?: number, options: ReceiptMutationOptions = {}): Promise<FeedReceipt> {
      if (mode === 'backend') {
        const expected = await expectedVersion(id, version)
        return mapReceipt(await transport.command(`${root}/${id}/void`, { reason, expectedVersion: expected }, { key: options.key ?? commandKey() }))
      }
      return mapDemoReceipt(await demoStore.void(id, reason))
    },
    async discardDraft(id: number, version?: number, options: ReceiptMutationOptions = {}): Promise<void> {
      if (mode !== 'backend') throw new Error('Bỏ nháp trên máy chủ chỉ có trong chế độ backend.')
      const expected = await expectedVersion(id, version)
      await transport.command(`${root}/${id}`, { expectedVersion: expected }, { method: 'DELETE', key: options.key ?? commandKey() })
    },
    async post(id: number, version?: number, options: ReceiptMutationOptions = {}): Promise<FeedReceipt> {
      if (mode === 'backend') {
        const expected = await expectedVersion(id, version)
        return mapReceipt(await transport.command(`${root}/${id}/post`, { expectedVersion: expected }, { key: options.key ?? commandKey() }))
      }
      return mapDemoReceipt(await demoStore.post(id))
    },
    async payments(id: number): Promise<FeedReceiptPaymentResult> {
      if (mode === 'backend') return withPaymentAttachments(id, await listPayments(id))
      const row = await demoStore.get(String(id))
      return mapDemoPaymentResult(row)
    },
    async attachments(id: number): Promise<FeedReceiptAttachment[]> {
      if (mode === 'backend') return asRows(await transport.get(attachmentsPath(id))).map(mapAttachment)
      return []
    },
    async uploadAttachment(id: number, file: File, options: ReceiptMutationOptions = {}): Promise<FeedReceiptAttachment> {
      if (mode !== 'backend') throw new Error('Lưu chứng từ trên máy chủ chỉ có trong chế độ backend.')
      const data = new FormData()
      data.append('file', file)
      const key = options.key ?? await attachmentKey(id, file)
      return mapAttachment(await transport.command(attachmentsPath(id), data, { key }))
    },
    async removeAttachment(id: number, attachmentId: number, options: ReceiptMutationOptions = {}): Promise<FeedReceiptAttachment> {
      if (mode !== 'backend') throw new Error('Xóa chứng từ trên máy chủ chỉ có trong chế độ backend.')
      return mapAttachment(await transport.command(`${attachmentsPath(id)}/${attachmentId}`, undefined, { method: 'DELETE', key: options.key ?? commandKey() }))
    },
    async downloadAttachment(id: number, attachmentId: number): Promise<Blob> {
      if (mode !== 'backend') throw new Error('Tải chứng từ trên máy chủ chỉ có trong chế độ backend.')
      const result = await transport.get(`${attachmentsPath(id)}/${attachmentId}`)
      if (!(result instanceof Blob)) throw new TypeError('Receipt attachment response is not a file')
      return result
    },
    async paymentAttachments(id: number, paymentId: number): Promise<FeedReceiptAttachment[]> {
      if (mode !== 'backend') throw new Error('Chứng từ khoản trả chỉ có trong chế độ backend.')
      return listPaymentAttachments(id, paymentId)
    },
    async uploadPaymentAttachment(id: number, paymentId: number, file: File, options: ReceiptMutationOptions = {}): Promise<FeedReceiptAttachment> {
      if (mode !== 'backend') throw new Error('Lưu chứng từ khoản trả chỉ có trong chế độ backend.')
      const data = new FormData()
      data.append('file', file)
      const key = options.key ?? await attachmentKey(id, file).then((base) => `${base}:payment:${paymentId}`)
      return mapAttachment(await transport.command(paymentAttachmentsPath(id, paymentId), data, { key }))
    },
    async downloadPaymentAttachment(id: number, paymentId: number, attachmentId: number): Promise<Blob> {
      if (mode !== 'backend') throw new Error('Tải chứng từ khoản trả chỉ có trong chế độ backend.')
      const result = await transport.get(`${paymentAttachmentsPath(id, paymentId)}/${attachmentId}`)
      if (!(result instanceof Blob)) throw new TypeError('Payment attachment response is not a file')
      return result
    },
    async recordPayment(id: number, input: RecordPaymentInput, options: ReceiptMutationOptions = {}): Promise<FeedReceiptPaymentResult> {
      if (mode === 'backend') {
        const receipt = await getFromList(id)
        const key = options.key ?? commandKey()
        const voucherVersion = options.key ? versionByCommandKey.get(key) ?? receipt.version : receipt.version
        if (options.key && !versionByCommandKey.has(key)) versionByCommandKey.set(key, voucherVersion)
        const result = mapPaymentResult(await transport.command(paymentsPath(id), {
          paymentDate: input.date,
          amount: input.amount,
          method: input.method,
          reference: input.reference?.trim() || null,
          note: input.note?.trim() || null,
          voucherVersion,
        }, { key }))
        const payments = await withPaymentAttachments(id, await listPayments(id))
        if (options.key) versionByCommandKey.delete(key)
        return { ...result, payments: payments.payments, summary: payments.summary }
      }
      const row = await demoStore.recordPayment(id, input.amount, input.method, input.date)
      return { ...mapDemoPaymentResult(row), payment: null }
    },
    async voidPayment(id: number, paymentId: number, reason: string, paymentVersion?: number, options: ReceiptMutationOptions = {}): Promise<FeedReceiptPaymentResult> {
      if (mode === 'backend') {
        const result = mapPaymentResult(await transport.command(transport.farmPath(farmId, `/payments/${paymentId}/void`), {
          reason,
          ...(paymentVersion === undefined ? {} : { version: paymentVersion }),
        }, { key: options.key ?? commandKey() }))
        const payments = await withPaymentAttachments(id, await listPayments(id))
        return { ...result, payments: payments.payments, summary: payments.summary }
      }
      throw new Error('Hủy khoản trả chỉ có trong chế độ backend.')
    },
  }
}

const feedReceiptApi = createFeedReceiptApi({ mode: backendMode, farmId: backendFarmId, transport: backendTransport })

export const listFeedReceipts = () => feedReceiptApi.list()
export const getFeedReceipt = (id: string) => feedReceiptApi.get(id)
export const getFeedReceiptDemo = getFeedReceipt
export const saveFeedReceiptDraft = (input: FeedReceiptDraftInput, options?: ReceiptMutationOptions) => feedReceiptApi.saveDraft(input, options)
export const saveFeedReceiptDemoDraft = saveFeedReceiptDraft
export const createAndPostFeedReceipt = (input: FeedReceiptDraftInput, options?: ReceiptMutationOptions) => feedReceiptApi.createAndPost(input, options)
export const postFeedReceipt = (id: number, version?: number, options?: ReceiptMutationOptions) => feedReceiptApi.post(id, version, options)
export const postFeedReceiptDemo = postFeedReceipt
export const voidFeedReceipt = (id: number, reason: string, expectedVersion?: number, options?: ReceiptMutationOptions) => feedReceiptApi.void(id, reason, expectedVersion, options)
export const discardFeedReceiptDraft = (id: number, expectedVersion?: number, options?: ReceiptMutationOptions) => feedReceiptApi.discardDraft(id, expectedVersion, options)
export const listFeedReceiptPayments = (id: number) => feedReceiptApi.payments(id)
export const recordFeedReceiptPayment = (id: number, input: RecordPaymentInput, options?: ReceiptMutationOptions) => feedReceiptApi.recordPayment(id, input, options)
export const voidFeedReceiptPayment = (id: number, paymentId: number, reason: string, version?: number, options?: ReceiptMutationOptions) => feedReceiptApi.voidPayment(id, paymentId, reason, version, options)
export const listFeedReceiptAttachments = (id: number) => feedReceiptApi.attachments(id)
export const uploadFeedReceiptAttachment = (id: number, file: File, options?: ReceiptMutationOptions) => feedReceiptApi.uploadAttachment(id, file, options)
export const removeFeedReceiptAttachment = (id: number, attachmentId: number, options?: ReceiptMutationOptions) => feedReceiptApi.removeAttachment(id, attachmentId, options)
export const downloadFeedReceiptAttachment = (id: number, attachmentId: number) => feedReceiptApi.downloadAttachment(id, attachmentId)
export const listFeedReceiptPaymentAttachments = (id: number, paymentId: number) => feedReceiptApi.paymentAttachments(id, paymentId)
export const uploadFeedReceiptPaymentAttachment = (id: number, paymentId: number, file: File, options?: ReceiptMutationOptions) => feedReceiptApi.uploadPaymentAttachment(id, paymentId, file, options)
export const downloadFeedReceiptPaymentAttachment = (id: number, paymentId: number, attachmentId: number) => feedReceiptApi.downloadPaymentAttachment(id, paymentId, attachmentId)
export const checkFeedReceiptVoid = (id: number) => feedReceiptApi.voidCheck(id)
export const resetFeedReceiptDemoStore = () => feedReceiptDemoStore.reset()
