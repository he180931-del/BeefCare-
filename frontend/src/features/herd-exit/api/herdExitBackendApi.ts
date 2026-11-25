import type { CattleInput } from '../../cattle'
import type { ExitBuyer, ExitBuyerInput, HerdExit } from '../types'
import type { ExitPayment } from '../types'
import type { Pen } from '../../pen-management'
import { asRecord, asRows, nullableNumber, numberValue, textValue } from '../../../shared/api/parse'
import type { BackendTransport } from '../../../shared/api/backendTransport'
import { isoDate } from '../../../shared/lib/date/isoDate'
import { voidVoucherPayment } from '../../../shared/api/voucherPayments'
import type { VoidVoucherPaymentInput } from '../../../shared/domain/voucherPayment'
import { requireVersion, type VoucherPaymentSnapshot, type VoucherSnapshot } from '../../../shared/api/snapshotVersion'
import { HERD_GROUP_LABELS, LIFE_STAGE_LABELS, enumPaymentMethod, optionalPaymentMethod, exitType, findNamedId, isMissingLoss, mapChecks, mapVoidCheck, mapDocument, mapDocuments, mapVoucher, pricingBasis, unwrapVoucher } from './herdExitMapper'

export type { BackendTransport } from '../../../shared/api/backendTransport'

type SaveInput = { id?: string; expectedVersion?: number; record: Partial<HerdExit>; cattleRows?: CattleInput[]; documents?: File[] }
type PaymentInput = Pick<ExitPayment, 'date' | 'amount' | 'method' | 'ref'> & { note?: string }
export type ExitCheckMessage = { code?: string; text?: string; params?: Record<string, unknown> }
export type ExitCattleCheck = {
  cattleId: number; cattleCode: string; penId: number; penCode: string; hasWarnings: boolean; messages: ExitCheckMessage[]
}
export type ExitCheckOccupancy = { penId: number; penCode: string; capacity: number; before: number; after: number }
export type ExitChecks = {
  voucherId: number; code: string; version?: number; exitDate: string; cattle: ExitCattleCheck[]; occupancy: ExitCheckOccupancy[]
}
export type ExitVoidCheck = {
  voucherId: number; code: string; version?: number; voidable: boolean
  cattle: Array<{ cattleId: number; cattleCode: string; needsPenOverride: boolean; lastPen: { penId: number; penCode: string; active: boolean; freePlaces: number } | null }>
  occupancyAfter: ExitCheckOccupancy[]
  message?: ExitCheckMessage
}
export type ExitVoidSelections = { penOverrides?: Record<string, number>; warningReasons?: Record<string, string> }
export type ExitCandidate = {
  code: string; backendId?: number; tag: string; breed: string; sex: string; age: string; group: string; groupKey?: string; stage: string; stageKey?: string; barn: string
  weight: number; weightNote: string; estimated: boolean; unitPrice: number; withdrawalUntil?: string; openCase?: string; penCount?: number; penCapacity?: number
}

