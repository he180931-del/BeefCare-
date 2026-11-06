import { createCollection, createCollectionSchema, type CollectionRow } from '../../../api/client'
import { FEED_STOCK_MOCK } from './feedStockMock'
import { FEED_RECEIPT_DEMO_EXTRAS, FEED_RECEIPT_MOCK } from './feedReceiptMock'
import { FEED_CATALOGUE_MOCK } from './feedCatalogueMock'
import { buildFeedFeedingHistory, buildFeedFeedingSeed } from './feedFeedingMock'
import { buildMovementSeed } from './feedMovementSeed'
import { daysFromToday, localNowIso } from './feedDemoDates'
import { deriveFeedStockStatus } from '../domain/feedStockStatus'
import type { FeedMovement } from '../types/feedMovement'
import { FEED_RECEIPT_DEMO_SUPPLIERS } from './feedReceiptDemoSuppliers'
import { FEED_DEMO_PENS as FEED_RATION_DEMO_PENS } from './feedPenMock'
import type { FeedGroup, FeedStockRow, FeedStockStatus } from '../types'
import type { FeedReceiptDemoRecord, FeedReceiptDraftInput, FeedReceiptDemoStore } from '../types/feedReceiptDemo'
import type { FeedStockAdjustmentDemoRecord, FeedStockAdjustmentDemoStore, FeedStockAdjustmentDraftInput } from '../types/feedStockAdjustment'
import type { FeedFeedingDemoStore, FeedFeedingDraftInput, FeedFeedingLine, FeedFeedingRecord, FeedFeedingCorrectionInput, FeedFeedingRange } from '../types/feedFeeding'
import type { FeedCatalogueDemoStore, FeedCatalogueInput, FeedCatalogueItem, FeedSupplier, FeedSupplierInput } from '../types/feedCatalogue'

