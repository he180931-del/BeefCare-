import { businessDate, DEFAULT_FARM_TIME_ZONE, parseBusinessTime } from '../../../shared/lib/date/farmTime'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import TechnicianLayout from '../../../app/layouts/TechnicianLayout'
import { userFacingError } from '../../../shared/api/userFacingError'
import { buildTodayRationPens, effectiveRationForPen, sessionsForToday, TODAY_SESSION_LABELS } from '../domain/feedTodayRations'
import { sessionTimeFor } from '../domain/feedPlan'
import { formatDate, formatNumber } from '../domain/feedLabels'
import { useFeedTodayRations, type FeedTodayRationsData } from '../hooks/useFeedTodayRations'

type TodayData = FeedTodayRationsData
const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

function recordedTime(recordedAt: string | null, time: string | null) {
  if (time) return time.slice(0, 5)
  if (!recordedAt) return null
  const date = new Date(parseBusinessTime(recordedAt))
  return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat('vi-VN', { timeZone: DEFAULT_FARM_TIME_ZONE, hour: '2-digit', minute: '2-digit' }).format(date)
}

/** SCR-86 (phone): today's feeding plan of each pen for one session; read-only for the technician. */
export default function FeedTodayRationsPage() {
  const [date] = useState(businessDate)
  const [sessionNo, setSessionNo] = useState(1)
  const query = useFeedTodayRations(date)
  const data: TodayData | null = query.today
  const activePens = data?.pens.filter((pen) => pen.status === 'ACTIVE' && pen.headcount > 0) ?? []
  const sessions = data ? sessionsForToday(data.pens, data.rations, date) : []
  const effective = data ? activePens.flatMap((pen) => effectiveRationForPen(data.rations, pen.id, date) ?? []) : []
  const safeSessionNo = sessions.includes(sessionNo) ? sessionNo : sessions[0] ?? 1
  const rows = data ? buildTodayRationPens({ ...data, date, sessionNo: safeSessionNo }) : []
  const error = query.error ? userFacingError(query.error, 'Không thể tải khẩu phần hôm nay.') : null
  const sub = `${WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]}, ${formatDate(date)}${data ? ` · ${activePens.length} chuồng` : ''} · chỉ xem`

  return (
    <TechnicianLayout title="Khẩu phần hôm nay" sub={sub} back="/kt">
      {sessions.length > 0 && (
        <div role="tablist" aria-label="Cữ cho ăn hôm nay" className="flex w-full gap-[3px] rounded-lg bg-chip p-[3px]">
          {sessions.map((number) => {
            const selected = safeSessionNo === number
            return (
              <button key={number} type="button" role="tab" aria-selected={selected} onClick={() => setSessionNo(number)} className={`min-h-11 flex-1 cursor-pointer whitespace-nowrap rounded-md border px-3 py-[7px] text-xs ${selected ? 'border-faint bg-white font-semibold text-[#212121]' : 'border-transparent text-muted'}`}>
                Cữ {TODAY_SESSION_LABELS[number]?.toLocaleLowerCase('vi') ?? number} {sessionTimeFor(effective, number)}
              </button>
            )
          })}
        </div>
      )}

      {query.loading && !data && <div role="status" className="rounded-2xl border border-field bg-white p-7 text-center text-sm text-muted">Đang tải khẩu phần hôm nay…</div>}
      {error && (
        <div role="alert" className="rounded-2xl border border-err-bg bg-white p-4 text-sm text-err-fg">
          <p className="m-0">{error}</p>
          <button type="button" disabled={query.loading} onClick={() => query.refetch()} className="mt-3 min-h-11 cursor-pointer rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">Thử tải lại</button>
        </div>
      )}
      {!query.loading && !error && data && rows.length === 0 && <div className="rounded-2xl border border-field bg-white p-5 text-center text-sm text-muted">Chưa có chuồng hoạt động có đầu con để xem khẩu phần.</div>}
      {!query.loading && !error && data && rows.length > 0 && (
        <div className="flex flex-col gap-3">
          {rows.map(({ pen, ration, record, lines, plannedTotalKg, hasSession }) => {
            const time = record ? recordedTime(record.recordedAt, record.time) : null
            const short = lines.some((line) => line.outOfStock)
            return (
              <article key={pen.id} className="flex flex-col gap-1 rounded-2xl border border-field bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="m-0 min-w-0 truncate text-[15px] font-semibold text-[#212121]">{pen.name}</h3>
                  <span className={`shrink-0 rounded-full px-2.5 py-[3px] text-[10px] font-medium ${!hasSession ? 'bg-chip text-muted' : record ? 'bg-ok-bg text-ok-fg' : 'bg-warn-bg text-warn-fg'}`}>
                    {!hasSession ? 'Không có cữ' : record ? `Đã ghi${time ? ` ${time}` : ''}` : 'Chưa ghi'}
                  </span>
                </div>
                <p className="m-0 text-[11px] text-muted">{pen.headcount} con{ration ? ` · ${ration.rationCode}` : ' · Chưa có khẩu phần hiệu lực'}</p>
                {hasSession && lines.length > 0 && (
                  <>
                    <p className={`m-0 text-[13px] ${short ? 'text-err-fg' : 'text-[#183528]'}`}>
                      {lines.map((line) => `${line.name} ${formatNumber(line.plannedKg)}`).join(' · ')} kg{short ? ' (hết kho)' : ''}
                    </p>
                    <p className="m-0 text-[13px] font-semibold text-brand">Kế hoạch cữ: {formatNumber(plannedTotalKg)} kg</p>
                  </>
                )}
                {hasSession && lines.length === 0 && <p className="m-0 text-xs text-muted">Khẩu phần không có lượng thức ăn cho cữ này.</p>}
              </article>
            )
          })}
        </div>
      )}

      <p className="m-0 text-[11px] text-muted">Chỉ xem – Quản lý ghi cữ cho ăn. Báo Quản lý khi thiếu thức ăn.</p>
      <Link to={`/thuc-an/nhat-ky?date=${encodeURIComponent(date)}&readOnly=1`} className="text-xs font-semibold text-brand underline decoration-[#b6d4bf] underline-offset-2">
        Nhật ký cho ăn ↗
      </Link>
    </TechnicianLayout>
  )
}
