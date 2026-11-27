import { asRecord, asRows, nullableNumber, numberValue, textValue } from '../../../shared/api/parse'
import type { ExitCommandOutcome, ExitDetail, ExitDraft, ExitHistoryEntry, ExitListResult, ExitPayment, ExitReviewItem, ExitStatus, ExitStatusCountKey, ExitType, ExitVoidOutcome, HerdExit, LossKind } from '../types'
import type { ExitChecks, ExitVoidCheck } from './herdExitBackendApi'
import { mapVoucherPayments } from '../../../shared/api/voucherPayments'
import { money } from '../../../shared/lib/format'

// Exit voucher DTO ↔ screen model mapping (ExitVoucherResource), moved out of herdExitBackendApi.ts.
export const LIFE_STAGE_LABELS: Record<string, string> = {
  UNWEANED_CALF: 'Bê chưa cai sữa', WEANED_CALF: 'Bê cai sữa', YOUNG_STOCK: 'Bò tơ', ADULT: 'Bò trưởng thành',
}
const lineWithdrawal = (line: Record<string, unknown>): string =>
  textValue(line.withdrawalUntil ?? line.withdrawalEndDate ?? asRecord(asRecord(line.check).withdrawal).endDate)
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

export const paymentRows = (value: unknown): ExitPayment[] => mapVoucherPayments(value)

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
      // DEF-ST-11: server texts carry ISO dates (MSG-FE13-07); show dd/mm/yyyy.
      ...(typeof message.text === 'string' ? { text: message.text.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, '$3/$2/$1') } : {}),
      ...(typeof message.params === 'object' && message.params !== null ? { params: message.params as Record<string, unknown> } : {}),
    })),
  }))
  return {
    voucherId: numberValue(row.voucherId), code: textValue(row.code), version: nullableNumber(row.version) ?? undefined, exitDate: textValue(row.exitDate), cattle,
    occupancy: asRows(row.occupancy).map((item) => ({ penId: numberValue(item.penId), penCode: textValue(item.penCode), capacity: numberValue(item.capacity), before: numberValue(item.before), after: numberValue(item.after) })),
  }
}

export const mapVoidCheck = (value: unknown): ExitVoidCheck => {
  const row = asRecord(value)
  const message = row.message == null ? undefined : asRecord(row.message)
  return {
    voucherId: numberValue(row.voucherId), code: textValue(row.code), version: nullableNumber(row.version) ?? undefined, voidable: row.voidable === true,
    cattle: asRows(row.cattle).map((cow) => {
      const last = cow.lastPen == null ? null : asRecord(cow.lastPen)
      return {
        cattleId: numberValue(cow.cattleId), cattleCode: textValue(cow.cattleCode), needsPenOverride: cow.needsPenOverride === true,
        lastPen: last === null ? null : { penId: numberValue(last.penId), penCode: textValue(last.penCode), active: last.active === true, freePlaces: numberValue(last.freePlaces) },
      }
    }),
    occupancyAfter: asRows(row.occupancyAfter).map((pen) => ({ penId: numberValue(pen.penId), penCode: textValue(pen.penCode), capacity: numberValue(pen.capacity), before: numberValue(pen.before), after: numberValue(pen.after) })),
    message: message ? { code: textValue(message.code), text: textValue(message.text) } : undefined,
  }
}

const sexLabel = (value: unknown) => value === 'MALE' ? 'Đực' : value === 'FEMALE' ? 'Cái' : '—'
const weightBasis = (basis: unknown, estimated: unknown): 'MEASURED' | 'ESTIMATED' | null =>
  basis === 'ESTIMATED' || basis === 'MEASURED' ? basis : estimated === true ? 'ESTIMATED' : null
const refLabel = (value: unknown) => typeof value === 'string' ? value : textValue(asRecord(value).label)

/** Voucher history keeps the server's time and actor (SCR-76 #7); entries without text fall back to the event type. */
const PAYMENT_METHOD_LABELS: Record<string, string> = { CASH: 'Tiền mặt', BANK_TRANSFER: 'Chuyển khoản' }
const withReason = (text: string, reason: unknown) => {
  const value = textValue(reason)
  return value && value !== 'null' ? `${text} – lý do: ${value}` : text
}

/** HistoryEvent.type + data → Vietnamese line; the backend `text` is an English fallback only for unknown types (SCR-76 #7). */
const historyText = (type: string, data: Record<string, unknown>, fallback: string): string => {
  const amount = () => `${money(numberValue(data.amount))} đ`
  const method = PAYMENT_METHOD_LABELS[textValue(data.method)]
  switch (type) {
    case 'CREATED': return 'Tạo phiếu'
    case 'CONFIRMED': return 'Xác nhận xuất đàn'
    case 'ITEMS_CANCELLED': return `Hủy ${numberValue(data.doses)} mũi tiêm và ${numberValue(data.reminders)} nhắc việc sau ngày xuất`
    case 'COLLECTION_RECORDED': return `Ghi thu ${amount()}${method ? ` (${method})` : ''}`
    case 'COLLECTION_VOIDED': return withReason(`Hủy khoản thu ${amount()}`, data.reason)
    case 'VOIDED': return withReason('Hủy phiếu', data.reason)
    case 'DISMISSED': return withReason('Bác đề xuất', data.reason)
    default: return fallback
  }
}