type FeedReceiptDemoState = {
  id: string
  receipts: FeedReceiptDemoRecord[]
  adjustments: FeedStockAdjustmentDemoRecord[]
  feedings: FeedFeedingRecord[]
  movements: FeedMovement[]
  stocks: Array<FeedStockRow & CollectionRow>
  catalogue: FeedCatalogueItem[]
  suppliers: FeedSupplier[]
  [key: string]: unknown
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const isText = (value: unknown): value is string => typeof value === 'string'
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const feedGroups: readonly FeedGroup[] = ['GREEN_ROUGHAGE', 'DRY_ROUGHAGE', 'CONCENTRATE', 'TMR', 'MINERAL_ADDITIVE', 'CALF_FEED']
const feedStockStatuses: readonly FeedStockStatus[] = ['OUT_OF_STOCK', 'LOW', 'SUFFICIENT']
const isFeedGroup = (value: unknown): value is FeedGroup => feedGroups.some((group) => group === value)
const isFeedStockStatus = (value: unknown): value is FeedStockStatus => feedStockStatuses.some((status) => status === value)
function parseFeedGroup(value: unknown): FeedGroup {
  if (!isFeedGroup(value)) throw new Error('Invalid demo feed group')
  return value
}

function parseDemoReceiptLine(value: unknown): FeedReceiptDemoRecord['lines'][number] {
  if (!isRecord(value) || !isNumber(value.id) || !isNumber(value.feedItemId) || !isText(value.feedCode)
    || !isText(value.feedName) || (value.lotNumber !== null && !isText(value.lotNumber))
    || (value.expiryDate !== null && !isText(value.expiryDate)) || !isNumber(value.quantityPurchase)
    || (value.purchaseUnit !== null && !isText(value.purchaseUnit)) || !isNumber(value.kgReceived)
    || !isNumber(value.unitPrice) || !isNumber(value.lineAmount) || !isNumber(value.kgPerPurchaseUnit)) {
    throw new Error('Invalid demo feed receipt line')
  }
  return {
    id: value.id,
    feedItemId: value.feedItemId,
    feedCode: value.feedCode,
    feedName: value.feedName,
    lotNumber: value.lotNumber,
    expiryDate: value.expiryDate,
    quantityPurchase: value.quantityPurchase,
    purchaseUnit: value.purchaseUnit,
    kgReceived: value.kgReceived,
    unitPrice: value.unitPrice,
    lineAmount: value.lineAmount,
    kgPerPurchaseUnit: value.kgPerPurchaseUnit,
  }
}

function parseDemoReceipt(value: unknown): FeedReceiptDemoRecord {
  if (!isRecord(value) || !isNumber(value.id) || !isText(value.code) || !isText(value.receiptDate)
    || !isNumber(value.supplierId) || !isText(value.supplierName) || !isText(value.status)
    || !isNumber(value.goodsAmount) || !isNumber(value.transportFee) || !isNumber(value.totalPayable)
    || !isNumber(value.version) || !isText(value.invoiceNumber) || !isText(value.receivedBy)
    || !isText(value.storageLocation) || !isText(value.note) || !isNumber(value.amountPaid)
    || (value.paymentMethod !== null && value.paymentMethod !== 'CASH' && value.paymentMethod !== 'BANK_TRANSFER')
    || !isText(value.paymentDate) || !isText(value.balanceDueDate) || !Array.isArray(value.lines)) {
    throw new Error('Invalid demo feed receipt')
  }
  return {
    ...value,
    id: value.id,
    code: value.code,
    receiptDate: value.receiptDate,
    supplierId: value.supplierId,
    supplierName: value.supplierName,
    status: value.status,
    goodsAmount: value.goodsAmount,
    transportFee: value.transportFee,
    totalPayable: value.totalPayable,
    version: value.version,
    invoiceNumber: value.invoiceNumber,
    receivedBy: value.receivedBy,
    storageLocation: value.storageLocation,
    note: value.note,
    amountPaid: value.amountPaid,
    paymentMethod: value.paymentMethod,
    paymentDate: value.paymentDate,
    balanceDueDate: value.balanceDueDate,
    lines: value.lines.map(parseDemoReceiptLine),
  }
}

function parseDemoStock(value: unknown): FeedStockRow & CollectionRow {
  if (!isRecord(value) || !isNumber(value.feedItemId) || !isText(value.code) || !isText(value.name)
    || !isFeedGroup(value.group) || !isNumber(value.onHandKg)
    || (value.minimumStockKg !== null && !isNumber(value.minimumStockKg))
    || !isNumber(value.averageDailyUseKg)
    || (value.daysOfCover !== null && !isNumber(value.daysOfCover))
    || !isNumber(value.stockValue) || !isFeedStockStatus(value.status) || !isNumber(value.version)
    || (value.nearestLotNumber !== null && !isText(value.nearestLotNumber))
    || (value.nearestLotExpiryDate !== null && !isText(value.nearestLotExpiryDate))
    || (value.available !== undefined && typeof value.available !== 'boolean')
    || (value.purchaseUnit !== undefined && !isText(value.purchaseUnit))
    || (value.kgPerPurchaseUnit !== undefined && !isNumber(value.kgPerPurchaseUnit))) {
    throw new Error('Invalid demo feed stock')
  }
  return {
    ...value,
    feedItemId: value.feedItemId,
    code: value.code,
    name: value.name,
    group: value.group,
    onHandKg: value.onHandKg,
    minimumStockKg: value.minimumStockKg,
    averageDailyUseKg: value.averageDailyUseKg,
    daysOfCover: value.daysOfCover,
    stockValue: value.stockValue,
    status: value.status,
    version: value.version,
    nearestLotNumber: value.nearestLotNumber,
    nearestLotExpiryDate: value.nearestLotExpiryDate,
    ...(typeof value.available === 'boolean' ? { available: value.available } : {}),
    ...(isText(value.purchaseUnit) ? { purchaseUnit: value.purchaseUnit } : {}),
    ...(isNumber(value.kgPerPurchaseUnit) ? { kgPerPurchaseUnit: value.kgPerPurchaseUnit } : {}),
  }
}

function parseCatalogueItem(value: unknown): FeedCatalogueItem {
  if (!isRecord(value) || !isNumber(value.id) || !isText(value.code) || !isText(value.name)
    || !isFeedGroup(value.group) || !isText(value.stockUnit) || !isText(value.purchaseUnit)
    || !isNumber(value.kgPerPurchaseUnit) || !isNumber(value.minimumStockKg)
    || !isText(value.nutritionNote) || typeof value.available !== 'boolean' || !isNumber(value.version)) {
    throw new Error('Invalid demo feed catalogue item')
  }
  return {
    ...value,
    id: value.id,
    code: value.code,
    name: value.name,
    group: value.group,
    stockUnit: value.stockUnit,
    purchaseUnit: value.purchaseUnit,
    kgPerPurchaseUnit: value.kgPerPurchaseUnit,
    minimumStockKg: value.minimumStockKg,
    nutritionNote: value.nutritionNote,
    available: value.available,
    version: value.version,
    ...(isNumber(value.averageUnitCost) ? { averageUnitCost: value.averageUnitCost } : {}),
  }
}

function parseSupplier(value: unknown): FeedSupplier {
  if (!isRecord(value) || !isNumber(value.id) || !isText(value.name) || !isText(value.phone)
    || !isText(value.area) || !isText(value.note) || typeof value.active !== 'boolean' || !isNumber(value.version)) {
    throw new Error('Invalid demo feed supplier')
  }
  return {
    ...value,
    id: value.id,
    name: value.name,
    phone: value.phone,
    area: value.area,
    note: value.note,
    active: value.active,
    version: value.version,
  }
}

function parseDemoAdjustmentLine(value: unknown): FeedStockAdjustmentDemoRecord['lines'][number] {
  if (!isRecord(value) || !isNumber(value.feedItemId) || !isText(value.feedCode) || !isText(value.feedName)
    || !isNumber(value.systemKg) || !isNumber(value.countedKg) || !isNumber(value.differenceKg)
    || (value.reason !== null && !isText(value.reason))
    || (value.unitCost !== null && !isNumber(value.unitCost))
    || (value.differenceValue !== null && !isNumber(value.differenceValue))) {
    throw new Error('Invalid demo feed stock adjustment line')
  }
  return {
    feedItemId: value.feedItemId,
    feedCode: value.feedCode,
    feedName: value.feedName,
    systemKg: value.systemKg,
    countedKg: value.countedKg,
    differenceKg: value.differenceKg,
    reason: value.reason,
    unitCost: value.unitCost,
    differenceValue: value.differenceValue,
  }
}

function parseDemoAdjustment(value: unknown): FeedStockAdjustmentDemoRecord {
  if (!isRecord(value) || !isNumber(value.id) || !isText(value.code) || !isText(value.countDate)
    || !isText(value.adjustmentType) || !isText(value.countedBy) || !isText(value.status)
    || !isNumber(value.totalDifferenceKg) || (value.totalValue !== null && !isNumber(value.totalValue))
    || (value.postedAt !== null && !isText(value.postedAt)) || !isNumber(value.version) || !Array.isArray(value.lines)) {
    throw new Error('Invalid demo feed stock adjustment')
  }
  return {
    ...value,
    id: value.id,
    code: value.code,
    countDate: value.countDate,
    adjustmentType: value.adjustmentType,
    countedBy: value.countedBy,
    status: value.status,
    totalDifferenceKg: value.totalDifferenceKg,
    totalValue: value.totalValue,
    postedAt: value.postedAt,
    version: value.version,
    lines: value.lines.map(parseDemoAdjustmentLine),
  }
}

function parseFeedingLine(value: unknown): FeedFeedingLine {
  if (!isRecord(value) || !isNumber(value.feedItemId) || !isText(value.feedCode)
    || (value.feedName !== null && !isText(value.feedName)) || !isNumber(value.plannedKg) || !isNumber(value.actualKg)
    || (value.inRation !== null && typeof value.inRation !== 'boolean') || (value.unitCost !== null && !isNumber(value.unitCost))
    || (value.totalCost !== null && !isNumber(value.totalCost))) {
    throw new Error('Invalid demo feeding line')
  }
  return {
    feedItemId: value.feedItemId,
    feedCode: value.feedCode,
    feedName: value.feedName,
    plannedKg: value.plannedKg,
    actualKg: value.actualKg,
    inRation: value.inRation,
    unitCost: value.unitCost,
    totalCost: value.totalCost,
  }
}

function parseFeedingRecord(value: unknown): FeedFeedingRecord {
  if (!isRecord(value) || !isNumber(value.id) || !isNumber(value.penId)
    || (value.penCode !== null && !isText(value.penCode)) || (value.penName !== null && !isText(value.penName))
    || !isText(value.feedingDate) || !isNumber(value.sessionNo) || (value.time !== null && !isText(value.time))
    || !isNumber(value.headCount) || (value.rationCode !== null && !isText(value.rationCode))
    || (value.rationVersion !== null && !isNumber(value.rationVersion))
    || (value.rationVersionId !== undefined && value.rationVersionId !== null && !isNumber(value.rationVersionId))
    || !isText(value.status) || !isNumber(value.version)
    || (value.fedBy !== null && !isText(value.fedBy)) || (value.recordedAt !== null && !isText(value.recordedAt))
    || (value.leftoverKg !== null && !isNumber(value.leftoverKg)) || (value.note !== null && !isText(value.note))
    || !isNumber(value.plannedTotalKg) || !isNumber(value.actualTotalKg) || !Array.isArray(value.lines) || !Array.isArray(value.revisions)) {
    throw new Error('Invalid demo feeding record')
  }
  const lines = value.lines.map(parseFeedingLine)
  const revisions: FeedFeedingRecord['revisions'] = []
  for (const revision of value.revisions) {
    if (!isRecord(revision) || (revision.action !== 'CORRECTED' && revision.action !== 'VOIDED')
      || !isText(revision.reason) || !isText(revision.changedAt) || !Array.isArray(revision.lines)) {
      throw new Error('Invalid demo feeding revision')
    }
    revisions.push({
      action: revision.action,
      reason: revision.reason,
      changedAt: revision.changedAt,
      lines: revision.lines.map(parseFeedingLine),
    })
  }
  return {
    ...value,
    id: value.id,
    penId: value.penId,
    penCode: value.penCode,
    penName: value.penName,
    feedingDate: value.feedingDate,
    sessionNo: value.sessionNo,
    time: value.time,
    headCount: value.headCount,
    ...(isNumber(value.rationVersionId) ? { rationVersionId: value.rationVersionId } : {}),
    rationCode: value.rationCode,
    rationVersion: value.rationVersion,
    status: value.status,
    version: value.version,
    fedBy: value.fedBy,
    recordedAt: value.recordedAt,
    leftoverKg: value.leftoverKg,
    note: value.note,
    plannedTotalKg: value.plannedTotalKg,
    actualTotalKg: value.actualTotalKg,
    lines,
    revisions,
  }
}

function parseMovement(value: unknown): FeedMovement {
  if (!isRecord(value) || !isNumber(value.id) || !isNumber(value.feedItemId) || !isText(value.feedCode) || !isText(value.movementType)
    || !isNumber(value.quantityKg) || (value.unitCost !== null && !isNumber(value.unitCost)) || !isNumber(value.balanceAfterKg)
    || !isText(value.sourceType) || (value.sourceId !== null && !isNumber(value.sourceId)) || !isText(value.occurredAt)
    || (value.sourceCode !== undefined && value.sourceCode !== null && !isText(value.sourceCode))) {
    throw new Error('Invalid demo feed movement')
  }
  return {
    id: value.id, feedItemId: value.feedItemId, feedCode: value.feedCode, movementType: value.movementType, quantityKg: value.quantityKg,
    unitCost: value.unitCost, balanceAfterKg: value.balanceAfterKg, sourceType: value.sourceType, sourceId: value.sourceId,
    sourceCode: isText(value.sourceCode) ? value.sourceCode : null, occurredAt: value.occurredAt,
  }
}

function parseDemoState(value: unknown): FeedReceiptDemoState {
  if (!isRecord(value) || value.id !== 'feed-receipts' || !Array.isArray(value.receipts) || !Array.isArray(value.stocks)
    || (value.adjustments !== undefined && !Array.isArray(value.adjustments))
    || (value.feedings !== undefined && !Array.isArray(value.feedings))) {
    throw new Error('Invalid demo feed management state')
  }
  const stocks = value.stocks.map(parseDemoStock)
  // Add fields introduced after early demo saves without dropping user-created mock data.
  const catalogue = value.catalogue === undefined
    ? stocks.map((stock) => ({
      id: stock.feedItemId,
      code: stock.code,
      name: stock.name,
      group: stock.group,
      stockUnit: 'kg',
      purchaseUnit: stock.purchaseUnit ?? 'kg',
      kgPerPurchaseUnit: stock.kgPerPurchaseUnit ?? 1,
      minimumStockKg: stock.minimumStockKg ?? 0,
      nutritionNote: '',
      available: stock.available !== false,
      version: stock.version,
    }))
    : Array.isArray(value.catalogue) ? value.catalogue.map(parseCatalogueItem) : (() => { throw new Error('Invalid demo feed catalogue') })()
  const suppliers = value.suppliers === undefined
    ? FEED_RECEIPT_DEMO_SUPPLIERS.map((supplier) => ({
      ...supplier, phone: '', area: '', note: '', active: true, version: 0,
    }))
    : Array.isArray(value.suppliers) ? value.suppliers.map(parseSupplier) : (() => { throw new Error('Invalid demo feed suppliers') })()
  const byId = new Map(catalogue.map((item) => [item.id, item]))
  return {
    ...value,
    id: 'feed-receipts',
    receipts: value.receipts.map(parseDemoReceipt),
    adjustments: (value.adjustments ?? []).map(parseDemoAdjustment),
    feedings: (value.feedings ?? []).map(parseFeedingRecord),
    movements: (Array.isArray(value.movements) ? value.movements : []).map(parseMovement),
    catalogue,
    suppliers,
    stocks: stocks.map((stock) => {
      const item = byId.get(stock.feedItemId)
      return item ? {
        ...stock,
        code: item.code,
        name: item.name,
        group: parseFeedGroup(item.group),
        minimumStockKg: item.minimumStockKg,
        available: item.available,
        purchaseUnit: item.purchaseUnit,
        kgPerPurchaseUnit: item.kgPerPurchaseUnit,
      } : stock
    }),
  }
}

const initialReceipts: FeedReceiptDemoRecord[] = FEED_RECEIPT_MOCK.map((row) => {
  const extra = FEED_RECEIPT_DEMO_EXTRAS[row.id]
  const method = extra?.paymentMethod ?? null
  return {
    ...row,
    invoiceNumber: extra?.invoiceNumber ?? '',
    receivedBy: extra?.receivedBy ?? '',
    storageLocation: extra?.storageLocation ?? '',
    note: extra?.note ?? '',
    amountPaid: extra?.amountPaid ?? 0,
    paymentMethod: method,
    paymentDate: method ? row.receiptDate : '',
    balanceDueDate: extra?.balanceDueDays != null ? daysFromToday(extra.balanceDueDays) : '',
    ...(extra?.voidReason ? { voidReason: extra.voidReason } : {}),
    lines: row.lines.map((line) => ({
      ...line,
      kgPerPurchaseUnit: line.quantityPurchase > 0 ? line.kgReceived / line.quantityPurchase : 1,
    })),
  }
})

const initialCatalogue: FeedCatalogueItem[] = FEED_CATALOGUE_MOCK.map(({ unitCost, ...item }) => ({ ...item, averageUnitCost: unitCost }))
const initialSuppliers: FeedSupplier[] = FEED_RECEIPT_DEMO_SUPPLIERS.map((supplier) => ({
  ...supplier, note: '', active: true, version: 0,
}))
const initialStocks = FEED_STOCK_MOCK.map((row) => {
  const item = FEED_CATALOGUE_MOCK.find((entry) => entry.id === row.feedItemId)
  return { ...row, available: true, purchaseUnit: item?.purchaseUnit ?? 'kg', kgPerPurchaseUnit: item?.kgPerPurchaseUnit ?? 1 }
}) as Array<FeedStockRow & CollectionRow>
const todayFeedings = buildFeedFeedingSeed()
const initialFeedings = [...todayFeedings, ...buildFeedFeedingHistory()]

const stateSchema = createCollectionSchema<FeedReceiptDemoState, 'id'>(
  'feed-receipt-state-demo-v2',
  'id',
  parseDemoState,
)
const states = createCollection('feedReceiptStateDemoV2', [{
  id: 'feed-receipts',
  receipts: initialReceipts,
  adjustments: [],
  feedings: initialFeedings,
  movements: buildMovementSeed(initialStocks, initialReceipts, todayFeedings),
  stocks: initialStocks.map((row) => ({ ...row })),
  catalogue: initialCatalogue.map((row) => ({ ...row })),
  suppliers: initialSuppliers.map((row) => ({ ...row })),
}], { schema: stateSchema })

const nextDemoId = (rows: readonly FeedReceiptDemoRecord[]) => Math.max(0, ...rows.map((row) => row.id)) + 1

function nextReceiptCode(rows: readonly FeedReceiptDemoRecord[]) {
  const year = new Date().getFullYear()
  const prefix = `PNK-${year}-`
  const max = Math.max(0, ...rows
    .filter((row) => row.code.startsWith(prefix))
    .map((row) => Number(row.code.slice(prefix.length)) || 0))
  return `${prefix}${String(max + 1).padStart(4, '0')}`
}

function nextAdjustmentCode(rows: readonly FeedStockAdjustmentDemoRecord[]) {
  const year = new Date().getFullYear()
  const prefix = `ĐCK-${year}-`
  const max = Math.max(0, ...rows
    .filter((row) => row.code.startsWith(prefix))
    .map((row) => Number(row.code.slice(prefix.length)) || 0))
  return `${prefix}${String(max + 1).padStart(4, '0')}`
}

function localToday() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function isIsoCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00`)
  return !Number.isNaN(date.getTime())
    && `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` === value
}

function datePlusDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`)
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function validateDraftInput(input: FeedReceiptDraftInput, state: FeedReceiptDemoState, existing?: FeedReceiptDemoRecord) {
  if (!isIsoCalendarDate(input.receiptDate)) throw new Error('Ngày nhập không hợp lệ.')
  if (input.receiptDate > localToday()) throw new Error('Ngày nhập không được ở tương lai.')
  const supplier = state.suppliers.find((item) => item.id === input.supplierId && (item.active || item.id === existing?.supplierId))
  if (!supplier || supplier.name !== input.supplierName) throw new Error('Chọn nhà cung cấp.')
  if (input.invoiceNumber.length > 50 || input.receivedBy.length > 100 || input.storageLocation.length > 100 || input.note.length > 1000) {
    throw new Error('Một số thông tin đã vượt quá độ dài cho phép.')
  }
  if (!Number.isInteger(input.transportFee) || input.transportFee < 0) throw new Error('Phí vận chuyển phải là số nguyên không âm.')
  if (!Number.isInteger(input.amountPaid) || input.amountPaid < 0) throw new Error('Số tiền đã trả phải là số nguyên không âm.')
  const goodsAmount = input.lines.reduce((total, line) => total + Math.round(line.quantityPurchase * line.unitPrice), 0)
  if (input.amountPaid > goodsAmount + input.transportFee) throw new Error('Số tiền đã trả không được vượt tổng phải trả.')
  if (input.amountPaid > 0 && (!input.paymentMethod || !input.paymentDate)) throw new Error('Chọn hình thức và ngày thanh toán.')
  if (input.paymentDate && !isIsoCalendarDate(input.paymentDate)) throw new Error('Ngày thanh toán không hợp lệ.')
  if (input.balanceDueDate && !isIsoCalendarDate(input.balanceDueDate)) throw new Error('Hạn thanh toán không hợp lệ.')
  if (!input.lines.length) throw new Error('Thêm ít nhất một dòng thức ăn.')
  for (const [index, line] of input.lines.entries()) {
    if (!Number.isInteger(line.feedItemId) || line.feedItemId <= 0) throw new Error(`Chọn thức ăn cho dòng ${index + 1}.`)
    if (!Number.isFinite(line.quantityPurchase) || line.quantityPurchase <= 0) throw new Error(`Nhập số lượng lớn hơn 0 cho dòng ${index + 1}.`)
    if (!Number.isInteger(line.unitPrice) || line.unitPrice < 0) throw new Error(`Đơn giá dòng ${index + 1} phải là số nguyên không âm.`)
    if (line.lotNumber && line.lotNumber.length > 30) throw new Error(`Số lô dòng ${index + 1} tối đa 30 ký tự.`)
    if (line.expiryDate && (!isIsoCalendarDate(line.expiryDate) || line.expiryDate <= input.receiptDate)) throw new Error(`Hạn sử dụng dòng ${index + 1} phải sau ngày nhập.`)
    if (!Number.isFinite(line.kgPerPurchaseUnit) || line.kgPerPurchaseUnit <= 0) throw new Error(`Quy đổi dòng ${index + 1} không hợp lệ.`)
  }
}

