import { Link } from 'react-router-dom'
import { Metric } from '../../../components/ui'
import { fmtDec } from '../domain/format'
import type { DashboardView } from '../types'

const NO_DATA = 'Chưa có dữ liệu'
const tileCls = 'block rounded-md text-inherit no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand'

export function PrimaryMetrics({ view }: { view: DashboardView }) {
  const { m01, m02, m03, m04 } = view.indicators
  const e = view.empty
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Link to="/cattle" className={tileCls}><Metric dot="#4a9c6b" label="Bò đang nuôi" value={m01.total} note={e ? NO_DATA : `Zebu đỏ ${m01.zebu} · Lai Sind ${m01.sind}`} /></Link>
      <Link to="/suc-khoe" className={tileCls}><Metric dot="#cc6b5c" label="Cần chú ý sức khỏe" value={m02.total} note={e ? NO_DATA : `${m02.treating} đang điều trị · ${m02.withdrawal} đang ngưng thịt`} /></Link>
      <Link to="/tiem-phong" className={tileCls}><Metric dot="#d6a34d" label="Mũi tiêm đến hạn 7 ngày" value={m03.total} note={e ? NO_DATA : `${m03.overdue} quá hạn`} /></Link>
      <Link to="/sinh-san" className={tileCls}><Metric dot="#52a8a1" label="Dự kiến đẻ 30 ngày" value={m04.total} note={e ? NO_DATA : `${m04.within7} trong 7 ngày tới`} /></Link>
    </div>
  )
}

export function SecondaryMetrics({ view, periodLabel }: { view: DashboardView; periodLabel: string }) {
  const { m06, m07, m08, m09 } = view.indicators
  const adgSub = view.empty ? NO_DATA
    : m06.unavailable === 'PERIOD_TOO_SHORT' ? 'Cần kỳ từ 14 ngày để tính ADG'
      : m06.unavailable === 'NO_DATA' ? NO_DATA
        : m06.byGroup.map((g) => `${g.label} ${fmtDec(g.value)}`).join(' · ')
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric compact label={`ADG trong kỳ (${periodLabel})`} value={m06.value === null ? '—' : `${fmtDec(m06.value)} kg/ngày`} sub={adgSub} link={view.empty ? undefined : { label: 'Xem theo chuồng →', to: '/can-nang' }} />
      <Metric compact label="Quá hạn cân" value={m07 ? `${m07.total} con` : '—'} sub={m07 ? 'Nhắc cân REM-01 đã quá hạn' : NO_DATA} link={m07 ? { label: 'Mở danh sách →', to: '/can-nang' } : undefined} />
      <Metric compact label="Lấp đầy chuồng" value={m08 ? `${m08.head} / ${m08.capacity}` : '—'} sub={m08 ? `${m08.percent}% sức chứa · ${m08.fullPens} chuồng đầy` : NO_DATA} link={m08 ? { label: 'Xem chuồng →', to: '/pens' } : undefined} />
      <Metric compact label="Sinh sản 12 tháng" value={m09 ? `${m09.calvingIntervalDays} ngày` : '—'} sub={m09 ? `KC lứa đẻ · Đậu thai ${m09.conceptionRate}% · ${m09.overdueFemales} cái quá hạn` : NO_DATA} link={m09 ? { label: 'Báo cáo RPT-05 →', to: '/bao-cao?loai=RPT-05' } : undefined} />
    </div>
  )
}