export const mapHistory = (value: unknown): ExitHistoryEntry[] => asRows(value)
  .map((item) => {
    const type = textValue(item.type)
    const actor = textValue(item.actor)
    return { time: textValue(item.time), type, actor: actor === 'system' ? 'Hệ thống' : actor, text: historyText(type, asRecord(item.data), textValue(item.text ?? item.type)) }
  })
  .filter((item) => item.text)

const BACKEND_TYPES: Record<string, ExitType> = { SALE: 'Bán', CULL: 'Loại thải', DEATH: 'Chết / mất', OTHER: 'Khác' }
const STATUS_KEYS: ExitStatusCountKey[] = ['ALL', 'DRAFT', 'PENDING', 'CONFIRMED', 'VOIDED', 'DISMISSED']

/** `GET /exit-vouchers` ListResult → SCR-41 model; tiles and counts are the server's numbers for the period, never recomputed. */
export const mapListResult = (value: unknown): ExitListResult => {
  const body = asRecord(value)
  const tiles = asRecord(body.tiles)
  const byType = asRecord(tiles.cattleExitedByType)
  const counts = asRecord(body.statusCounts)
  return {
    from: textValue(body.from), to: textValue(body.to),
    tiles: {
      cattleExitedByType: Object.fromEntries(Object.entries(BACKEND_TYPES).map(([key, label]) => [label, numberValue(byType[key])])) as Record<ExitType, number>,
      cattleExited: numberValue(tiles.cattleExited), salesRevenue: numberValue(tiles.salesRevenue), toCollect: numberValue(tiles.toCollect),
      vouchersToCollect: numberValue(tiles.vouchersToCollect), awaitingOwner: numberValue(tiles.awaitingOwner),
    },
    statusCounts: Object.fromEntries(STATUS_KEYS.map((key) => [key, numberValue(counts[key])])) as Record<ExitStatusCountKey, number>,
    vouchers: asRows(body.vouchers).map((row) => mapVoucher(row)),
  }
}

const idList = (value: unknown) => Array.isArray(value) ? value.map((id) => numberValue(id)).filter((id) => id > 0) : []
export const mapReviewList = (value: unknown): ExitReviewItem[] => asRows(value).map((item) => ({
  cattleId: numberValue(item.cattleId), cattleCode: textValue(item.cattleCode),
  cancelledDoseIds: idList(item.cancelledDoseIds), cancelledReminderIds: idList(item.cancelledReminderIds), closedCaseIds: idList(item.closedCaseIds),
  closedPregnancyId: nullableNumber(item.closedPregnancyId), pendingCalfIds: idList(item.pendingCalfIds),
}))