function validateAdjustmentInput(input: FeedStockAdjustmentDraftInput, state: FeedReceiptDemoState) {
  if (!isIsoCalendarDate(input.countDate)) throw new Error('Ngày kiểm kê không hợp lệ.')
  if (input.countDate > localToday()) throw new Error('Ngày kiểm kê không được ở tương lai.')
  if (!['PERIODIC_COUNT', 'LOSS', 'SPOILAGE', 'OTHER'].includes(input.adjustmentType)) throw new Error('Chọn loại kiểm kê hợp lệ.')
  if (input.countedBy.length > 200) throw new Error('Tên người kiểm kê tối đa 200 ký tự.')
  if (!input.lines.length) throw new Error('Thêm ít nhất một mặt hàng để kiểm kê.')
  const seen = new Set<number>()
  for (const [index, line] of input.lines.entries()) {
    if (!Number.isInteger(line.feedItemId) || line.feedItemId <= 0 || seen.has(line.feedItemId)) {
      throw new Error('Mỗi mặt hàng chỉ được xuất hiện một lần.')
    }
    seen.add(line.feedItemId)
    const stock = state.stocks.find((row) => row.feedItemId === line.feedItemId)
    if (!stock) throw new Error(`Không tìm thấy thức ăn dòng ${index + 1}.`)
    if (!Number.isFinite(line.countedKg) || line.countedKg < 0) throw new Error(`Số đếm của ${stock.code} phải là số không âm.`)
    if (!Number.isFinite(line.countedKg * 1000) || Math.abs(line.countedKg * 1000 - Math.round(line.countedKg * 1000)) > 1e-7) {
      throw new Error(`Số đếm của ${stock.code} tối đa 3 chữ số thập phân.`)
    }
    if (Math.abs(line.countedKg - stock.onHandKg) > 0.0005 && !line.reason.trim()) throw new Error(`Nhập lý do chênh lệch cho ${stock.code}.`)
  }
}

