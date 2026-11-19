import type { FeedFeedingRecord } from '../types/feedFeeding'
import type { FeedReceipt } from '../types/feedReceipt'
import type { FeedRation } from '../types/feedRation'
import type { FeedStockAdjustment } from '../types/feedStockAdjustment'
import type {
  FeedConsumptionBackendReport,
  FeedConsumptionBackendRow,
  FeedConsumptionFilters,
  FeedConsumptionGroupBy,
  FeedConsumptionProjection,
  FeedConsumptionProjectionRow,
  FeedConsumptionSupportingData,
  FeedConsumptionSummary,
} from '../types/feedConsumption'

type BuildInput = FeedConsumptionSupportingData & {
  from: string
  to: string
  backendReport?: FeedConsumptionBackendReport | null
}

type BaseRow = FeedConsumptionBackendRow

type HeadDay = {
  penId: number
  penCode: string | null
  date: string
  herdGroup: string
  headCount: number
  feedItemIds: Set<number>
}

const ratio = (actual: number, planned: number) => planned > 0 ? (actual - planned) / planned : null

function groupForRecord(record: FeedFeedingRecord, rations: readonly FeedRation[]) {
  const ration = record.rationVersionId != null
    ? rations.find((item) => item.id === record.rationVersionId)
    : rations.find((item) => item.rationCode === record.rationCode && item.versionNo === record.rationVersion)
  return ration?.herdGroup || 'Unknown'
}

function inRange(date: string, from: string, to: string) {
  return date >= from && date <= to
}

function localRows(feedings: readonly FeedFeedingRecord[], rations: readonly FeedRation[], from: string, to: string): BaseRow[] {
  const grouped = new Map<string, BaseRow & { costKnown: boolean }>()
  for (const record of feedings) {
    if (record.status !== 'VALID' || !inRange(record.feedingDate, from, to)) continue
    const herdGroup = groupForRecord(record, rations)
    for (const line of record.lines) {
      const key = `${record.penId}:${herdGroup}:${line.feedItemId}`
      const current = grouped.get(key) ?? {
        penId: record.penId,
        penCode: record.penCode ?? '',
        herdGroup,
        feedItemId: line.feedItemId,
        feedCode: line.feedCode,
        plannedKg: 0,
        actualKg: 0,
        varianceRatio: null,
        totalCost: 0,
        costKnown: true,
      }
      current.plannedKg += line.plannedKg
      current.actualKg += line.actualKg
      if (line.totalCost === null) current.costKnown = false
      else current.totalCost = (current.totalCost ?? 0) + line.totalCost
      grouped.set(key, current)
    }
  }
  return [...grouped.values()].map(({ costKnown, ...row }) => ({
    ...row,
    totalCost: costKnown ? row.totalCost : null,
    varianceRatio: ratio(row.actualKg, row.plannedKg),
  }))
}

function buildHeadDays(feedings: readonly FeedFeedingRecord[], rations: readonly FeedRation[], from: string, to: string): HeadDay[] {
  const days = new Map<string, HeadDay>()
  for (const record of feedings) {
    if (record.status !== 'VALID' || !inRange(record.feedingDate, from, to)) continue
    const herdGroup = groupForRecord(record, rations)
    const key = `${record.penId}:${record.feedingDate}:${herdGroup}`
    const day = days.get(key) ?? {
      penId: record.penId,
      penCode: record.penCode,
      date: record.feedingDate,
      herdGroup,
      headCount: 0,
      feedItemIds: new Set<number>(),
    }
    // A head-count snapshot can appear on several sessions; count the day once.
    day.headCount = Math.max(day.headCount, record.headCount)
    record.lines.forEach((line) => day.feedItemIds.add(line.feedItemId))
    days.set(key, day)
  }
  return [...days.values()]
}

