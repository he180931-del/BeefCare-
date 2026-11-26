import { useMemo, useState } from 'react'
import { userFacingError } from '../../../shared/api/userFacingError'
import { useQuery } from '../../../shared/hooks/useQuery'
import { defaultFeedConsumptionPeriod, feedConsumptionMayLackSources, loadFeedConsumptionReport } from '../api/feedConsumptionApi'
import { buildFeedConsumptionReport, filterFeedConsumptionReport, mapBackendConsumptionRows, summarizeFeedConsumptionReport } from '../domain/feedConsumptionReport'
import { rationGroupLabel } from '../domain/feedRationForm'
import { formatShortDate } from '../domain/feedLabels'
import type { FeedConsumptionGroupBy, FeedConsumptionProjectionRow, FeedConsumptionServerRow } from '../types/feedConsumption'

export const FEED_CONSUMPTION_GROUPS: Array<{ value: FeedConsumptionGroupBy; label: string; title: string; column: string }> = [
  { value: 'HERD_GROUP', label: 'Theo nhóm đàn', title: 'Theo nhóm đàn', column: 'Nhóm đàn' },
  { value: 'PEN', label: 'Theo chuồng', title: 'Theo chuồng', column: 'Chuồng' },
  { value: 'FEED', label: 'Theo thức ăn', title: 'Theo thức ăn', column: 'Thức ăn' },
]

const HERD_ORDER = ['BREEDING_FEMALES', 'FATTENING', 'BREEDING_BULLS', 'CALVES', 'YOUNG_STOCK', 'OTHER']

function calendarDays(from: string, to: string) {
  const start = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T00:00:00`)
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) return 0
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1
}

export function useFeedConsumptionReport() {
  const period = useMemo(defaultFeedConsumptionPeriod, [])
  const [from, setFrom] = useState(period.from)
  const [to, setTo] = useState(period.to)
  const [groupBy, setGroupBy] = useState<FeedConsumptionGroupBy>('HERD_GROUP')
  const validPeriod = Boolean(from && to && from <= to)
  const query = useQuery(async () => {
    if (!validPeriod) return { from, to, data: null }
    return { from, to, data: await loadFeedConsumptionReport({ from, to, groupBy }) }
  }, [from, groupBy, to])
  const loaded = query.data?.from === from && query.data?.to === to ? query.data.data : null
  const backendReport = loaded?.backendReport?.groupBy === groupBy ? loaded.backendReport : null
  const report = useMemo(() => loaded && !backendReport
    ? buildFeedConsumptionReport({ ...loaded, from, to, backendReport: null })
    : null, [backendReport, from, loaded, to])
  const projection = useMemo(() => report
    ? filterFeedConsumptionReport(report, { from, to, groupBy }, loaded?.catalogue ?? [])
    : null, [from, groupBy, loaded?.catalogue, report, to])
  const serverRows = useMemo<FeedConsumptionServerRow[]>(() => backendReport ? mapBackendConsumptionRows(backendReport) : [], [backendReport])
  const summary = useMemo(() => {
    if (backendReport) return {
      actualKg: backendReport.tiles.kg,
      plannedKg: 0,
      cost: backendReport.tiles.cost,
      days: backendReport.tiles.days,
      headDays: backendReport.tiles.headDays,
      averageKgPerHeadDay: backendReport.tiles.averageKgPerHeadDay,
      averageCostPerHeadDay: backendReport.tiles.averageCostPerHeadDay,
      receivedKg: backendReport.tiles.receivedKg,
      receiptCount: backendReport.tiles.receiptCount,
      receivedAmount: backendReport.tiles.receivedAmount,
      receivedAmountIsGoodsOnly: false,
    }
    return projection ? summarizeFeedConsumptionReport(projection) : null
  }, [backendReport, projection])
  const days = calendarDays(from, to)
  const rows = useMemo(() => {
    const list = backendReport ? [...serverRows] : [...(projection?.rows ?? [])]
    if (groupBy === 'HERD_GROUP') list.sort((a, b) => (HERD_ORDER.indexOf(a.herdGroup ?? '') + 1 || 99) - (HERD_ORDER.indexOf(b.herdGroup ?? '') + 1 || 99))
    else if (groupBy === 'FEED') list.sort((a, b) => (b.totalCost ?? 0) - (a.totalCost ?? 0))
    return list
  }, [backendReport, groupBy, projection, serverRows])
  const feedBars = useMemo(() => backendReport
    ? backendReport.costByFeed.map((row) => ({ key: row.feedCode, label: row.feedName, kg: row.kg, totalCost: row.cost }))
    : [...(projection ? filterFeedConsumptionReport(report!, { from, to, groupBy: 'FEED' }, loaded?.catalogue ?? []).rows : [])]
      .map((row) => ({ key: row.key, label: row.label, kg: row.actualKg, totalCost: row.totalCost }))
      .sort((a, b) => (b.totalCost ?? 0) - (a.totalCost ?? 0)),
  [backendReport, from, loaded?.catalogue, projection, report, to])
  const maxCost = Math.max(1, ...feedBars.map((row) => row.totalCost ?? 0))
  const option = FEED_CONSUMPTION_GROUPS.find((item) => item.value === groupBy) ?? FEED_CONSUMPTION_GROUPS[0]

  const reasonFor = (row: FeedConsumptionServerRow | FeedConsumptionProjectionRow) => {
    if (row.varianceRatio === null || row.varianceRatio > -0.1) return null
    const first = (loaded?.feedings ?? [])
      .filter((record) => ('penId' in row ? row.penId === null || record.penId === row.penId : true) && record.lines.some((line) => line.plannedKg > 0 && line.actualKg === 0))
      .map((record) => ({ date: record.feedingDate, line: record.lines.find((line) => line.plannedKg > 0 && line.actualKg === 0), group: record.rationCode }))
      .sort((a, b) => a.date.localeCompare(b.date))
    const match = groupBy === 'HERD_GROUP'
      ? first.filter((item) => loaded?.rations.find((ration) => ration.rationCode === item.group)?.herdGroup === row.herdGroup)
      : first
    const earliest = match[0]
    return earliest?.line ? `${earliest.line.feedName ?? earliest.line.feedCode} hết kho từ ${formatShortDate(earliest.date)}` : null
  }

  return {
    from,
    to,
    setFrom,
    setTo,
    groupBy,
    setGroupBy,
    groupOptions: FEED_CONSUMPTION_GROUPS,
    validPeriod,
    loaded,
    backendReport,
    projection,
    summary,
    days,
    rows,
    feedBars,
    maxCost,
    option,
    reasonFor,
    loading: query.loading && !loaded,
    errorMessage: query.error ? userFacingError(query.error, 'Không thể tải báo cáo tiêu thụ thức ăn.') : null,
    refetch: query.refetch,
    mayLackSources: feedConsumptionMayLackSources,
  }
}