function adjustmentLines(input: FeedStockAdjustmentDraftInput, state: FeedReceiptDemoState) {
  return input.lines.map((line) => {
    const stock = state.stocks.find((row) => row.feedItemId === line.feedItemId)!
    const systemKg = stock.onHandKg
    const countedKg = Math.round(line.countedKg * 1000) / 1000
    const differenceKg = Math.round((countedKg - systemKg) * 1000) / 1000
    const unitCost = stock.onHandKg > 0 ? stock.stockValue / stock.onHandKg : null
    const differenceValue = differenceKg === 0 ? 0 : unitCost === null ? null : Math.round(differenceKg * unitCost)
    return {
      feedItemId: stock.feedItemId,
      feedCode: stock.code,
      feedName: stock.name,
      systemKg,
      countedKg,
      differenceKg,
      reason: line.reason.trim() || null,
      unitCost,
      differenceValue,
    }
  })
}

function adjustmentTotals(lines: FeedStockAdjustmentDemoRecord['lines']) {
  const totalDifferenceKg = Math.round(lines.reduce((sum, line) => sum + line.differenceKg, 0) * 1000) / 1000
  const totalValue = lines.every((line) => line.differenceKg === 0 || line.differenceValue !== null)
    ? lines.reduce((sum, line) => sum + (line.differenceValue ?? 0), 0)
    : null
  return { totalDifferenceKg, totalValue }
}

async function saveAdjustmentDraft(input: FeedStockAdjustmentDraftInput): Promise<FeedStockAdjustmentDemoRecord> {
  return serializeMutation(async () => {
    const state = await states.get('feed-receipts')
    validateAdjustmentInput(input, state)
    const existing = input.id === undefined ? undefined : state.adjustments.find((row) => row.id === input.id)
    if (input.id !== undefined && !existing) throw new Error('Không tìm thấy phiếu kiểm kê.')
    if (existing && existing.status !== 'DRAFT') throw new Error('Chỉ có thể sửa phiếu nháp.')
    const id = existing?.id ?? Math.max(0, ...state.adjustments.map((row) => row.id)) + 1
    const lines = adjustmentLines(input, state)
    const next: FeedStockAdjustmentDemoRecord = {
      id,
      code: existing?.code ?? nextAdjustmentCode(state.adjustments),
      countDate: input.countDate,
      adjustmentType: input.adjustmentType,
      countedBy: input.countedBy.trim(),
      status: 'DRAFT',
      ...adjustmentTotals(lines),
      postedAt: null,
      version: existing ? existing.version + 1 : 0,
      lines,
    }
    const adjustments = existing
      ? state.adjustments.map((row) => row.id === id ? next : row)
      : [next, ...state.adjustments]
    await states.update(state.id, { adjustments })
    return next
  })
}

async function postAdjustment(id: number): Promise<FeedStockAdjustmentDemoRecord> {
  return serializeMutation(async () => {
    const state = await states.get('feed-receipts')
    const current = state.adjustments.find((row) => row.id === id)
    if (!current || current.status !== 'DRAFT') throw new Error('Chỉ có thể ghi nhận phiếu nháp.')
    for (const line of current.lines) {
      if (line.differenceKg !== 0 && !line.reason?.trim()) throw new Error(`Nhập lý do chênh lệch cho ${line.feedCode}.`)
      const stock = state.stocks.find((row) => row.feedItemId === line.feedItemId)
      if (!stock || stock.onHandKg + line.differenceKg < -0.0005) throw new Error(`Tồn kho của ${line.feedCode} không đủ để ghi nhận điều chỉnh.`)
    }

    const changedLines = new Map(current.lines.filter((line) => line.differenceKg !== 0).map((line) => [line.feedItemId, line]))
    const stocks = state.stocks.map((stock) => {
      const line = changedLines.get(stock.feedItemId)
      if (!line) return stock
      const onHandKg = Math.round((stock.onHandKg + line.differenceKg) * 1000) / 1000
      const status = feedStockStatus(onHandKg, stock.minimumStockKg, stock.averageDailyUseKg)
      const daysOfCover = stock.averageDailyUseKg === 0
        ? null
        : Math.round((onHandKg / stock.averageDailyUseKg) * 10) / 10
      return {
        ...stock,
        onHandKg,
        stockValue: line.differenceValue === null ? stock.stockValue : Math.max(0, stock.stockValue + line.differenceValue),
        status,
        daysOfCover,
        version: stock.version + 1,
      }
    })
    const posted: FeedStockAdjustmentDemoRecord = {
      ...current,
      status: 'POSTED',
      postedAt: localNowIso(),
      version: current.version + 1,
    }
    const adjustments = state.adjustments.map((row) => row.id === id ? posted : row)
    const movements = appendMovements(state, [...changedLines.values()].map((line) => ({
      feedItemId: line.feedItemId, movementType: 'ADJUSTMENT', quantityKg: line.differenceKg, unitCost: line.unitCost,
      sourceType: 'ADJUSTMENT', sourceId: current.id, sourceCode: current.code,
    })), stocks)
    await states.update(state.id, { adjustments, stocks, movements })
    return posted
  })
}

type MovementEntry = Pick<FeedMovement, 'feedItemId' | 'movementType' | 'quantityKg' | 'unitCost' | 'sourceType' | 'sourceId' | 'sourceCode'>
/** One movement per feed and operation, with the balance read from the updated stock rows. */
function appendMovements(state: FeedReceiptDemoState, entries: readonly MovementEntry[], stocks: readonly FeedStockRow[]): FeedMovement[] {
  let id = Math.max(0, ...state.movements.map((row) => row.id))
  const occurredAt = localNowIso()
  const added = entries.filter((entry) => entry.quantityKg !== 0).flatMap((entry) => {
    const stock = stocks.find((row) => row.feedItemId === entry.feedItemId)
    if (!stock) return []
    id += 1
    return [{ ...entry, id, feedCode: stock.code, balanceAfterKg: stock.onHandKg, occurredAt }]
  })
  return [...state.movements, ...added]
}

let mutationQueue = Promise.resolve()
function serializeMutation<T>(operation: () => Promise<T>): Promise<T> {
  const current = mutationQueue.then(operation, operation)
  mutationQueue = current.then(() => undefined, () => undefined)
  return current
}

const roundKg = (value: number) => Math.round(value * 1000) / 1000
const roundMoney = (value: number) => Math.round(value)
const isOneDecimal = (value: number) => Math.abs(value * 10 - Math.round(value * 10)) < 0.000001
const feedStockStatus = deriveFeedStockStatus

function feedHasMovements(state: FeedReceiptDemoState, id: number) {
  const stock = state.stocks.find((row) => row.feedItemId === id)
  return Boolean(stock && stock.onHandKg > 0)
    || state.receipts.some((row) => row.status === 'POSTED' && row.lines.some((line) => line.feedItemId === id))
    || state.adjustments.some((row) => row.status === 'POSTED' && row.lines.some((line) => line.feedItemId === id))
    || state.feedings.some((row) => row.lines.some((line) => line.feedItemId === id))
}

function validateFeedInput(input: FeedCatalogueInput, state: FeedReceiptDemoState) {
  const code = input.code.trim().toUpperCase()
  const name = input.name.trim()
  if (!/^TA-\d{2,}$/.test(code)) throw new Error('Mã thức ăn theo dạng TA-nn.')
  if (state.catalogue.some((item) => item.code.toUpperCase() === code && item.id !== input.id)) throw new Error('Mã thức ăn đã tồn tại.')
  if (!name) throw new Error('Nhập tên thức ăn.')
  if (name.length > 100) throw new Error('Tên thức ăn tối đa 100 ký tự.')
  if (!isFeedGroup(input.group)) throw new Error('Chọn nhóm thức ăn hợp lệ.')
  if (!input.purchaseUnit.trim() || input.purchaseUnit.trim().length > 30) throw new Error('Đơn vị nhập tối đa 30 ký tự và không được để trống.')
  if (!Number.isFinite(input.kgPerPurchaseUnit) || input.kgPerPurchaseUnit <= 0) throw new Error('Quy đổi phải lớn hơn 0.')
  if (!Number.isFinite(input.minimumStockKg) || input.minimumStockKg < 0) throw new Error('Mức tồn tối thiểu phải là số không âm.')
  if (input.nutritionNote.length > 500) throw new Error('Ghi chú dinh dưỡng tối đa 500 ký tự.')
  if (input.id !== undefined) {
    const current = state.catalogue.find((item) => item.id === input.id)
    if (!current) throw new Error('Không tìm thấy thức ăn.')
    if (feedHasMovements(state, input.id) && current.code.toUpperCase() !== code) {
      throw new Error('Mặt hàng đã có phát sinh nên không thể đổi mã.')
    }
  }
}