export function buildFeedConsumptionReport(input: BuildInput): Omit<FeedConsumptionProjection, 'groupBy' | 'rows' | 'days' | 'headDays' | 'costKnown'> & {
  baseRows: BaseRow[]
  headDaysByPenDate: HeadDay[]
  rations: FeedRation[]
} {
  const feedings = input.feedings.filter((record) => record.status === 'VALID' && inRange(record.feedingDate, input.from, input.to))
  const baseRows = input.backendReport?.rows ?? localRows(feedings, input.rations, input.from, input.to)
  let adjustmentLossKg: number | null = input.backendReport?.adjustmentLossKg ?? null
  let adjustmentLossValue: number | null = input.backendReport?.adjustmentLossValue ?? null
  if (!input.backendReport) {
    const losses = input.adjustments.filter((adjustment) => adjustment.status === 'POSTED' && inRange(adjustment.countDate, input.from, input.to))
      .flatMap((adjustment) => adjustment.lines)
      .filter((line) => line.differenceKg < 0)
    adjustmentLossKg = losses.reduce((total, line) => total + Math.abs(line.differenceKg), 0)
    adjustmentLossValue = losses.every((line) => line.differenceValue !== null)
      ? losses.reduce((total, line) => total + Math.abs(line.differenceValue ?? 0), 0)
      : null
  }
  return {
    from: input.from,
    to: input.to,
    feedings,
    receipts: input.receipts,
    adjustmentLossKg,
    adjustmentLossValue,
    baseRows,
    headDaysByPenDate: buildHeadDays(feedings, input.rations, input.from, input.to),
    rations: input.rations,
  }
}

function groupDetails(groupBy: FeedConsumptionGroupBy, row: BaseRow, catalogue: FeedConsumptionSupportingData['catalogue']) {
  if (groupBy === 'PEN') return { key: `pen:${row.penId}`, label: row.penCode || `Chuồng ${row.penId}`, penId: row.penId, feedItemId: null, herdGroup: null }
  if (groupBy === 'FEED') {
    const feed = catalogue.find((item) => item.id === row.feedItemId)
    return { key: `feed:${row.feedItemId}`, label: feed?.name || feed?.code || row.feedCode || `Thức ăn ${row.feedItemId}`, penId: null, feedItemId: row.feedItemId, herdGroup: null }
  }
  return { key: `group:${row.herdGroup}`, label: row.herdGroup === 'Unknown' ? 'Chưa phân nhóm' : row.herdGroup, penId: null, feedItemId: null, herdGroup: row.herdGroup }
}

function matchesFilters(row: BaseRow, filters: FeedConsumptionFilters) {
  return (filters.feedItemId === undefined || filters.feedItemId === 'ALL' || row.feedItemId === filters.feedItemId)
    && (filters.penId === undefined || filters.penId === 'ALL' || row.penId === filters.penId)
    && (filters.herdGroup === undefined || filters.herdGroup === 'ALL' || row.herdGroup === filters.herdGroup)
}

