import { asRecord, asRows, nullableNumber, numberValue, textValue } from '../../../shared/api/parse'
import type { ExitDetail, ExitDraft, ExitPayment, ExitStatus, ExitType, HerdExit, LossKind } from '../types'
import type { ExitChecks } from './herdExitBackendApi'

// Exit voucher DTO ↔ screen model mapping (ExitVoucherResource), moved out of herdExitBackendApi.ts.
export const LIFE_STAGE_LABELS: Record<string, string> = {
  UNWEANED_CALF: 'Bê chưa cai sữa', WEANED_CALF: 'Bê cai sữa', YOUNG_STOCK: 'Bò tơ', ADULT: 'Bò trưởng thành',
}
export const HERD_GROUP_LABELS: Record<string, string> = {
  CALVES: 'Bê', FATTENING: 'Vỗ béo', BREEDING_BULLS: 'Đực giống', BREEDING_FEMALES: 'Bò cái sinh sản', YOUNG_STOCK: 'Bò tơ', OTHER: 'Khác',
}

export const statusFromBackend = (status: unknown): ExitStatus => {
  if (status === 'CONFIRMED') return 'Đã xuất'
  if (status === 'VOIDED') return 'Đã hủy'
  if (status === 'DISMISSED') return 'Đã bác'
  if (status === 'PENDING') return 'Chờ xác nhận'
  return 'Nháp'
}
export const typeFromBackend = (type: unknown, loss = false): ExitType => type === 'DEATH' || loss ? 'Chết / mất' : type === 'CULL' ? 'Loại thải' : type === 'OTHER' ? 'Khác' : 'Bán'
export const exitType = (type: unknown) => type === 'Chết / mất' ? 'DEATH' : type === 'Loại thải' ? 'CULL' : type === 'Khác' ? 'OTHER' : 'SALE'
export const pricingBasis = (value: unknown) => value === 'con' || value === 'PER_HEAD' ? 'PER_HEAD' as const : 'PER_KG' as const
export const lossKind = (value: unknown) => {
  const normalized = textValue(value).trim().toUpperCase()
  return normalized === 'MISSING' || normalized.includes('MẤT') ? 'MISSING' : 'DIED'
}
export const isMissingLoss = (value: unknown) => {
  const normalized = textValue(value).trim().toUpperCase()
  return normalized === 'MISSING' || normalized.includes('MẤT')
}
export const lossTypeLabel = (value: unknown) => {
  const normalized = textValue(value).trim().toUpperCase()
  if (normalized === 'MISSING' || normalized.includes('MẤT')) return 'Mất tích'
  if (normalized === 'DIED' || normalized.includes('CHẾT')) return 'Chết'
  return textValue(value)
}

export const paymentRows = (value: unknown): ExitPayment[] => asRows(value).map((row) => ({
  date: textValue(row.paymentDate ?? row.date), by: textValue(row.recordedBy ?? row.createdBy, '—'),
  method: row.method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản', ref: textValue(row.reference, '—'), amount: numberValue(row.amount),
}))