async function saveCatalogueFeed(input: FeedCatalogueInput): Promise<FeedCatalogueItem> {
  return serializeMutation(async () => {
    const state = await states.get('feed-receipts')
    validateFeedInput(input, state)
    const existing = input.id === undefined ? undefined : state.catalogue.find((item) => item.id === input.id)
    const id = existing?.id ?? Math.max(0, ...state.catalogue.map((item) => item.id)) + 1
    const next: FeedCatalogueItem = {
      id,
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      group: input.group,
      stockUnit: 'kg',
      purchaseUnit: input.purchaseUnit.trim(),
      kgPerPurchaseUnit: input.kgPerPurchaseUnit,
      minimumStockKg: input.minimumStockKg,
      nutritionNote: input.nutritionNote.trim(),
      available: input.available,
      version: existing ? existing.version + 1 : 0,
      ...(existing?.averageUnitCost != null ? { averageUnitCost: existing.averageUnitCost } : {}),
    }
    const stockIndex = state.stocks.findIndex((row) => row.feedItemId === id)
    const previous = stockIndex >= 0 ? state.stocks[stockIndex] : null
    const nextStock: FeedStockRow & CollectionRow = {
      ...(previous ?? {
        feedItemId: id,
        onHandKg: 0,
        averageDailyUseKg: 0,
        daysOfCover: null,
        stockValue: 0,
        nearestLotNumber: null,
        nearestLotExpiryDate: null,
      }),
      feedItemId: id,
      code: next.code,
      name: next.name,
      group: parseFeedGroup(next.group),
      minimumStockKg: next.minimumStockKg,
      status: feedStockStatus(previous?.onHandKg ?? 0, next.minimumStockKg, previous?.averageDailyUseKg ?? 0),
      version: previous ? previous.version + 1 : 0,
      available: next.available,
      purchaseUnit: next.purchaseUnit,
      kgPerPurchaseUnit: next.kgPerPurchaseUnit,
    }
    const stocks = stockIndex < 0
      ? [...state.stocks, nextStock]
      : state.stocks.map((row, index) => index === stockIndex ? nextStock : row)
    const catalogue = existing
      ? state.catalogue.map((item) => item.id === id ? next : item)
      : [...state.catalogue, next]
    await states.update(state.id, { catalogue, stocks })
    return next
  })
}

async function setCatalogueFeedAvailable(id: number, available: boolean): Promise<FeedCatalogueItem> {
  return serializeMutation(async () => {
    const state = await states.get('feed-receipts')
    const current = state.catalogue.find((item) => item.id === id)
    if (!current) throw new Error('Không tìm thấy thức ăn.')
    const next = { ...current, available, version: current.version + 1 }
    const stocks = state.stocks.map((row) => row.feedItemId === id ? { ...row, available, version: row.version + 1 } : row)
    await states.update(state.id, { catalogue: state.catalogue.map((item) => item.id === id ? next : item), stocks })
    return next
  })
}

function validateSupplierInput(input: FeedSupplierInput, state: FeedReceiptDemoState) {
  const name = input.name.trim()
  if (!name) throw new Error('Nhập tên nhà cung cấp.')
  if (name.length > 150) throw new Error('Tên nhà cung cấp tối đa 150 ký tự.')
  if (input.phone.length > 50) throw new Error('Số điện thoại tối đa 50 ký tự.')
  if (input.area.length > 255) throw new Error('Khu vực hoặc địa chỉ tối đa 255 ký tự.')
  if (input.note.length > 500) throw new Error('Ghi chú tối đa 500 ký tự.')
  if (state.suppliers.some((supplier) => supplier.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase() && supplier.id !== input.id)) {
    throw new Error('Tên nhà cung cấp đã tồn tại.')
  }
  if (input.id !== undefined && !state.suppliers.some((supplier) => supplier.id === input.id)) throw new Error('Không tìm thấy nhà cung cấp.')
}

async function saveCatalogueSupplier(input: FeedSupplierInput): Promise<FeedSupplier> {
  return serializeMutation(async () => {
    const state = await states.get('feed-receipts')
    validateSupplierInput(input, state)
    const existing = input.id === undefined ? undefined : state.suppliers.find((supplier) => supplier.id === input.id)
    const next: FeedSupplier = {
      id: existing?.id ?? Math.max(0, ...state.suppliers.map((supplier) => supplier.id)) + 1,
      name: input.name.trim(),
      phone: input.phone.trim(),
      area: input.area.trim(),
      note: input.note.trim(),
      active: input.active ?? existing?.active ?? true,
      version: existing ? existing.version + 1 : 0,
    }
    const suppliers = existing
      ? state.suppliers.map((supplier) => supplier.id === next.id ? next : supplier)
      : [...state.suppliers, next]
    await states.update(state.id, { suppliers })
    return next
  })
}

async function setCatalogueSupplierActive(id: number, active: boolean): Promise<FeedSupplier> {
  return serializeMutation(async () => {
    const state = await states.get('feed-receipts')
    const current = state.suppliers.find((supplier) => supplier.id === id)
    if (!current) throw new Error('Không tìm thấy nhà cung cấp.')
    const next = { ...current, active, version: current.version + 1 }
    await states.update(state.id, { suppliers: state.suppliers.map((supplier) => supplier.id === id ? next : supplier) })
    return next
  })
}

function validateFeedingDraft(input: FeedFeedingDraftInput, state: FeedReceiptDemoState) {
  if (!isIsoCalendarDate(input.feedingDate)) throw new Error('Ngày cho ăn không hợp lệ.')
  if (input.feedingDate > localToday()) throw new Error('Ngày cho ăn không được ở tương lai.')
  const pen = FEED_RATION_DEMO_PENS.find((row) => row.id === input.penId && row.status === 'ACTIVE')
  if (!pen) throw new Error('Chọn chuồng đang hoạt động.')
  if (![1, 2, 3].includes(input.sessionNo)) throw new Error('Chọn cữ cho ăn hợp lệ.')
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) throw new Error('Nhập giờ theo định dạng giờ:phút.')
  if (!input.fedBy.trim() || input.fedBy.trim().length > 100) throw new Error('Nhập người cho ăn, tối đa 100 ký tự.')
  if (input.note.length > 500) throw new Error('Ghi chú tối đa 500 ký tự.')
  if (input.leftoverKg !== null && (!Number.isFinite(input.leftoverKg) || input.leftoverKg < 0 || !isOneDecimal(input.leftoverKg))) {
    throw new Error('Thức ăn thừa phải là số kg không âm, tối đa một chữ số thập phân.')
  }
  if (!input.lines.length) throw new Error('Thêm ít nhất một loại thức ăn.')
  if (state.feedings.some((row) => row.status === 'VALID' && row.penId === input.penId
    && row.feedingDate === input.feedingDate && row.sessionNo === input.sessionNo)) {
    throw new Error('Cữ này đã được ghi cho chuồng và ngày đã chọn.')
  }
  const seen = new Set<number>()
  for (const [index, line] of input.lines.entries()) {
    if (!Number.isInteger(line.feedItemId) || seen.has(line.feedItemId)) throw new Error('Mỗi loại thức ăn chỉ được thêm một lần.')
    seen.add(line.feedItemId)
    const stock = state.stocks.find((row) => row.feedItemId === line.feedItemId)
    if (!stock) throw new Error(`Không tìm thấy thức ăn ở dòng ${index + 1}.`)
    if (stock.available === false) throw new Error(`Thức ăn ${stock.code} đã ngừng hoạt động.`)
    if (!Number.isFinite(line.plannedKg) || line.plannedKg < 0 || !isOneDecimal(line.plannedKg)) throw new Error(`Lượng theo kế hoạch ở dòng ${index + 1} không hợp lệ.`)
    if (!Number.isFinite(line.actualKg) || line.actualKg < 0 || !isOneDecimal(line.actualKg)) throw new Error(`Lượng thực tế ở dòng ${index + 1} phải là số kg không âm, tối đa một chữ số thập phân.`)
    if (line.actualKg > stock.onHandKg + 0.0005) throw new Error(`Không đủ tồn kho ${stock.code} để ghi cữ.`)
  }
  return pen
}

