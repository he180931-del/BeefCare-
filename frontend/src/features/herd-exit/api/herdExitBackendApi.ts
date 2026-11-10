import type { CattleInput, ExitDetail, ExitDraft, ExitStatus, ExitType, HerdExit, Payment } from '../../../types'
import {
  asRecord, asRows, enumPaymentMethod, isoDate, nullableNumber, numberValue, textValue, unwrapVoucher,
  type BackendTransport,
} from '../../../api/backendTransport'

export type { BackendTransport } from '../../../api/backendTransport'

type SaveInput = { id?: string; record: Partial<HerdExit>; cattleRows?: CattleInput[]; documents?: File[] }
type PaymentInput = Pick<Payment, 'date' | 'amount' | 'method' | 'ref'> & { note?: string }
export type ExitCheckMessage = { code?: string; text?: string; params?: Record<string, unknown> }
export type ExitCattleCheck = {
  cattleId: number; cattleCode: string; penId: number; penCode: string; hasWarnings: boolean; messages: ExitCheckMessage[]
}
export type ExitCheckOccupancy = { penId: number; penCode: string; capacity: number; before: number; after: number }
export type ExitChecks = {
  voucherId: number; code: string; version: number; exitDate: string; cattle: ExitCattleCheck[]; occupancy: ExitCheckOccupancy[]
}
export type ExitCandidate = {
  code: string; backendId?: number; tag: string; breed: string; sex: string; age: string; group: string; groupKey?: string; stage: string; stageKey?: string; barn: string
  weight: number; weightNote: string; estimated: boolean; unitPrice: number; withdrawalUntil?: string; openCase?: string; penCount?: number; penCapacity?: number
}

const LIFE_STAGE_LABELS: Record<string, string> = {
  UNWEANED_CALF: 'Bê chưa cai sữa', WEANED_CALF: 'Bê cai sữa', YOUNG_STOCK: 'Bò tơ', ADULT: 'Bò trưởng thành',
}
const HERD_GROUP_LABELS: Record<string, string> = {
  CALVES: 'Bê', FATTENING: 'Vỗ béo', BREEDING_BULLS: 'Đực giống', BREEDING_FEMALES: 'Bò cái sinh sản', YOUNG_STOCK: 'Bò tơ', OTHER: 'Khác',
}

