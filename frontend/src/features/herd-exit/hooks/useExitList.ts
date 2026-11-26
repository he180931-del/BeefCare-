import { useState } from 'react'
import { useQuery } from '../../../shared/hooks/useQuery'
import { businessDate } from '../../../shared/lib/date/farmTime'
import { herdExitApi } from '../api/index'
import { exitPeriodPresets } from '../domain/exitListPeriod'
import type { ExitListResult, ExitStatusCountKey, ExitType, HerdExit } from '../types'

export const EXIT_TABS: Array<{ value: string; counts: ExitStatusCountKey[]; match: (row: HerdExit) => boolean }> = [
  { value: 'Tất cả', counts: ['ALL'], match: () => true },
  { value: 'Nháp', counts: ['DRAFT'], match: (row) => row.status === 'Nháp' },
  { value: 'Chờ xác nhận', counts: ['PENDING'], match: (row) => row.status === 'Chờ xác nhận' },
  { value: 'Đã xuất', counts: ['CONFIRMED'], match: (row) => row.status === 'Đã xuất' },
  { value: 'Đã hủy / bác', counts: ['VOIDED', 'DISMISSED'], match: (row) => row.status === 'Đã hủy' || row.status === 'Đã bác' },
]

export type ExitSort = { key: 'id' | 'date'; descending: boolean }
export type ExitPeriod = { from: string; to: string }

/** SCR-41 #9 / #10: sort by voucher code or exit date; equal dates fall back to the code. */
export function sortExitRows(rows: ReadonlyArray<HerdExit>, sort: ExitSort): HerdExit[] {
  const byId = (a: HerdExit, b: HerdExit) => a.id.localeCompare(b.id, 'vi', { numeric: true })
  return [...rows].sort((a, b) => (sort.descending ? -1 : 1) * (sort.key === 'date' ? (a.date ?? '').localeCompare(b.date ?? '') || byId(a, b) : byId(a, b)))
}

/** Tab count from the server's statusCounts (never from the loaded rows). */
export const tabCount = (result: ExitListResult | null, tab: typeof EXIT_TABS[number]) => tab.counts.reduce((sum, key) => sum + (result?.statusCounts[key] ?? 0), 0)

export const PERIOD_ERROR = 'Ngày bắt đầu không được sau ngày kết thúc.'

export function useExitList(isOwner: boolean) {
  const today = businessDate()
  // Empty dates = let the server apply its default period; the inputs show what it answered.
  const [period, setPeriodState] = useState<ExitPeriod>({ from: '', to: '' })
  const [applied, setApplied] = useState<ExitPeriod>({ from: '', to: '' })
  const [type, setType] = useState<ExitType | ''>('')
  const [tab, setTab] = useState('Tất cả')
  const [sort, setSort] = useState<ExitSort>({ key: 'date', descending: true })
  const query = useQuery<ExitListResult>(() => herdExitApi.listPage({ ...applied, type }), [applied.from, applied.to, type])
  const result = query.data
  const shown: ExitPeriod = { from: period.from || result?.from || '', to: period.to || result?.to || '' }
  const periodError = shown.from && shown.to && shown.from > shown.to ? PERIOD_ERROR : ''
  const setPeriod = (next: ExitPeriod) => {
    setPeriodState(next)
    if (!(next.from && next.to && next.from > next.to)) setApplied(next)
  }
  const presets = exitPeriodPresets(today)
  const preset = presets.find((item) => item.from === shown.from && item.to === shown.to)?.value ?? 'custom'
  const choosePreset = (value: string) => {
    const match = presets.find((item) => item.value === value)
    if (match) setPeriod({ from: match.from, to: match.to })
  }
  const toggleSort = (key: ExitSort['key']) => setSort((current) => current.key === key ? { key, descending: !current.descending } : { key, descending: key === 'date' })
  const currentTab = EXIT_TABS.find((item) => item.value === tab) ?? EXIT_TABS[0]
  const action = (row: HerdExit): [string, string] => {
    if (!isOwner) return ['Xem', `/herd-exit/${encodeURIComponent(row.id)}`]
    if (row.status === 'Nháp') return ['Tiếp tục', `/herd-exit/new?id=${encodeURIComponent(row.id)}`]
    if (row.status === 'Chờ xác nhận') return ['Xem & xác nhận', `/herd-exit/${encodeURIComponent(row.id)}`]
    return ['Xem', `/herd-exit/${encodeURIComponent(row.id)}`]
  }
  return {
    result, loading: query.loading, error: query.error, retry: query.refetch,
    tab, setTab, tabs: EXIT_TABS.map((item) => ({ value: item.value, count: tabCount(result, item) })),
    period: shown, setPeriod, periodError, presets, preset, choosePreset,
    type, setType, sort, toggleSort,
    rows: sortExitRows((result?.vouchers ?? []).filter(currentTab.match), sort),
    action,
  }
}