function feedingLines(input: FeedFeedingDraftInput['lines'], stocks: readonly FeedStockRow[]): FeedFeedingLine[] {
  return input.map((line) => {
    const stock = stocks.find((row) => row.feedItemId === line.feedItemId)
    if (!stock) throw new Error('Không tìm thấy mặt hàng thức ăn trong tồn kho hiện tại.')
    const unitCost = stock.onHandKg > 0 ? stock.stockValue / stock.onHandKg : null
    return {
      feedItemId: stock.feedItemId,
      feedCode: stock.code,
      feedName: stock.name,
      plannedKg: roundKg(line.plannedKg),
      actualKg: roundKg(line.actualKg),
      inRation: line.inRation,
      unitCost,
      totalCost: unitCost === null ? null : roundMoney(line.actualKg * unitCost),
    }
  })
}

function updateStockForFeeding(
  stocks: Array<FeedStockRow & CollectionRow>,
  deltas: ReadonlyMap<number, number>,
  fallbackCosts: ReadonlyMap<number, number | null> = new Map(),
) {
  for (const feedItemId of deltas.keys()) {
    if (!stocks.some((row) => row.feedItemId === feedItemId)) throw new Error('Mặt hàng đã không còn trong tồn kho.')
  }
  return stocks.map((stock) => {
    const delta = roundKg(deltas.get(stock.feedItemId) ?? 0)
    if (delta === 0) return stock
    const onHandKg = roundKg(stock.onHandKg - delta)
    if (onHandKg < -0.0005) throw new Error(`Tồn kho ${stock.code} không đủ để cập nhật cữ.`)
    const unitCost = stock.onHandKg > 0 ? stock.stockValue / stock.onHandKg : fallbackCosts.get(stock.feedItemId) ?? null
    const stockValue = unitCost === null ? stock.stockValue : Math.max(0, roundMoney(stock.stockValue - delta * unitCost))
    const status = feedStockStatus(onHandKg, stock.minimumStockKg, stock.averageDailyUseKg)
    const daysOfCover = stock.averageDailyUseKg === 0 ? null : Math.round((onHandKg / stock.averageDailyUseKg) * 10) / 10
    return { ...stock, onHandKg: Math.max(0, onHandKg), stockValue, status, daysOfCover, version: stock.version + 1 }
  })
}

function validateFeedingReason(reason: string) {
  if (reason.trim().length < 5) throw new Error('Nhập lý do, tối thiểu 5 ký tự.')
  if (reason.trim().length > 500) throw new Error('Lý do tối đa 500 ký tự.')
}

async function recordFeeding(input: FeedFeedingDraftInput): Promise<FeedFeedingRecord> {
  return serializeMutation(async () => {
    const state = await states.get('feed-receipts')
    const pen = validateFeedingDraft(input, state)
    const lines = feedingLines(input.lines, state.stocks)
    const deltas = new Map(lines.map((line) => [line.feedItemId, line.actualKg]))
    const stocks = updateStockForFeeding(state.stocks, deltas)
    const record: FeedFeedingRecord = {
      id: Math.max(0, ...state.feedings.map((row) => row.id)) + 1,
      penId: pen.id,
      penCode: pen.code,
      penName: pen.name,
      feedingDate: input.feedingDate,
      sessionNo: input.sessionNo,
      time: input.time,
      headCount: pen.headcount,
      rationCode: input.rationCode ?? null,
      rationVersion: input.rationVersion ?? null,
      status: 'VALID',
      version: 0,
      fedBy: input.fedBy.trim(),
      recordedAt: localNowIso(),
      leftoverKg: input.leftoverKg,
      note: input.note.trim(),
      plannedTotalKg: roundKg(lines.reduce((sum, line) => sum + line.plannedKg, 0)),
      actualTotalKg: roundKg(lines.reduce((sum, line) => sum + line.actualKg, 0)),
      lines,
      revisions: [],
    }
    const movements = appendMovements(state, lines.map((line) => ({
      feedItemId: line.feedItemId, movementType: 'FEEDING', quantityKg: -line.actualKg, unitCost: line.unitCost,
      sourceType: 'FEEDING', sourceId: record.id, sourceCode: `${record.penCode} · cữ ${record.sessionNo}`,
    })), stocks)
    await states.update(state.id, { feedings: [record, ...state.feedings], stocks, movements })
    return record
  })
}

async function correctFeeding(id: number, input: FeedFeedingCorrectionInput): Promise<FeedFeedingRecord> {
  return serializeMutation(async () => {
    validateFeedingReason(input.reason)
    if (input.time !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) throw new Error('Nhập giờ theo định dạng giờ:phút.')
    if (input.fedBy !== undefined && (!input.fedBy.trim() || input.fedBy.trim().length > 100)) throw new Error('Nhập người cho ăn, tối đa 100 ký tự.')
    if (input.leftoverKg !== undefined && input.leftoverKg !== null
      && (!Number.isFinite(input.leftoverKg) || input.leftoverKg < 0 || !isOneDecimal(input.leftoverKg))) {
      throw new Error('Thức ăn thừa phải là số kg không âm, tối đa một chữ số thập phân.')
    }
    if (input.note !== undefined && input.note.length > 500) throw new Error('Ghi chú tối đa 500 ký tự.')
    const state = await states.get('feed-receipts')
    const current = state.feedings.find((row) => row.id === id)
    if (!current || current.status !== 'VALID') throw new Error('Chỉ có thể sửa bản ghi cho ăn đang hợp lệ.')
    if (input.expectedVersion !== undefined && current.version !== input.expectedVersion) throw new Error('Bản ghi đã thay đổi. Hãy tải lại nhật ký rồi thử lại.')
    if (!input.lines.length) throw new Error('Thêm ít nhất một loại thức ăn.')
    const seen = new Set<number>()
    for (const line of input.lines) {
      if (seen.has(line.feedItemId)) throw new Error('Mỗi loại thức ăn chỉ được thêm một lần.')
      seen.add(line.feedItemId)
      if (!Number.isFinite(line.plannedKg) || line.plannedKg < 0 || !isOneDecimal(line.plannedKg)) throw new Error('Lượng theo kế hoạch không hợp lệ.')
      if (!Number.isFinite(line.actualKg) || line.actualKg < 0 || !isOneDecimal(line.actualKg)) throw new Error('Lượng thực tế phải là số kg không âm, tối đa một chữ số thập phân.')
      if (!state.stocks.some((row) => row.feedItemId === line.feedItemId)) throw new Error('Không tìm thấy thức ăn trong tồn kho.')
    }
    const lines = feedingLines(input.lines, state.stocks)
    const priorQuantities = new Map(current.lines.map((line) => [line.feedItemId, line.actualKg]))
    const nextQuantities = new Map(lines.map((line) => [line.feedItemId, line.actualKg]))
    const ids = new Set([...priorQuantities.keys(), ...nextQuantities.keys()])
    const deltas = new Map([...ids].map((feedItemId) => [feedItemId, roundKg((nextQuantities.get(feedItemId) ?? 0) - (priorQuantities.get(feedItemId) ?? 0))]))
    const fallbackCosts = new Map(current.lines.map((line) => [line.feedItemId, line.unitCost]))
    const stocks = updateStockForFeeding(state.stocks, deltas, fallbackCosts)
    const revision = { action: 'CORRECTED' as const, reason: input.reason.trim(), changedAt: localNowIso(), lines: current.lines.map((line) => ({ ...line })) }
    const updated: FeedFeedingRecord = {
      ...current,
      time: input.time ?? current.time,
      fedBy: input.fedBy?.trim() || current.fedBy,
      leftoverKg: input.leftoverKg === undefined ? current.leftoverKg : input.leftoverKg,
      note: input.note === undefined ? current.note : input.note.trim(),
      version: current.version + 1,
      plannedTotalKg: roundKg(lines.reduce((sum, line) => sum + line.plannedKg, 0)),
      actualTotalKg: roundKg(lines.reduce((sum, line) => sum + line.actualKg, 0)),
      lines,
      revisions: [...current.revisions, revision],
    }
    const movements = appendMovements(state, [...deltas.entries()].map(([feedItemId, delta]) => ({
      feedItemId, movementType: 'FEEDING_CORRECTION', quantityKg: -delta, unitCost: fallbackCosts.get(feedItemId) ?? null,
      sourceType: 'FEEDING', sourceId: id, sourceCode: `${current.penCode} · cữ ${current.sessionNo}`,
    })), stocks)
    await states.update(state.id, { feedings: state.feedings.map((row) => row.id === id ? updated : row), stocks, movements })
    return updated
  })
}