const messageText = (value: unknown) => textValue(asRecord(value).text)
/** VoidResult {voucher, message, reviewList}. */
export const mapVoidResult = (value: unknown): ExitVoidOutcome => {
  const body = asRecord(value)
  return { voucher: mapVoucher(unwrapVoucher(body)), message: messageText(body.message), reviewList: mapReviewList(body.reviewList) }
}
/** ConfirmResult / DismissResult {voucher, message}. */
export const mapCommandResult = (value: unknown): ExitCommandOutcome => {
  const body = asRecord(value)
  return { voucher: mapVoucher(unwrapVoucher(body)), message: messageText(body.message) }
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
    breed: textValue(line.breedName, '—'), sex: sexLabel(line.sex),
    weight: nullableNumber(line.exitWeightKg), estimated: Boolean(line.estimated), weightBasis: weightBasis(line.weightBasis, line.estimated), barn: textValue(line.penCode),
    current: statusFromBackend(row.status) === 'Đã xuất' ? 'EXITED' : textValue(line.herdStatus), amount: numberValue(line.lineAmount), unitPrice: numberValue(line.unitPrice),
  }))
  const isLoss = row.exitType === 'DEATH' || Boolean(row.loss) || row.lossKind === 'DIED' || row.lossKind === 'MISSING'
  const persistedLossKind = row.lossKind === 'MISSING' ? 'MISSING' : isLoss ? 'DIED' : undefined
  const detail: ExitDetail = {
    death: isLoss, ...(persistedLossKind ? { lossKind: persistedLossKind as LossKind } : {}), lossType: lossTypeLabel(row.lossKind), date: textValue(row.exitDate),
    reason: textValue(row.deathCause), disposal: textValue(row.carcassDisposal), buyer: buyerName,
    buyerPhone: textValue(buyer.phone ?? row.buyerPhone), phone: textValue(buyer.phone ?? row.buyerPhone),
    quarantine: textValue(row.transportCertNo), plate: textValue(row.vehiclePlate), note: textValue(row.note),
    destination: textValue(row.destination),
    createdAt: textValue(row.createdAt), confirmedBy: refLabel(row.confirmedBy), confirmedAt: textValue(row.confirmedAt),
    closedBy: refLabel(row.closedBy), closedAt: textValue(row.closedAt),
    cows,
    cowsTotal: numberValue(row.cattleAmount), deduction: numberValue(row.deductions), payments: paymentRows(row.payments), docs: mapDocuments(documents, root, voucherId),
    history: mapHistory(row.history),
  }
  if (isLoss) {
    detail.cow = cows[0]
    detail.sourceHealthCaseId = sourceHealthCaseId ?? undefined
    detail.source = textValue(sourceHealthCase.label)
    detail.sourceHealthCaseCode = textValue(sourceHealthCase.label)
    detail.reporter = textValue(asRecord(row.reportedBy).label)
    detail.barnShift = textValue(lines[0]?.penCode)
  }
  const draft: ExitDraft | undefined = statusFromBackend(row.status) === 'Nháp' ? {
    type: typeFromBackend(row.exitType, isLoss), date: textValue(row.exitDate), buyerId: buyer.id == null ? '' : String(buyer.id),
    quarantine: textValue(row.transportCertNo), plate: textValue(row.vehiclePlate),
    ...(persistedLossKind ? { lossKind: persistedLossKind as LossKind, deathCause: textValue(row.deathCause), carcassDisposal: textValue(row.carcassDisposal) } : {}),
    ...(row.exitType === 'OTHER' && !isLoss ? { destination: textValue(row.destination) } : {}),
    note: textValue(isLoss ? row.deathCause ?? row.note : row.note),
    pricing: row.pricingBasis === 'PER_HEAD' ? 'con' : 'kg', deduction: numberValue(row.deductions), collected: numberValue(row.depositCollected ?? row.amountCollected),
    ...(row.paymentMethod == null ? {} : { method: row.paymentMethod === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản' }),
    ...(textValue(row.collectionDueDate) ? { dueDate: textValue(row.collectionDueDate) } : {}),
    docs: mapDocuments(documents, root, voucherId),
    cows: lines.map((line) => ({
      code: textValue(line.cattleCode), backendId: numberValue(line.cattleId), tag: textValue(line.earTagNumber), breed: textValue(line.breedName), sex: line.sex === 'MALE' ? 'Đực' : 'Cái',
      // DEF-ST-11: labels, never raw enums; the withdrawal end comes from the line check after saving.
      age: textValue(line.ageText ?? line.age), group: HERD_GROUP_LABELS[textValue(line.herdGroup ?? line.group)] ?? textValue(line.herdGroup ?? line.group),
      stage: LIFE_STAGE_LABELS[textValue(line.lifeStage ?? line.stage)] ?? textValue(line.lifeStage ?? line.stage),
      barn: textValue(line.penCode), weight: numberValue(line.exitWeightKg), weightNote: textValue(line.weightNote), unitPrice: numberValue(line.unitPrice), estimated: Boolean(line.estimated),
      ...(lineWithdrawal(line) ? { withdrawalUntil: lineWithdrawal(line) } : {}),
      ...(textValue(line.openCase ?? line.openCaseCode) ? { openCase: textValue(line.openCase ?? line.openCaseCode) } : {}),
    })),
  } : undefined
  return {
    id: textValue(row.code), backendId: numberValue(row.id), version: nullableNumber(row.version) ?? undefined, date: textValue(row.exitDate),
    type: typeFromBackend(row.exitType, isLoss), who: buyerName || textValue(row.destination ?? row.deathCause),
    sub: isLoss ? textValue(sourceHealthCase.label) : textValue(row.transportCertNo), count: numberValue(row.cattleCount, lines.length),
    weightKg: nullableNumber(row.totalWeightKg), weightEstimated: row.weightEstimated === true || numberValue(row.estimatedWeightCount) > 0,
    pens: Array.isArray(row.pens) ? row.pens.map((pen) => textValue(pen)).filter(Boolean) : [...new Set(cows.map((cow) => cow.barn).filter(Boolean))],
    total, collected: nullableNumber(row.amountCollected) ?? undefined, due, status: statusFromBackend(row.status), detail, draft, reason: textValue(row.closeReason), cancelReason: textValue(row.closeReason), note: textValue(row.note),
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

export const optionalPaymentMethod = (value: unknown): 'CASH' | 'BANK_TRANSFER' | null => {
  if (value === 'Tiền mặt' || value === 'CASH') return 'CASH'
  if (value === 'Chuyển khoản' || value === 'BANK_TRANSFER') return 'BANK_TRANSFER'
  return null
}

export const unwrapVoucher = (value: unknown): Record<string, unknown> => {
  const body = asRecord(value)
  return Object.hasOwn(body, 'voucher') ? asRecord(body.voucher) : body
}
