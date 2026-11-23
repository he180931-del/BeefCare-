import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useQuery } from '../../../shared/hooks/useQuery'
import { herdExitApi } from '../api/index'
import type { HerdExit, ExitType } from '../types'

export const EXIT_TABS: Array<{ value: string; match: (row: HerdExit) => boolean }> = [
  { value: 'Tất cả', match: () => true },
  { value: 'Nháp', match: (row) => row.status === 'Nháp' },
  { value: 'Chờ xác nhận', match: (row) => row.status === 'Chờ xác nhận' },
  { value: 'Đã xuất', match: (row) => row.status === 'Đã xuất' },
  { value: 'Đã hủy / bác', match: (row) => row.status === 'Đã hủy' || row.status === 'Đã bác' },
]

export const EXIT_RANGES = [
  { value: 'all', label: '01/07/2026 – 22/10/2026', from: '2026-07-01' },
  { value: 'oct', label: '01/10/2026 – 22/10/2026', from: '2026-10-01' },
] as const

export function filterExitRows(rows: ReadonlyArray<HerdExit>, tab: typeof EXIT_TABS[number], range: string, type: string): HerdExit[] {
  const from = EXIT_RANGES.find((item) => item.value === range)?.from ?? EXIT_RANGES[0].from
  return rows.filter((row) => tab.match(row) && (!type || row.type === type) && (row.date ?? '') >= from)
}

export function summarizeExitRows(rows: ReadonlyArray<HerdExit>) {
  const done = rows.filter((row) => row.status === 'Đã xuất')
  const owed = done.filter((row) => (row.due ?? 0) > 0)
  const byType = Object.fromEntries((['Bán', 'Loại thải', 'Chết / mất', 'Khác'] as ExitType[]).map((type) => [type, done.filter((row) => row.type === type).reduce((sum, row) => sum + (row.count ?? 0), 0)])) as Record<ExitType, number>
  return {
    doneCount: done.reduce((sum, row) => sum + (row.count ?? 0), 0),
    doneVoucherCount: done.length,
    revenue: done.reduce((sum, row) => sum + (row.total || 0), 0),
    owed: owed.reduce((sum, row) => sum + (row.due ?? 0), 0),
    owedCount: owed.length,
    firstOwedId: owed[0]?.id,
    pendingCount: rows.filter((row) => row.status === 'Chờ xác nhận').length,
    byType,
  }
}

export function useExitList(isOwner: boolean) {
  const { data, loading, error } = useQuery<HerdExit[]>(() => herdExitApi.list(), [])
  const rows = data ?? []
  const nav = useNavigate()
  const [tab, setTab] = useState('Tất cả')
  const [range, setRange] = useState('all')
  const [type, setType] = useState('')
  const currentTab = EXIT_TABS.find((item) => item.value === tab) ?? EXIT_TABS[0]
  const summary = summarizeExitRows(rows)
  const action = (row: HerdExit): [string, string] => {
    if (!isOwner) return ['Xem', `/herd-exit/${row.id}`]
    if (row.status === 'Nháp') return ['Tiếp tục', `/herd-exit/new?id=${encodeURIComponent(row.id)}`]
    if (row.status === 'Chờ xác nhận') return ['Xem & xác nhận', `/herd-exit/${row.id}`]
    return ['Xem', `/herd-exit/${row.id}`]
  }
  return {
    data: rows, loading, error, tab, setTab, range, setRange, type, setType,
    rows: filterExitRows(rows, currentTab, range, type), tabs: EXIT_TABS, ranges: EXIT_RANGES,
    summary, action,
  }
}