async function voidFeeding(id: number, reason: string): Promise<FeedFeedingRecord> {
  return serializeMutation(async () => {
    validateFeedingReason(reason)
    const state = await states.get('feed-receipts')
    const current = state.feedings.find((row) => row.id === id)
    if (!current || current.status !== 'VALID') throw new Error('Chỉ có thể hủy bản ghi cho ăn đang hợp lệ.')
    const deltas = new Map(current.lines.map((line) => [line.feedItemId, -line.actualKg]))
    const fallbackCosts = new Map(current.lines.map((line) => [line.feedItemId, line.unitCost]))
    const stocks = updateStockForFeeding(state.stocks, deltas, fallbackCosts)
    const revision = { action: 'VOIDED' as const, reason: reason.trim(), changedAt: localNowIso(), lines: current.lines.map((line) => ({ ...line })) }
    const voided: FeedFeedingRecord = { ...current, status: 'VOIDED', version: current.version + 1, revisions: [...current.revisions, revision] }
    const movements = appendMovements(state, current.lines.map((line) => ({
      feedItemId: line.feedItemId, movementType: 'FEEDING_VOID', quantityKg: line.actualKg, unitCost: line.unitCost,
      sourceType: 'FEEDING', sourceId: id, sourceCode: `${current.penCode} · cữ ${current.sessionNo}`,
    })), stocks)
    await states.update(state.id, { feedings: state.feedings.map((row) => row.id === id ? voided : row), stocks, movements })
    return voided
  })
}

/** GBR-99: a posted receipt is voided with a reason only while the stock of every feed covers what it received. */
function receiptVoidCheck(state: FeedReceiptDemoState, receipt: FeedReceiptDemoRecord) {
  const needed = new Map<number, number>()
  receipt.lines.forEach((line) => needed.set(line.feedItemId, (needed.get(line.feedItemId) ?? 0) + line.kgReceived))
  return [...needed.entries()].map(([feedItemId, kg]) => {
    const stock = state.stocks.find((row) => row.feedItemId === feedItemId)
    return { feedItemId, code: stock?.code ?? '', name: stock?.name ?? '', onHandKg: stock?.onHandKg ?? 0, neededKg: kg, ok: (stock?.onHandKg ?? 0) + 0.0005 >= kg }
  })
}

async function voidReceipt(id: number, reason: string): Promise<FeedReceiptDemoRecord> {
  return serializeMutation(async () => {
    const state = await states.get('feed-receipts')
    const current = state.receipts.find((row) => row.id === id)
    if (!current || current.status !== 'POSTED') throw new Error('Chỉ có thể hủy phiếu đã ghi nhận.')
    if (!reason.trim()) throw new Error('Nhập lý do hủy phiếu.')
    if (reason.trim().length > 500) throw new Error('Lý do tối đa 500 ký tự.')
    const blocked = receiptVoidCheck(state, current).find((row) => !row.ok)
    if (blocked) {
      throw new Error(`Phiếu ${current.code} không thể hủy: tồn kho ${blocked.name} (${roundKg(blocked.onHandKg)} kg) ít hơn số đã nhập. Hãy lập phiếu điều chỉnh kho.`)
    }
    const kgByFeed = new Map<number, number>()
    current.lines.forEach((line) => kgByFeed.set(line.feedItemId, (kgByFeed.get(line.feedItemId) ?? 0) + line.kgReceived))
    const unitCosts = new Map<number, number | null>()
    const stocks = state.stocks.map((stock) => {
      const kg = kgByFeed.get(stock.feedItemId)
      if (!kg) return stock
      const unitCost = stock.onHandKg > 0 ? stock.stockValue / stock.onHandKg : 0
      unitCosts.set(stock.feedItemId, unitCost ? Math.round(unitCost) : null)
      const onHandKg = roundKg(stock.onHandKg - kg)
      return {
        ...stock,
        onHandKg,
        stockValue: Math.max(0, roundMoney(stock.stockValue - kg * unitCost)),
        status: feedStockStatus(onHandKg, stock.minimumStockKg, stock.averageDailyUseKg),
        daysOfCover: stock.averageDailyUseKg === 0 ? null : Math.round((onHandKg / stock.averageDailyUseKg) * 10) / 10,
        version: stock.version + 1,
      }
    })
    const voided: FeedReceiptDemoRecord = { ...current, status: 'VOIDED', version: current.version + 1, voidReason: reason.trim() }
    const movements = appendMovements(state, [...kgByFeed.entries()].map(([feedItemId, kg]) => ({
      feedItemId, movementType: 'RECEIPT_VOID', quantityKg: -kg, unitCost: unitCosts.get(feedItemId) ?? null,
      sourceType: 'RECEIPT', sourceId: current.id, sourceCode: current.code,
    })), stocks)
    await states.update(state.id, { receipts: state.receipts.map((row) => row.id === id ? voided : row), stocks, movements })
    return voided
  })
}

/** SRS GBR-91: a later payment is a positive whole-VND amount, not in the future, never above the outstanding amount. */
async function recordPayment(id: number, amount: number, method: 'CASH' | 'BANK_TRANSFER', date: string): Promise<FeedReceiptDemoRecord> {
  return serializeMutation(async () => {
    const state = await states.get('feed-receipts')
    const current = state.receipts.find((row) => row.id === id)
    if (!current || current.status !== 'POSTED') throw new Error('Chỉ ghi trả được cho phiếu đã ghi nhận.')
    if (!Number.isInteger(amount) || amount <= 0) throw new Error('Số tiền phải là số nguyên lớn hơn 0.')
    if (!isIsoCalendarDate(date) || date > localToday()) throw new Error('Ngày trả không hợp lệ hoặc ở tương lai.')
    if (date < current.receiptDate) throw new Error('Ngày trả không được trước ngày nhập.')
    const outstanding = current.totalPayable - current.amountPaid
    if (amount > outstanding) throw new Error(`Số tiền không được vượt quá ${roundMoney(outstanding).toLocaleString('vi-VN')} đ.`)
    const next: FeedReceiptDemoRecord = { ...current, amountPaid: current.amountPaid + amount, paymentMethod: method, paymentDate: date, version: current.version + 1 }
    await states.update(state.id, { receipts: state.receipts.map((row) => row.id === id ? next : row) })
    return next
  })
}

async function saveDraft(input: FeedReceiptDraftInput): Promise<FeedReceiptDemoRecord> {
  return serializeMutation(async () => {
    const state = await states.get('feed-receipts')
    const existing = input.id === undefined ? undefined : state.receipts.find((row) => row.id === input.id)
    if (input.id !== undefined && !existing) throw new Error('Không tìm thấy phiếu nháp.')
    if (existing && existing.status !== 'DRAFT') throw new Error('Chỉ có thể sửa phiếu nháp.')
    validateDraftInput(input, state, existing)
    for (const line of input.lines) {
      const feed = state.stocks.find((row) => row.feedItemId === line.feedItemId)
      const keptFromDraft = existing?.lines.some((savedLine) => savedLine.feedItemId === line.feedItemId) ?? false
      if (!feed || feed.available === false && !keptFromDraft || feed.code !== line.feedCode || feed.name !== line.feedName) throw new Error('Thức ăn đã thay đổi hoặc ngừng hoạt động. Hãy chọn lại mặt hàng.')
    }
    const id = existing?.id ?? nextDemoId(state.receipts)
    const lines = input.lines.map((line, index) => ({
      id: line.id ?? id * 100 + index + 1,
      feedItemId: line.feedItemId,
      feedCode: line.feedCode,
      feedName: line.feedName,
      lotNumber: line.lotNumber || null,
      expiryDate: line.expiryDate || null,
      quantityPurchase: line.quantityPurchase,
      purchaseUnit: line.purchaseUnit,
      kgPerPurchaseUnit: line.kgPerPurchaseUnit,
      kgReceived: Math.round(line.quantityPurchase * line.kgPerPurchaseUnit * 1000) / 1000,
      unitPrice: line.unitPrice,
      lineAmount: Math.round(line.quantityPurchase * line.unitPrice),
    }))
    const goodsAmount = lines.reduce((total, line) => total + line.lineAmount, 0)
    const next: FeedReceiptDemoRecord = {
      id,
      code: existing?.code ?? nextReceiptCode(state.receipts),
      receiptDate: input.receiptDate,
      supplierId: input.supplierId,
      supplierName: input.supplierName,
      status: 'DRAFT',
      goodsAmount,
      transportFee: input.transportFee,
      totalPayable: goodsAmount + input.transportFee,
      version: existing ? existing.version + 1 : 0,
      invoiceNumber: input.invoiceNumber,
      receivedBy: input.receivedBy,
      storageLocation: input.storageLocation,
      note: input.note,
      amountPaid: input.amountPaid,
      paymentMethod: input.paymentMethod,
      paymentDate: input.paymentDate,
      balanceDueDate: input.balanceDueDate,
      lines,
    }
    const receipts = existing
      ? state.receipts.map((row) => row.id === id ? next : row)
      : [next, ...state.receipts]
    await states.update(state.id, { receipts })
    return next
  })
}