const statusFromBackend = (status: unknown): ExitStatus => {
  if (status === 'CONFIRMED') return 'Đã xuất'
  if (status === 'VOIDED') return 'Đã hủy'
  if (status === 'DISMISSED') return 'Đã bác'
  if (status === 'PENDING') return 'Chờ xác nhận'
  return 'Nháp'
}
const typeFromBackend = (type: unknown): ExitType => type === 'DEATH' ? 'Chết / mất' : type === 'CULL' ? 'Loại thải' : type === 'OTHER' ? 'Khác' : 'Bán'
const exitType = (type: unknown) => type === 'Chết / mất' ? 'DEATH' : type === 'Loại thải' ? 'CULL' : type === 'Khác' ? 'OTHER' : 'SALE'
const pricingBasis = (value: unknown) => value === 'con' || value === 'PER_HEAD' ? 'PER_HEAD' as const : 'PER_KG' as const
const lossKind = (value: unknown) => {
  const normalized = textValue(value).trim().toUpperCase()
  return normalized === 'MISSING' || normalized.includes('MẤT') ? 'MISSING' : 'DIED'
}
const isMissingLoss = (value: unknown) => {
  const normalized = textValue(value).trim().toUpperCase()
  return normalized === 'MISSING' || normalized.includes('MẤT')
}
const lossTypeLabel = (value: unknown) => {
  const normalized = textValue(value).trim().toUpperCase()
  if (normalized === 'MISSING' || normalized.includes('MẤT')) return 'Mất tích'
  if (normalized === 'DIED' || normalized.includes('CHẾT')) return 'Chết'
  return textValue(value)
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

const paymentRows = (value: unknown): Payment[] => asRows(value).map((row) => ({
  date: textValue(row.paymentDate ?? row.date), by: textValue(row.recordedBy ?? row.createdBy, '—'),
  method: row.method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản', ref: textValue(row.reference, '—'), amount: numberValue(row.amount),
}))

const mapDocument = (value: unknown, root: string, voucherId: number) => {
  const document = asRecord(value)
  const contentType = textValue(document.contentType)
  const filename = textValue(document.originalFilename, 'Tài liệu')
  return {
    id: numberValue(document.id),
    name: filename,
    ext: contentType === 'application/pdf' || filename.toLowerCase().endsWith('.pdf') ? 'PDF' : 'JPG',
    size: numberValue(document.fileSize),
    url: `${root}/${voucherId}/attachments/${numberValue(document.id)}`,
  }
}

const mapDocuments = (value: unknown, root: string, voucherId: number) => {
  const body = asRecord(value)
  const rows = Array.isArray(value) ? value : body.attachments
  return asRows(rows).map((document) => mapDocument(document, root, voucherId))
}

const mapChecks = (value: unknown): ExitChecks => {
  const row = asRecord(value)
  const cattle = asRows(row.cattle).map((item) => ({
    cattleId: numberValue(item.cattleId), cattleCode: textValue(item.cattleCode), penId: numberValue(item.penId), penCode: textValue(item.penCode),
    hasWarnings: Boolean(item.hasWarnings),
    messages: asRows(item.messages).map((message) => ({
      ...(typeof message.code === 'string' ? { code: message.code } : {}),
      ...(typeof message.text === 'string' ? { text: message.text } : {}),
      ...(typeof message.params === 'object' && message.params !== null ? { params: message.params as Record<string, unknown> } : {}),
    })),
  }))
  return {
    voucherId: numberValue(row.voucherId), code: textValue(row.code), version: numberValue(row.version), exitDate: textValue(row.exitDate), cattle,
    occupancy: asRows(row.occupancy).map((item) => ({ penId: numberValue(item.penId), penCode: textValue(item.penCode), capacity: numberValue(item.capacity), before: numberValue(item.before), after: numberValue(item.after) })),
  }
}

const mapVoucher = (value: unknown, documents: unknown = [], root = '', voucherId = 0): HerdExit => {
  const row = asRecord(value)
  const lines = asRows(row.lines)
  const buyer = asRecord(row.buyer)
  const buyerName = textValue(buyer.label ?? buyer.name ?? row.buyerName)
  const total = nullableNumber(row.totalReceivable ?? row.totalAmount)
  const due = nullableNumber(row.outstanding ?? row.outstandingAmount)
  const cows = lines.map((line) => ({
    code: textValue(line.cattleCode), tag: textValue(line.earTagNumber, '—'), backendId: numberValue(line.cattleId),
    breed: `${textValue(line.breedName, 'Bò')} · ${line.sex === 'MALE' ? 'Đực' : 'Cái'}`,
    weight: numberValue(line.exitWeightKg), estimated: Boolean(line.estimated), barn: textValue(line.penCode),
    current: statusFromBackend(row.status) === 'Đã xuất' ? 'EXITED' : textValue(line.herdStatus), amount: numberValue(line.lineAmount), unitPrice: numberValue(line.unitPrice),
  }))
  const detail: ExitDetail = {
    death: Boolean(row.loss), lossType: lossTypeLabel(row.lossKind), date: textValue(row.exitDate),
    reason: textValue(row.deathCause), disposal: textValue(row.carcassDisposal), buyer: buyerName,
    quarantine: textValue(row.transportCertNo), plate: textValue(row.vehiclePlate), note: textValue(row.note),
    by: textValue(asRecord(row.confirmedBy).label ?? row.confirmedBy, '—'),
    cows,
    cowsTotal: numberValue(row.cattleAmount), deduction: numberValue(row.deductions), payments: paymentRows(row.payments), docs: mapDocuments(documents, root, voucherId),
    history: asRows(row.history).map((item) => textValue(item.text ?? item.type)).filter(Boolean),
  }
  if (Boolean(row.loss)) {
    detail.cow = cows[0]
    detail.source = textValue(asRecord(row.sourceHealthCase).label)
    detail.reporter = textValue(asRecord(row.reportedBy).label)
    detail.barnShift = textValue(lines[0]?.penCode)
  }
  const draft: ExitDraft | undefined = statusFromBackend(row.status) === 'Nháp' ? {
    type: typeFromBackend(row.exitType), date: textValue(row.exitDate), buyerId: buyer.id == null ? '' : String(buyer.id),
    quarantine: textValue(row.transportCertNo), plate: textValue(row.vehiclePlate),
    note: textValue(row.exitType === 'OTHER' ? row.destination ?? row.note : row.exitType === 'DEATH' ? row.deathCause ?? row.note : row.note),
    pricing: row.pricingBasis === 'PER_HEAD' ? 'con' : 'kg', deduction: numberValue(row.deductions), collected: numberValue(row.depositCollected ?? row.amountCollected),
    method: row.paymentMethod === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản', dueDate: textValue(row.collectionDueDate),
    docs: mapDocuments(documents, root, voucherId),
    cows: lines.map((line) => ({
      code: textValue(line.cattleCode), backendId: numberValue(line.cattleId), tag: textValue(line.earTagNumber), breed: textValue(line.breedName), sex: line.sex === 'MALE' ? 'Đực' : 'Cái',
      age: textValue(line.ageText ?? line.age), group: textValue(line.herdGroup ?? line.group), stage: textValue(line.lifeStage ?? line.stage),
      barn: textValue(line.penCode), weight: numberValue(line.exitWeightKg), weightNote: textValue(line.weightNote), unitPrice: numberValue(line.unitPrice), estimated: Boolean(line.estimated),
      ...(textValue(line.withdrawalUntil ?? line.withdrawalEndDate) ? { withdrawalUntil: textValue(line.withdrawalUntil ?? line.withdrawalEndDate) } : {}),
      ...(textValue(line.openCase ?? line.openCaseCode) ? { openCase: textValue(line.openCase ?? line.openCaseCode) } : {}),
    })),
  } : undefined
  return {
    id: textValue(row.code), backendId: numberValue(row.id), version: numberValue(row.version), date: textValue(row.exitDate),
    type: typeFromBackend(row.exitType), who: buyerName || textValue(row.destination ?? row.deathCause),
    sub: textValue(row.note), count: numberValue(row.cattleCount, lines.length), weight: numberValue(row.totalWeightKg),
    total, due, status: statusFromBackend(row.status), detail, draft, reason: textValue(row.closeReason), cancelReason: textValue(row.closeReason), note: textValue(row.note),
  }
}

const findNamedId = (rows: unknown, name: string): number | null => {
  const wanted = name.trim().toLocaleLowerCase('vi')
  const match = asRows(rows).find((row) => textValue(row.name ?? row.label).trim().toLocaleLowerCase('vi') === wanted)
  return match ? nullableNumber(match.id) : null
}

export function createHerdExitBackendApi({ transport, farmId }: { transport: BackendTransport; farmId: string | number }) {
  const root = transport.farmPath(farmId, '/exit-vouchers')
  const list = async (): Promise<HerdExit[]> => {
    const body = asRecord(await transport.get(root))
    return asRows(body.vouchers).map((row) => mapVoucher(row))
  }
  const resolve = async (code: string): Promise<{ backendId: number; version: number }> => {
    const row = (await list()).find((item) => item.id === code)
    if (!row) throw new Error(`Không tìm thấy phiếu xuất ${code}`)
    return { backendId: numberValue(row.backendId), version: numberValue(row.version) }
  }
  const get = async (code: string): Promise<HerdExit> => {
    const { backendId } = await resolve(code)
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
  const save = async ({ id, record, cattleRows = [], documents = [] }: SaveInput): Promise<HerdExit> => {
    const current = id
      ? await resolve(id).then(() => get(id)).catch((error: unknown) => {
        if (error instanceof Error && error.message === `Không tìm thấy phiếu xuất ${id}`) return null
        throw error
      })
      : null
    if (current?.status === 'Đã xuất' && record.status === 'Đã xuất') return current
    if (current) {
      record = {
        ...current,
        ...record,
        // Backend exit type is immutable after the first draft save.
        type: current.type,
        detail: { ...current.detail, ...record.detail },
        draft: record.draft ?? current.draft,
      }
    }
    const draft = record.draft ?? {}
    const detail = record.detail ?? {}
    const existing = current ? { backendId: numberValue(current.backendId), version: numberValue(current.version) } : null
    const [partners, selectable] = await Promise.all([
      transport.get(transport.farmPath(farmId, '/trading-partners?role=BUYER')),
      transport.get(`${root}/selectable-cattle`),
    ])
    const buyerName = textValue(detail.buyer ?? record.who)
    const persistedType = current?.type ?? record.type
    const backendExitType = exitType(persistedType)
    const backendLossKind = backendExitType === 'DEATH'
      ? lossKind(detail.lossType)
      : isMissingLoss(detail.lossType) ? 'MISSING' : null
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
      deathCause: backendLossKind ? textValue(detail.reason ?? record.reason ?? record.note) || null : null,
      carcassDisposal: backendLossKind === 'DIED' ? textValue(detail.disposal) || null : null,
      pricingBasis: pricingBasis(draft.pricing), deductions: numberValue(draft.deduction ?? detail.deduction),
      depositCollected: numberValue(draft.collected), paymentMethod: enumPaymentMethod(draft.method), collectionDueDate: textValue(draft.dueDate) || null,
      lines: cattleRows.map((cow) => {
        const match = selectableRows.find((item) => textValue(item.cattleCode) === textValue(cow.code))
        const cattleId = nullableNumber(cow.backendId) ?? nullableNumber(match?.cattleId)
        if (!cattleId) throw new Error(`Bò ${textValue(cow.code)} không còn đủ điều kiện xuất`)
        const exitWeightKg = nullableNumber(cow.weight) || null
        const weightBasis = exitWeightKg == null ? null : cow.estimated ? 'ESTIMATED' : 'MEASURED'
        return { cattleId, exitWeightKg, weightBasis, unitPrice: numberValue(cow.unitPrice) }
      }),
      expectedVersion: existing?.version ?? null,
    }
    const saveKey = `beefcare-exit-save-${await digest(canonicalize(body))}`
    const saved = unwrapVoucher(await transport.command(existing ? `${root}/${existing.backendId}` : root, body, { ...(existing ? { method: 'PUT' } : {}), key: saveKey }))
    const voucherId = numberValue(saved.id)
    const uploaded = []
    const existingDocuments = current?.detail?.docs ?? []
    const pendingDocuments = documents.filter((document) => !existingDocuments.some((savedDocument) => savedDocument.name === document.name && savedDocument.size === document.size))
    for (const document of pendingDocuments) {
      const form = new FormData()
      form.append('file', document)
      const documentKey = `beefcare-exit-upload-${voucherId}-${await fileDigest(document)}`
      uploaded.push(await transport.command(`${root}/${voucherId}/attachments`, form, { key: documentKey }))
    }
    const savedDocuments = [
      ...(current?.detail?.docs ?? []),
      ...uploaded.map((document) => mapDocument(document, root, voucherId)),
    ]
    if (record.status !== 'Đã xuất') return mapVoucher(saved, savedDocuments, root, voucherId)
    const confirmBody = { acknowledged: true, expectedVersion: numberValue(saved.version) }
    const confirmKey = `beefcare-exit-confirm-${await digest(canonicalize({ voucherId, ...confirmBody }))}`
    const confirmed = await transport.command(`${root}/${voucherId}/confirm`, confirmBody, { key: confirmKey })
    return mapVoucher(unwrapVoucher(confirmed), savedDocuments, root, voucherId)
  }
  const confirm = async (code: string, expectedVersion: number): Promise<HerdExit> => {
    const { backendId } = await resolve(code)
    const body = { acknowledged: true, expectedVersion }
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
    await transport.command(`${root}/${current.backendId}/attachments/${attachmentId}`, undefined, { method: 'DELETE' })
  }
  const voidVoucher = async (code: string, reason: string): Promise<HerdExit> => {
    const current = await resolve(code)
    const result = await transport.command(`${root}/${current.backendId}/void`, { reason, penOverrides: {}, warningReasons: {}, expectedVersion: current.version })
    return mapVoucher(unwrapVoucher(result))
  }
  const recordPayment = async (code: string, payment: PaymentInput): Promise<HerdExit> => {
    const current = await resolve(code)
    await transport.command(transport.farmPath(farmId, `/vouchers/exit/${current.backendId}/payments`), {
      paymentDate: isoDate(payment.date), amount: payment.amount, method: enumPaymentMethod(payment.method), reference: payment.ref || null,
      note: payment.note || null, voucherVersion: current.version,
    })
    return get(code)
  }
  const dismissVoucher = async (code: string, reason: string, expectedVersion?: number): Promise<HerdExit> => {
    const current = await resolve(code)
    const result = await transport.command(`${root}/${current.backendId}/dismiss`, { reason, expectedVersion: expectedVersion ?? current.version })
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
  const buyers = async () => asRows(await transport.get(transport.farmPath(farmId, '/trading-partners?role=BUYER'))).map((row) => ({
    id: String(numberValue(row.id)), name: textValue(row.name), phone: textValue(row.phone),
  }))
  return { list, get, checks, save, confirm, downloadAttachment, removeAttachment, voidVoucher, dismissVoucher, recordPayment, selectableCattle, buyers }
}