export function filterFeedConsumptionReport(
  data: ReturnType<typeof buildFeedConsumptionReport>,
  filters: FeedConsumptionFilters,
  catalogue: FeedConsumptionSupportingData['catalogue'] = [],
): FeedConsumptionProjection {
  const selectedRows = data.baseRows.filter((row) => matchesFilters(row, filters))
  const selectedFeedings = data.feedings.filter((record) => {
    const group = groupForRecord(record, data.rations)
    const rowMatches = selectedRows.some((row) => row.penId === record.penId
      && row.herdGroup === group
      && record.lines.some((line) => line.feedItemId === row.feedItemId))
    return rowMatches
  })
  const selectedFeedIds = new Set(selectedRows.map((row) => row.feedItemId))
  const headDayGroups = new Map<string, Map<string, number>>()
  for (const day of data.headDaysByPenDate) {
    if (filters.penId !== undefined && filters.penId !== 'ALL' && day.penId !== filters.penId) continue
    if (filters.herdGroup !== undefined && filters.herdGroup !== 'ALL' && day.herdGroup !== filters.herdGroup) continue
    const feedIds = [...day.feedItemIds].filter((id) => selectedFeedIds.has(id))
    if (!feedIds.length) continue
    const matchingRows = selectedRows.filter((row) => row.penId === day.penId && row.herdGroup === day.herdGroup && feedIds.includes(row.feedItemId))
    const distinctRows = new Map<string, BaseRow>()
    matchingRows.forEach((row) => distinctRows.set(`${row.penId}:${row.herdGroup}:${row.feedItemId}`, row))
    for (const row of distinctRows.values()) {
      const detail = groupDetails(filters.groupBy, row, catalogue)
      const entry = headDayGroups.get(detail.key) ?? new Map<string, number>()
      const penDateKey = `${day.penId}:${day.date}`
      entry.set(penDateKey, Math.max(entry.get(penDateKey) ?? 0, day.headCount))
      headDayGroups.set(detail.key, entry)
    }
  }

  const grouped = new Map<string, FeedConsumptionProjectionRow & { costKnown: boolean }>()
  for (const row of selectedRows) {
    const detail = groupDetails(filters.groupBy, row, catalogue)
    const current = grouped.get(detail.key) ?? {
      ...detail,
      plannedKg: 0,
      actualKg: 0,
      varianceRatio: null,
      totalCost: 0,
      headDays: [...(headDayGroups.get(detail.key)?.values() ?? [])].reduce((sum, count) => sum + count, 0),
      days: headDayGroups.get(detail.key)?.size ?? 0,
      costKnown: true,
    }
    current.plannedKg += row.plannedKg
    current.actualKg += row.actualKg
    if (row.totalCost === null) current.costKnown = false
    else current.totalCost = (current.totalCost ?? 0) + row.totalCost
    grouped.set(detail.key, current)
  }
  const rows = [...grouped.values()].map(({ costKnown, ...row }) => ({
    ...row,
    totalCost: costKnown ? row.totalCost : null,
    varianceRatio: ratio(row.actualKg, row.plannedKg),
  }))
  const selectedHeadDays = new Map<string, number>()
  for (const day of data.headDaysByPenDate) {
    if (filters.penId !== undefined && filters.penId !== 'ALL' && day.penId !== filters.penId) continue
    if (filters.herdGroup !== undefined && filters.herdGroup !== 'ALL' && day.herdGroup !== filters.herdGroup) continue
    const selected = [...day.feedItemIds].some((id) => selectedFeedIds.has(id))
    if (!selected) continue
    const key = `${day.penId}:${day.date}`
    selectedHeadDays.set(key, Math.max(selectedHeadDays.get(key) ?? 0, day.headCount))
  }
  const filteredDays = new Set(selectedFeedings.map((record) => record.feedingDate))
  const filteredReceipts = data.receipts.filter((receipt) => receipt.status === 'POSTED' && inRange(receipt.receiptDate, filters.from, filters.to))
  const dateFilteredRows = selectedRows
  const costKnown = dateFilteredRows.every((row) => row.totalCost !== null)
  return {
    from: filters.from,
    to: filters.to,
    groupBy: filters.groupBy,
    rows,
    days: filteredDays.size,
    headDays: [...selectedHeadDays.values()].reduce((sum, count) => sum + count, 0),
    feedings: selectedFeedings,
    receipts: filteredReceipts,
    adjustmentLossKg: data.adjustmentLossKg,
    adjustmentLossValue: data.adjustmentLossValue,
    costKnown,
  }
}

export function summarizeFeedConsumptionReport(projection: FeedConsumptionProjection, feedItemId?: number | 'ALL'): FeedConsumptionSummary {
  const actualKg = projection.rows.reduce((sum, row) => sum + row.actualKg, 0)
  const plannedKg = projection.rows.reduce((sum, row) => sum + row.plannedKg, 0)
  const cost = projection.costKnown ? projection.rows.reduce((sum, row) => sum + (row.totalCost ?? 0), 0) : null
  const received = projection.receipts.reduce((summary, receipt) => {
    const lines = feedItemId === undefined || feedItemId === 'ALL'
      ? receipt.lines
      : receipt.lines.filter((line) => line.feedItemId === feedItemId)
    const kg = lines.reduce((sum, line) => sum + line.kgReceived, 0)
    if (!kg) return summary
    summary.receivedKg += kg
    summary.receiptCount += 1
    summary.receivedAmount += feedItemId === undefined || feedItemId === 'ALL'
      ? receipt.totalPayable
      : lines.reduce((sum, line) => sum + line.lineAmount, 0)
    return summary
  }, { receivedKg: 0, receiptCount: 0, receivedAmount: 0 })
  const averageKgPerHeadDay = projection.headDays > 0 ? actualKg / projection.headDays : null
  return {
    actualKg,
    plannedKg,
    cost,
    days: projection.days,
    headDays: projection.headDays,
    averageKgPerHeadDay,
    averageCostPerHeadDay: cost !== null && projection.headDays > 0 ? cost / projection.headDays : null,
    receivedKg: received.receivedKg,
    receiptCount: received.receiptCount,
    receivedAmount: received.receivedAmount,
    receivedAmountIsGoodsOnly: feedItemId !== undefined && feedItemId !== 'ALL',
  }
}
