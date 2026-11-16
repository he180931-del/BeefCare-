import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { Metric } from '../../../components/ui'
import { fmtDec } from '../domain/format'
import type { DashboardView } from '../types'

const NO_DATA = 'Chưa có dữ liệu'
const tileCls = 'block rounded-md text-inherit no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand'

export function PrimaryMetrics({ view, filtersApplied = false }: { view: DashboardView; filtersApplied?: boolean }) {
  const { m01, m02, m03, m04 } = view.indicators
  const e = view.empty
  const breedNote = m01.breedBreakdown
    ? m01.breedBreakdown.length ? m01.breedBreakdown.map((breed) => `${breed.label} ${breed.count}`).join(' · ') : NO_DATA
    : `Zebu đỏ ${m01.zebu} · Lai Sind ${m01.sind}`
  const metricTile = (key: string, to: string | undefined, metric: ReactNode) => to
    ? <Link key={key} to={to} className={tileCls}>{metric}</Link>
    : <div key={key}>{metric}</div>
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metricTile('m01', filtersApplied ? undefined : '/cattle', <Metric dot="#4a9c6b" label="Bò đang nuôi" value={m01.total} note={e ? NO_DATA : breedNote} />)}
      {metricTile('m02', filtersApplied ? undefined : '/suc-khoe', <Metric dot="#cc6b5c" label="Cần chú ý sức khỏe" value={m02.total} note={e ? NO_DATA : `${m02.treating} đang điều trị · ${m02.withdrawal} đang ngưng thịt`} />)}
      {metricTile('m03', filtersApplied ? undefined : '/tiem-phong', <Metric dot="#d6a34d" label="Mũi tiêm đến hạn 7 ngày" value={m03.total ?? '—'} note={m03.total === null ? 'Không áp dụng bộ lọc hiện tại cho chỉ số này' : e ? NO_DATA : `${m03.overdue} quá hạn`} />)}
      {metricTile('m04', filtersApplied ? undefined : '/sinh-san', <Metric dot="#52a8a1" label="Dự kiến đẻ 30 ngày" value={m04.total} note={e ? NO_DATA : `${m04.within7} trong 7 ngày tới`} />)}
    </div>
  )
}

export function SecondaryMetrics({ view, periodLabel, filtersApplied = false }: { view: DashboardView; periodLabel: string; filtersApplied?: boolean }) {
  const { m06, m07, m08, m09 } = view.indicators
  const adgSub = view.empty ? NO_DATA
    : m06.unavailable === 'PERIOD_TOO_SHORT' ? 'Cần kỳ từ 14 ngày để tính mức tăng cân'
      : m06.unavailable === 'NO_DATA' ? NO_DATA
        : m06.byGroup.map((g) => `${g.label} ${fmtDec(g.value)}`).join(' · ')
  const reproductionValue = (value: number | null, suffix: string) => value === null ? 'Chưa đủ dữ liệu' : `${fmtDec(value, suffix === '%' ? 1 : 0)}${suffix}`
  const reproductionSub = m09
    ? `Khoảng cách lứa đẻ: ${m09.calvingIntervalN ?? '—'} mẫu · Đậu thai ${m09.conceptionRateN !== undefined && m09.conceptionRateN < 3 ? 'chưa đủ dữ liệu' : reproductionValue(m09.conceptionRate, '%')} (${m09.conceptionRateN ?? '—'} mẫu) · ${m09.overdueFemales} cái quá hạn`
    : NO_DATA
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric compact label={`Mức tăng cân bình quân trong kỳ (${periodLabel})`} value={m06.value === null ? '—' : `${fmtDec(m06.value)} kg/ngày`} sub={adgSub} link={view.empty || filtersApplied ? undefined : { label: 'Xem danh sách cân →', to: '/can-nang' }} />
      <Metric compact label="Quá hạn cân" value={m07 ? `${m07.total} con` : '—'} sub={m07 ? 'Số bò đã quá ngày cần cân' : NO_DATA} link={m07 && !filtersApplied ? { label: 'Mở danh sách cân →', to: '/can-nang' } : undefined} />
      <Metric compact label="Lấp đầy chuồng" value={m08 ? `${m08.head} / ${m08.capacity}` : '—'} sub={m08 ? `${m08.percent}% sức chứa · ${m08.fullPens} chuồng đầy` : view.indicators.m08Unavailable ? 'Không áp dụng với bộ lọc nhóm đàn hoặc giai đoạn' : NO_DATA} link={m08 && !filtersApplied ? { label: 'Xem chuồng →', to: '/pens' } : undefined} />
      <Metric compact label="Sinh sản 12 tháng" value={m09 ? reproductionValue(m09.calvingIntervalDays, ' ngày') : '—'} sub={reproductionSub} link={m09 && !filtersApplied ? { label: 'Xem báo cáo sinh sản →', to: '/bao-cao?loai=RPT-05' } : undefined} />
    </div>
  )
}