async function postDraft(id: number): Promise<FeedReceiptDemoRecord> {
  return serializeMutation(async () => {
    const state = await states.get('feed-receipts')
    const current = state.receipts.find((row) => row.id === id)
    if (!current || current.status !== 'DRAFT') throw new Error('Chỉ có thể ghi nhận phiếu nháp.')

    const today = localToday()
    const expiryLimit = datePlusDays(today, 30)
    const byFeed = new Map<number, typeof current.lines>()
    current.lines.forEach((line) => byFeed.set(line.feedItemId, [...(byFeed.get(line.feedItemId) ?? []), line]))
    const stocks = state.stocks.map((stock) => {
      const lines = byFeed.get(stock.feedItemId)
      if (!lines) return stock
      const receivedKg = lines.reduce((total, line) => total + line.kgReceived, 0)
      const addedValue = lines.reduce((total, line) => total + line.lineAmount, 0)
      const onHandKg = Math.round((stock.onHandKg + receivedKg) * 1000) / 1000
      const status = feedStockStatus(onHandKg, stock.minimumStockKg, stock.averageDailyUseKg)
      const daysOfCover = stock.averageDailyUseKg === 0
        ? null
        : Math.round((onHandKg / stock.averageDailyUseKg) * 10) / 10
      const lots = [
        ...(stock.nearestLotNumber && stock.nearestLotExpiryDate ? [{ lotNumber: stock.nearestLotNumber, expiryDate: stock.nearestLotExpiryDate }] : []),
        ...lines.flatMap((line) => line.expiryDate ? [{ lotNumber: line.lotNumber, expiryDate: line.expiryDate }] : []),
      ].filter((lot) => lot.expiryDate >= today && lot.expiryDate <= expiryLimit)
        .sort((left, right) => left.expiryDate.localeCompare(right.expiryDate))
      const nearest = lots[0]
      return {
        ...stock,
        onHandKg,
        stockValue: stock.stockValue + addedValue,
        status,
        daysOfCover,
        version: stock.version + 1,
        nearestLotNumber: nearest?.lotNumber ?? null,
        nearestLotExpiryDate: nearest?.expiryDate ?? null,
      }
    })
    const posted: FeedReceiptDemoRecord = { ...current, status: 'POSTED', version: current.version + 1 }
    const receipts = state.receipts.map((row) => row.id === id ? posted : row)
    const movements = appendMovements(state, [...byFeed.entries()].map(([feedItemId, lines]) => {
      const kg = lines.reduce((total, line) => total + line.kgReceived, 0)
      return {
        feedItemId, movementType: 'RECEIPT', quantityKg: kg, unitCost: kg ? Math.round(lines.reduce((total, line) => total + line.lineAmount, 0) / kg) : null,
        sourceType: 'RECEIPT', sourceId: current.id, sourceCode: current.code,
      }
    }), stocks)
    await states.update(state.id, { receipts, stocks, movements })
    return posted
  })
}

const demoStore: FeedReceiptDemoStore = {
  list: async () => [...(await states.get('feed-receipts')).receipts]
    .sort((left, right) => right.receiptDate.localeCompare(left.receiptDate) || right.id - left.id),
  get: async (id) => {
    const record = (await states.get('feed-receipts')).receipts.find((row) => String(row.id) === String(id))
    if (!record) throw new Error(`Not found: feed receipt demo/${id}`)
    return record
  },
  saveDraft,
  post: postDraft,
  void: voidReceipt,
  recordPayment,
  voidCheck: async (id) => {
    const state = await states.get('feed-receipts')
    const current = state.receipts.find((row) => row.id === id)
    if (!current) throw new Error('Không tìm thấy phiếu nhập kho.')
    return receiptVoidCheck(state, current)
  },
  reset: async () => { await serializeMutation(async () => { await states.reset() }) },
}

const adjustmentDemoStore: FeedStockAdjustmentDemoStore = {
  list: async () => [...(await states.get('feed-receipts')).adjustments]
    .sort((left, right) => right.countDate.localeCompare(left.countDate) || right.id - left.id),
  get: async (id) => {
    const record = (await states.get('feed-receipts')).adjustments.find((row) => String(row.id) === String(id))
    if (!record) throw new Error(`Not found: feed stock adjustment demo/${id}`)
    return record
  },
  saveDraft: saveAdjustmentDraft,
  post: postAdjustment,
  reset: async () => { await serializeMutation(async () => { await states.reset() }) },
}

const feedingDemoStore: FeedFeedingDemoStore = {
  list: async (range: FeedFeedingRange) => (await states.get('feed-receipts')).feedings
    .filter((row) => row.feedingDate >= range.from && row.feedingDate <= range.to)
    .sort((left, right) => right.feedingDate.localeCompare(left.feedingDate) || left.penCode?.localeCompare(right.penCode ?? '') || left.sessionNo - right.sessionNo)
    .map((row) => ({ ...row, lines: row.lines.map((line) => ({ ...line })), revisions: row.revisions.map((revision) => ({ ...revision, lines: revision.lines.map((line) => ({ ...line })) })) })),
  record: recordFeeding,
  correct: correctFeeding,
  voidRecord: voidFeeding,
  reset: async () => {
    await serializeMutation(async () => {
      const state = await states.get('feed-receipts')
      await states.update(state.id, { feedings: [] })
    })
  },
}

const catalogueDemoStore: FeedCatalogueDemoStore = {
  listFeeds: async () => (await states.get('feed-receipts')).catalogue
    .map((item) => ({ ...item }))
    .sort((left, right) => left.code.localeCompare(right.code)),
  saveFeed: saveCatalogueFeed,
  setFeedAvailable: setCatalogueFeedAvailable,
  listSuppliers: async () => (await states.get('feed-receipts')).suppliers
    .map((supplier) => ({ ...supplier }))
    .sort((left, right) => left.name.localeCompare(right.name)),
  saveSupplier: saveCatalogueSupplier,
  setSupplierActive: setCatalogueSupplierActive,
  reset: async () => { await serializeMutation(async () => { await states.reset() }) },
}

export const listFeedMovementsDemo = async (feedItemId: number): Promise<FeedMovement[]> => (await states.get('feed-receipts')).movements
  .filter((row) => row.feedItemId === feedItemId)
  .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt) || right.id - left.id)
export const latestFeedMovementDemo = async (): Promise<string | null> => (await states.get('feed-receipts')).movements
  .reduce<string | null>((latest, row) => !latest || row.occurredAt > latest ? row.occurredAt : latest, null)
export const listFeedReceiptDemo = () => demoStore.list()
export const getFeedReceiptDemo = (id: string) => demoStore.get(id)
export const saveFeedReceiptDemoDraft = (input: FeedReceiptDraftInput) => demoStore.saveDraft(input)
export const postFeedReceiptDemo = (id: number) => demoStore.post(id)
export const listFeedReceiptDemoStock = async () => (await states.get('feed-receipts')).stocks.map((row) => ({ ...row }))
export const feedCatalogueDemoStore = catalogueDemoStore
export const resetFeedCatalogueDemoStore = () => catalogueDemoStore.reset()
export const resetFeedReceiptDemoStore = () => demoStore.reset()
export const feedReceiptDemoStore = demoStore
export const listFeedStockAdjustmentDemo = () => adjustmentDemoStore.list()
export const getFeedStockAdjustmentDemo = (id: string) => adjustmentDemoStore.get(id)
export const saveFeedStockAdjustmentDemoDraft = (input: FeedStockAdjustmentDraftInput) => adjustmentDemoStore.saveDraft(input)
export const postFeedStockAdjustmentDemo = (id: number) => adjustmentDemoStore.post(id)
export const resetFeedStockAdjustmentDemoStore = () => adjustmentDemoStore.reset()
export const feedStockAdjustmentDemoStore = adjustmentDemoStore
export const listFeedFeedingDemo = (range: FeedFeedingRange) => feedingDemoStore.list(range)
export const recordFeedFeedingDemo = (input: FeedFeedingDraftInput) => feedingDemoStore.record(input)
export const correctFeedFeedingDemo = (id: number, input: FeedFeedingCorrectionInput) => feedingDemoStore.correct(id, input)
export const voidFeedFeedingDemo = (id: number, reason: string) => feedingDemoStore.voidRecord(id, reason)
export const resetFeedFeedingDemoStore = () => feedingDemoStore.reset()
export const feedFeedingDemoStore = feedingDemoStore