export const mapDocument = (value: unknown, root: string, voucherId: number) => {
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

export const mapDocuments = (value: unknown, root: string, voucherId: number) => {
  const body = asRecord(value)
  const rows = Array.isArray(value) ? value : body.attachments
  return asRows(rows).map((document) => mapDocument(document, root, voucherId))
}

export const mapChecks = (value: unknown): ExitChecks => {
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

export const mapVoucher = (value: unknown, documents: unknown = [], root = '', voucherId = 0): HerdExit => {
  const row = asRecord(value)
  const lines = asRows(row.lines)
  const buyer = asRecord(row.buyer)
  const sourceHealthCase = asRecord(row.sourceHealthCase)
  const sourceHealthCaseId = nullableNumber(sourceHealthCase.id)
  const buyerName = textValue(buyer.label ?? buyer.name ?? row.buyerName)
  const total = nullableNumber(row.totalReceivable ?? row.totalAmount)
  const due = nullableNumber(row.outstanding ?? row.outstandingAmount)
  const cows = lines.map((line) => ({
    code: textValue(line.cattleCode), tag: textValue(line.earTagNumber, '—'), backendId: numberValue(line.cattleId),
    breed: `${textValue(line.breedName, 'Bò')} · ${line.sex === 'MALE' ? 'Đực' : 'Cái'}`,
    weight: numberValue(line.exitWeightKg), estimated: Boolean(line.estimated), barn: textValue(line.penCode),
    current: statusFromBackend(row.status) === 'Đã xuất' ? 'EXITED' : textValue(line.herdStatus), amount: numberValue(line.lineAmount), unitPrice: numberValue(line.unitPrice),
  }))
  const isLoss = row.exitType === 'DEATH' || Boolean(row.loss) || row.lossKind === 'DIED' || row.lossKind === 'MISSING'
  const persistedLossKind = row.lossKind === 'MISSING' ? 'MISSING' : isLoss ? 'DIED' : undefined
  const detail: ExitDetail = {
    death: isLoss, ...(persistedLossKind ? { lossKind: persistedLossKind as LossKind } : {}), lossType: lossTypeLabel(row.lossKind), date: textValue(row.exitDate),
    reason: textValue(row.deathCause), disposal: textValue(row.carcassDisposal), buyer: buyerName,
    quarantine: textValue(row.transportCertNo), plate: textValue(row.vehiclePlate), note: textValue(row.note),
    by: textValue(asRecord(row.confirmedBy).label ?? row.confirmedBy, '—'),
    cows,
    cowsTotal: numberValue(row.cattleAmount), deduction: numberValue(row.deductions), payments: paymentRows(row.payments), docs: mapDocuments(documents, root, voucherId),
    history: asRows(row.history).map((item) => textValue(item.text ?? item.type)).filter(Boolean),
  }
  if (isLoss) {
    detail.cow = cows[0]
    detail.sourceHealthCaseId = sourceHealthCaseId ?? undefined
    detail.source = textValue(sourceHealthCase.label)
    detail.reporter = textValue(asRecord(row.reportedBy).label)
    detail.barnShift = textValue(lines[0]?.penCode)
  }
  const draft: ExitDraft | undefined = statusFromBackend(row.status) === 'Nháp' ? {
    type: typeFromBackend(row.exitType, isLoss), date: textValue(row.exitDate), buyerId: buyer.id == null ? '' : String(buyer.id),
    quarantine: textValue(row.transportCertNo), plate: textValue(row.vehiclePlate),
    ...(persistedLossKind ? { lossKind: persistedLossKind as LossKind, deathCause: textValue(row.deathCause), carcassDisposal: textValue(row.carcassDisposal) } : {}),
    note: textValue(row.exitType === 'OTHER' && !isLoss ? row.destination ?? row.note : isLoss ? row.deathCause ?? row.note : row.note),
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
    id: textValue(row.code), backendId: numberValue(row.id), version: nullableNumber(row.version) ?? undefined, date: textValue(row.exitDate),
    type: typeFromBackend(row.exitType, isLoss), who: buyerName || textValue(row.destination ?? row.deathCause),
    sub: textValue(row.note), count: numberValue(row.cattleCount, lines.length), weight: numberValue(row.totalWeightKg),
    total, due, status: statusFromBackend(row.status), detail, draft, reason: textValue(row.closeReason), cancelReason: textValue(row.closeReason), note: textValue(row.note),
  }
}

export const findNamedId = (rows: unknown, name: string): number | null => {
  const wanted = name.trim().toLocaleLowerCase('vi')
  const match = asRows(rows).find((row) => textValue(row.name ?? row.label).trim().toLocaleLowerCase('vi') === wanted)
  return match ? nullableNumber(match.id) : null
}

// Moved from api/backendTransport.ts (refactor phase 2b): each voucher feature owns its payment/voucher envelope mapping.
export const enumPaymentMethod = (value: unknown): 'CASH' | 'BANK_TRANSFER' =>
  value === 'Tiền mặt' || value === 'CASH' ? 'CASH' : 'BANK_TRANSFER'

export const unwrapVoucher = (value: unknown): Record<string, unknown> => {
  const body = asRecord(value)
  return Object.hasOwn(body, 'voucher') ? asRecord(body.voucher) : body
}
