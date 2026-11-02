import { useState } from 'react'
import { DateInput, FilterSelect, Segmented } from '../../../components/ui'
import { HERD_GROUP_LABEL, HERD_GROUP_ORDER, LIFE_STAGES, LIFE_STAGE_LABEL, validateFilters } from '../domain/dashboardRules'
import type { DashboardFilters, HerdGroup, LifeStage, PenInfo } from '../types'

const PERIODS = [
  { value: '7', label: '7 ngày' }, { value: '30', label: '30 ngày' }, { value: '90', label: '90 ngày' }, { value: 'custom', label: 'Tùy chọn' },
]

export default function DashboardFilterBar({ filters, pens, onChange }: { filters: DashboardFilters; pens: PenInfo[]; onChange: (next: DashboardFilters) => void }) {
  const [customOpen, setCustomOpen] = useState(filters.period === 'custom')
  const [from, setFrom] = useState(filters.from ?? '')
  const [to, setTo] = useState(filters.to ?? '')
  const rangeError = customOpen && from && to ? validateFilters({ period: 'custom', from, to }) : null

  const pickPeriod = (value: string) => {
    if (value === 'custom') {
      setCustomOpen(true)
      if (from && to && !validateFilters({ period: 'custom', from, to })) onChange({ ...filters, period: 'custom', from, to })
      return
    }
    setCustomOpen(false)
    onChange({ ...filters, period: value as DashboardFilters['period'], from: undefined, to: undefined })
  }
  const setRange = (nextFrom: string, nextTo: string) => {
    setFrom(nextFrom)
    setTo(nextTo)
    if (nextFrom && nextTo && !validateFilters({ period: 'custom', from: nextFrom, to: nextTo })) onChange({ ...filters, period: 'custom', from: nextFrom, to: nextTo })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-bold text-muted">Kỳ</span>
        <Segmented options={PERIODS} value={customOpen ? 'custom' : filters.period} onChange={pickPeriod} />
        <FilterSelect aria-label="Chuồng" value={filters.pen ?? ''} onChange={(e) => onChange({ ...filters, pen: e.target.value })}>
          <option value="">Chuồng: Tất cả</option>
          {pens.map((p) => <option key={p.code} value={p.code}>{`Chuồng ${p.code} · ${p.name}`}</option>)}
        </FilterSelect>
        <FilterSelect aria-label="Nhóm đàn" value={filters.herdGroup ?? ''} onChange={(e) => onChange({ ...filters, herdGroup: e.target.value as HerdGroup | '' })}>
          <option value="">Nhóm đàn: Tất cả</option>
          {HERD_GROUP_ORDER.map((g) => <option key={g} value={g}>{`Nhóm đàn: ${HERD_GROUP_LABEL[g]}`}</option>)}
        </FilterSelect>
        <FilterSelect aria-label="Giai đoạn" value={filters.lifeStage ?? ''} onChange={(e) => onChange({ ...filters, lifeStage: e.target.value as LifeStage | '' })}>
          <option value="">Giai đoạn: Tất cả</option>
          {LIFE_STAGES.map((s) => <option key={s} value={s}>{`Giai đoạn: ${LIFE_STAGE_LABEL[s]}`}</option>)}
        </FilterSelect>
      </div>
      {customOpen && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <label htmlFor="period-from">Từ</label>
          <DateInput id="period-from" value={from} onChange={(v) => setRange(v, to)} className="w-[150px]" />
          <label htmlFor="period-to">đến</label>
          <DateInput id="period-to" value={to} onChange={(v) => setRange(from, v)} className="w-[150px]" />
          {rangeError && <span role="alert" className="text-err-fg">{rangeError}</span>}
        </div>
      )}
    </div>
  )
}