const canonicalize = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`
  return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${canonicalize((value as Record<string, unknown>)[key])}`).join(',')}}`
}

const digestBytes = async (bytes: Uint8Array): Promise<string> => {
  if (globalThis.crypto?.subtle) {
    const copied = new Uint8Array(bytes.byteLength)
    copied.set(bytes)
    const buffer = await globalThis.crypto.subtle.digest('SHA-256', copied.buffer)
    return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  }
  let first = 0x811c9dc5
  let second = 0x9e3779b9
  for (const byte of bytes) {
    first = Math.imul(first ^ byte, 0x01000193)
    second = Math.imul(second ^ byte, 0x85ebca6b)
  }
  return `${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0).toString(16).padStart(8, '0')}`
}

const digest = async (value: string): Promise<string> => digestBytes(new TextEncoder().encode(value))

const readFileBytes = async (file: File): Promise<ArrayBuffer> => {
  if (typeof file.arrayBuffer === 'function') return file.arrayBuffer()
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) resolve(reader.result)
      else reject(new Error('Không thể đọc nội dung chứng từ'))
    }
    reader.onerror = () => reject(reader.error ?? new Error('Không thể đọc nội dung chứng từ'))
    reader.readAsArrayBuffer(file)
  })
}

const fileDigest = async (file: File): Promise<string> => {
  const metadata = new TextEncoder().encode(`${file.name}\u0000${file.type}\u0000${file.size}\u0000`)
  const content = new Uint8Array(await readFileBytes(file))
  const bytes = new Uint8Array(metadata.length + content.length)
  bytes.set(metadata)
  bytes.set(content, metadata.length)
  return digestBytes(bytes)
}

export function createHerdExitBackendApi({ transport, farmId }: { transport: BackendTransport; farmId: string | number | null }) {
  const root = transport.farmPath(farmId, '/exit-vouchers')
  const list = async (): Promise<HerdExit[]> => {
    const body = asRecord(await transport.get(root))
    return asRows(body.vouchers).map((row) => mapVoucher(row))
  }
  const resolve = async (code: string, backendId?: number): Promise<{ backendId: number }> => {
    if (backendId != null) return { backendId }
    const row = (await list()).find((item) => item.id === code)
    if (!row) throw new Error(`Không tìm thấy phiếu xuất ${code}`)
    return { backendId: numberValue(row.backendId) }
  }
  const get = async (code: string, knownBackendId?: number): Promise<HerdExit> => {
    const { backendId } = await resolve(code, knownBackendId)
    const [voucherBody, documents] = await Promise.all([
      transport.get(`${root}/${backendId}`),
      transport.get(`${root}/${backendId}/attachments`),
    ])
    return mapVoucher(voucherBody, documents, root, backendId)
  }
  const checks = async (code: string): Promise<ExitChecks> => {
    const { backendId } = await resolve(code)
    return mapChecks(await transport.get(`${root}/${backendId}/checks`))
  }
  const voidCheck = async (code: string, backendId?: number): Promise<ExitVoidCheck> => {
    const current = await resolve(code, backendId)
    return mapVoidCheck(await transport.get(`${root}/${current.backendId}/void-check`))
  }
  const listPens = async (): Promise<Pen[]> => {
    const response = await transport.get(transport.farmPath(farmId, '/pens'))
    const rows = Array.isArray(response) ? asRows(response) : asRows(asRecord(response).pens)
    return rows.map((pen) => ({
      id: numberValue(pen.id), code: textValue(pen.code), name: textValue(pen.name, textValue(pen.code)),
      count: numberValue(pen.headcount), capacity: numberValue(pen.capacity), status: pen.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE', cows: [],
    }))
  }
  const save = async ({ id, expectedVersion, record, cattleRows = [], documents = [] }: SaveInput): Promise<HerdExit> => {
    const version = id ? requireVersion(expectedVersion) : null
    const existing = id ? await resolve(id, record.backendId) : null
    const draft = record.draft ?? {}
    const detail = record.detail ?? {}
    const [partners, selectable] = await Promise.all([
      transport.get(transport.farmPath(farmId, '/trading-partners?role=BUYER')),
      transport.get(`${root}/selectable-cattle`),
    ])
    const buyerName = textValue(detail.buyer ?? record.who)
    const persistedType = record.type
    // A pending voucher created by a health case owns its loss kind. Ignore any stale or tampered
    // screen value and let the backend's completion workflow keep the source case result authoritative.
    const sourceLossKind = detail.sourceHealthCaseId != null ? detail.lossKind : undefined
    const explicitLossKind = sourceLossKind ?? draft.lossKind ?? detail.lossKind ?? detail.lossType
    const isLoss = persistedType === 'Chết / mất' || isMissingLoss(explicitLossKind)
    const backendLossKind = isLoss ? (isMissingLoss(explicitLossKind) ? 'MISSING' : 'DIED') : null
    const backendExitType = backendLossKind === 'MISSING' ? 'OTHER' : backendLossKind === 'DIED' ? 'DEATH' : exitType(persistedType)
    const needsBuyer = backendExitType === 'SALE' || backendExitType === 'CULL'
    const selectedBuyerId = Number(draft.buyerId)
    const buyerId = needsBuyer
      ? (Number.isSafeInteger(selectedBuyerId) && selectedBuyerId > 0 ? selectedBuyerId : findNamedId(partners, buyerName))
      : null
    const selectableRows = asRows(selectable)
    const body = {
      exitType: backendExitType, exitDate: textValue(record.date ?? draft.date), buyerId,
      destination: backendExitType === 'OTHER' ? textValue(record.who) || null : null,
      transportCertNo: textValue(draft.quarantine ?? detail.quarantine) || null, vehiclePlate: textValue(draft.plate ?? detail.plate) || null,
      note: textValue(draft.note ?? detail.note ?? record.note) || null,
      lossKind: backendLossKind,
      deathCause: backendLossKind ? textValue(draft.deathCause ?? detail.reason ?? record.reason ?? record.note) || null : null,
      carcassDisposal: backendLossKind === 'DIED' ? textValue(draft.carcassDisposal ?? detail.disposal) || null : null,
      pricingBasis: pricingBasis(draft.pricing), deductions: numberValue(draft.deduction ?? detail.deduction),
      depositCollected: numberValue(draft.collected), paymentMethod: optionalPaymentMethod(draft.method), collectionDueDate: textValue(draft.dueDate) || null,
      lines: cattleRows.map((cow) => {
        const match = selectableRows.find((item) => textValue(item.cattleCode) === textValue(cow.code))
        const cattleId = nullableNumber(cow.backendId) ?? nullableNumber(match?.cattleId)
        if (!cattleId) throw new Error(`Bò ${textValue(cow.code)} không còn đủ điều kiện xuất`)
        const exitWeightKg = nullableNumber(cow.weight) || null
        const weightBasis = exitWeightKg == null ? null : cow.estimated ? 'ESTIMATED' : 'MEASURED'
        return { cattleId, exitWeightKg, weightBasis, unitPrice: numberValue(cow.unitPrice) }
      }),
      expectedVersion: version,
    }
    const saveKey = `beefcare-exit-save-${await digest(canonicalize(body))}`
    const saved = unwrapVoucher(await transport.command(existing ? `${root}/${existing.backendId}` : root, body, { ...(existing ? { method: 'PUT' } : {}), key: saveKey }))
    const voucherId = numberValue(saved.id)
    const uploaded = []
    // Attachment readback preserves partial-upload retries; it supplies no command version.
    const existingDocuments = existing
      ? mapDocuments(await transport.get(`${root}/${voucherId}/attachments`), root, voucherId)
      : detail.docs ?? draft.docs ?? []
    const pendingDocuments = documents.filter((document) => !existingDocuments.some((savedDocument) => savedDocument.name === document.name && savedDocument.size === document.size))
    for (const document of pendingDocuments) {
      const form = new FormData()
      form.append('file', document)
      const documentKey = `beefcare-exit-upload-${voucherId}-${await fileDigest(document)}`
      uploaded.push(await transport.command(`${root}/${voucherId}/attachments`, form, { key: documentKey }))
    }
    const savedDocuments = [
      ...existingDocuments,
      ...uploaded.map((document) => mapDocument(document, root, voucherId)),
    ]
    if (record.status !== 'Đã xuất') return mapVoucher(saved, savedDocuments, root, voucherId)
    const confirmBody = { acknowledged: true, expectedVersion: requireVersion(saved.version) }
    const confirmKey = `beefcare-exit-confirm-${await digest(canonicalize({ voucherId, ...confirmBody }))}`
    const confirmed = await transport.command(`${root}/${voucherId}/confirm`, confirmBody, { key: confirmKey })
    return mapVoucher(unwrapVoucher(confirmed), savedDocuments, root, voucherId)
  }
  const confirm = async (code: string, expectedVersion: number | undefined): Promise<HerdExit> => {
    const version = requireVersion(expectedVersion)
    const { backendId } = await resolve(code)
    const body = { acknowledged: true, expectedVersion: version }
    const key = `beefcare-exit-confirm-${await digest(canonicalize({ voucherId: backendId, ...body }))}`
    const confirmed = await transport.command(`${root}/${backendId}/confirm`, body, { key })
    return mapVoucher(unwrapVoucher(confirmed), [], root, backendId)
  }
  const downloadAttachment = async (code: string, attachmentId: number): Promise<Blob> => {
    const { backendId } = await resolve(code)
    return await transport.get(`${root}/${backendId}/attachments/${attachmentId}`) as Blob
  }
  const removeAttachment = async (code: string, attachmentId: number): Promise<void> => {
    const current = await resolve(code)
    const key = `beefcare-exit-attachment-remove-${await digest(canonicalize({ voucherId: current.backendId, attachmentId }))}`
    await transport.command(`${root}/${current.backendId}/attachments/${attachmentId}`, undefined, { method: 'DELETE', key })
  }
  const voidVoucher = async (code: string, { reason, expectedVersion, backendId, penOverrides = {}, warningReasons = {} }: VoucherSnapshot & ExitVoidSelections & { reason: string }): Promise<HerdExit> => {
    const version = requireVersion(expectedVersion)
    const current = await resolve(code, backendId)
    const body = {
      reason: reason.trim(), expectedVersion: version,
      penOverrides: Object.fromEntries(Object.entries(penOverrides).filter(([id, pen]) => /^[1-9]\d*$/.test(id) && Number.isSafeInteger(pen) && pen > 0)),
      warningReasons: Object.fromEntries(Object.entries(warningReasons).filter(([id, text]) => /^[1-9]\d*$/.test(id) && text.trim()).map(([id, text]) => [id, text.trim()])),
    }
    const key = `beefcare-exit-void-${await digest(canonicalize({ voucherId: current.backendId, ...body }))}`
    const result = await transport.command(`${root}/${current.backendId}/void`, body, { key })
    return mapVoucher(unwrapVoucher(result))
  }
  const recordPayment = async (code: string, payment: PaymentInput, snapshot: VoucherPaymentSnapshot): Promise<HerdExit> => {
    const version = requireVersion(snapshot?.voucherVersion)
    const current = await resolve(code, snapshot?.backendId)
    const body = {
      paymentDate: isoDate(payment.date), amount: payment.amount, method: enumPaymentMethod(payment.method), reference: payment.ref || null,
      note: payment.note || null, voucherVersion: version,
    }
    const key = `beefcare-exit-collection-${await digest(canonicalize({ voucherId: current.backendId, ...body }))}`
    await transport.command(transport.farmPath(farmId, `/vouchers/exit/${current.backendId}/payments`), body, { key })
    return get(code, current.backendId)
  }
  const dismissVoucher = async (code: string, reason: string, expectedVersion: number | undefined, backendId?: number): Promise<HerdExit> => {
    const version = requireVersion(expectedVersion)
    const current = await resolve(code, backendId)
    const body = { reason, expectedVersion: version }
    const key = `beefcare-exit-dismiss-${await digest(canonicalize({ voucherId: current.backendId, ...body }))}`
    const result = await transport.command(`${root}/${current.backendId}/dismiss`, body, { key })
    return mapVoucher(unwrapVoucher(result))
  }
  const selectableCattle = async (): Promise<ExitCandidate[]> => asRows(await transport.get(`${root}/selectable-cattle`)).map((row) => {
    const latest = asRecord(row.latestWeight)
    const months = numberValue(row.ageMonths)
    const groupKey = textValue(row.herdGroup)
    const stageKey = textValue(row.lifeStage)
    const cattleId = nullableNumber(row.cattleId)
    const result: ExitCandidate = {
      code: textValue(row.cattleCode), ...(cattleId !== null ? { backendId: cattleId } : {}), tag: textValue(row.earTagNumber), breed: textValue(row.breedName),
      sex: row.sex === 'MALE' ? 'Đực' : 'Cái', age: months ? `${months} tháng` : '—', group: HERD_GROUP_LABELS[groupKey] ?? groupKey, groupKey,
      stage: LIFE_STAGE_LABELS[stageKey] ?? stageKey, stageKey, barn: textValue(row.penCode), weight: numberValue(latest.weightKg),
      weightNote: latest.weightKg == null ? 'Chưa có lần cân' : latest.basis === 'ESTIMATED' ? `ước tính ${textValue(latest.date)}` : `cân ${textValue(latest.date)}`,
      estimated: latest.basis === 'ESTIMATED', unitPrice: 0,
    }
    const penCount = nullableNumber(row.penCount ?? row.penOccupancy ?? row.occupancy)
    const penCapacity = nullableNumber(row.penCapacity ?? row.capacity)
    if (penCount !== null) result.penCount = penCount
    if (penCapacity !== null) result.penCapacity = penCapacity
    const withdrawalUntil = textValue(row.withdrawalEndDate)
    const openCaseId = nullableNumber(row.openCaseId)
    if (withdrawalUntil) result.withdrawalUntil = withdrawalUntil
    if (openCaseId) result.openCase = `HC-${openCaseId}`
    return result
  })
  const buyers = async (): Promise<ExitBuyer[]> => asRows(await transport.get(transport.farmPath(farmId, '/trading-partners?role=BUYER'))).map((row) => ({
    id: String(numberValue(row.id)), name: textValue(row.name), phone: textValue(row.phone), area: textValue(row.area), note: textValue(row.note),
    active: textValue(row.status, 'ACTIVE') === 'ACTIVE', version: numberValue(row.version),
  }))
  const saveBuyer = async (input: ExitBuyerInput, options: { key?: string } = {}): Promise<ExitBuyer> => {
    const name = input.name.trim()
    const phone = input.phone.trim()
    const area = input.area?.trim() ?? ''
    if (!name) throw new Error('Tên người mua là bắt buộc.')
    const response = await transport.command(transport.farmPath(farmId, '/trading-partners'), {
      name, phone, area, note: '', seller: false, buyer: true, supplier: false,
    }, { method: 'POST', ...(options.key ? { key: options.key } : {}) })
    const row = asRecord(response)
    return {
      id: String(numberValue(row.id)), name: textValue(row.name, name), phone: textValue(row.phone, phone),
      area: textValue(row.area), note: textValue(row.note), active: textValue(row.status, 'ACTIVE') === 'ACTIVE', version: numberValue(row.version),
    }
  }
  const voidPayment = (paymentId: number, input: VoidVoucherPaymentInput) => voidVoucherPayment(transport, farmId, paymentId, input)
  return { list, get, checks, voidCheck, listPens, save, confirm, downloadAttachment, removeAttachment, voidVoucher, dismissVoucher, recordPayment, voidPayment, selectableCattle, buyers, saveBuyer }
}
