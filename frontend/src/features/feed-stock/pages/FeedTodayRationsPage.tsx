import { useState } from 'react'
import { Link } from 'react-router-dom'
import TechnicianLayout from '../../../components/TechnicianLayout'
import { userFacingError } from '../../../api/userFacingError'
import { useQuery } from '../../../hooks/useApi'
import { listFeedFeedingRecords } from '../api/feedFeedingApi'
import { listFeedRationPens, listFeedRations } from '../api/feedRationApi'
import { listFeedStock } from '../api/feedStockApi'
import { buildTodayRationPens, effectiveRationForPen, sessionsForToday, TODAY_SESSION_LABELS } from '../data/feedTodayRations'
import { sessionTimeFor } from '../domain/feedPlan'
import { formatDate, formatNumber } from '../domain/feedLabels'

type TodayData = Awaited<ReturnType<typeof loadTodayData>>
const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

function localToday() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

async function loadTodayData(date: string) {
  const [rations, pens, records, stock] = await Promise.all([
    listFeedRations(),
    listFeedRationPens(),
    listFeedFeedingRecords({ from: date, to: date }),
    listFeedStock(),
  ])
  return { rations, pens, records, stock }
}

function recordedTime(recordedAt: string | null, time: string | null) {
  if (time) return time.slice(0, 5)
  if (!recordedAt) return null
  const date = new Date(recordedAt)
  return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(date)
}

/** SCR-86 (phone): today's feeding plan of each pen for one session; read-only for the technician. */
export default function FeedTodayRationsPage() {
  const [date] = useState(localToday)
  const [sessionNo, setSessionNo] = useState(1)
  const query = useQuery(() => loadTodayData(date), [date])
  const data: TodayData | null = query.data
  const activePens = data?.pens.filter((pen) => pen.status === 'ACTIVE' && pen.headcount > 0) ?? []
  const sessions = data ? sessionsForToday(data.pens, data.rations, date) : []
  const effective = data ? activePens.flatMap((pen) => effectiveRationForPen(data.rations, pen.id, date) ?? []) : []
  const safeSessionNo = sessions.includes(sessionNo) ? sessionNo : sessions[0] ?? 1
  const rows = data ? buildTodayRationPens({ ...data, date, sessionNo: safeSessionNo }) : []
  const error = query.error ? userFacingError(query.error, 'Không thể tải khẩu phần hôm nay.') : null
  const sub = `${WEEKDAYS[new Date(`${date}T00:00:00`).getDay()]}, ${formatDate(date)}${data ? ` · ${activePens.length} chuồng` : ''} · chỉ xem`

  return (
    <TechnicianLayout title="Khẩu phần hôm nay" sub={sub} back="/kt">
      {sessions.length > 0 && (
        <div role="tablist" aria-label="Cữ cho ăn hôm nay" className="inline-flex gap-[3px] rounded-[5px] bg-chip p-[3px]">
          {sessions.map((number) => {
            const selected = safeSessionNo === number
            return (
              <button key={number} type="button" role="tab" aria-selected={selected} onClick={() => setSessionNo(number)} className={`flex-1 cursor-pointer whitespace-nowrap rounded border px-3 py-[7px] text-xs ${selected ? 'border-faint bg-white font-semibold text-[#212121]' : 'border-transparent text-muted'}`}>
                Cữ {TODAY_SESSION_LABELS[number]?.toLocaleLowerCase('vi') ?? number} {sessionTimeFor(effective, number)}
              </button>
            )
          })}
        </div>
      )}

      {query.loading && !data && <div role="status" className="rounded-lg border border-edge bg-white p-7 text-center text-sm text-muted">Đang tải khẩu phần hôm nay…</div>}
      {error && (
        <div role="alert" className="rounded-lg border border-err-bg bg-white p-4 text-sm text-err-fg">
          <p className="m-0">{error}</p>
          <button type="button" disabled={query.loading} onClick={() => query.refetch()} className="mt-3 cursor-pointer rounded bg-brand px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Thử tải lại</button>
        </div>
      )}
      {!query.loading && !error && data && rows.length === 0 && <div className="rounded-lg border border-edge bg-white p-5 text-center text-sm text-muted">Chưa có chuồng hoạt động có đầu con để xem khẩu phần.</div>}
      {!query.loading && !error && data && rows.length > 0 && (
        <div className="flex flex-col gap-3">
          {rows.map(({ pen, ration, record, lines, plannedTotalKg, hasSession }) => {
            const time = record ? recordedTime(record.recordedAt, record.time) : null
            const short = lines.some((line) => line.outOfStock)
            return (
              <article key={pen.id} className="flex flex-col gap-1 rounded-lg border border-field bg-white px-[13px] py-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="m-0 min-w-0 truncate text-sm font-semibold text-[#212121]">{pen.name}</h3>
                  <span className={`shrink-0 rounded-full px-2.5 py-[3px] text-[10px] font-medium ${!hasSession ? 'bg-chip text-muted' : record ? 'bg-ok-bg text-ok-fg' : 'bg-warn-bg text-warn-fg'}`}>
                    {!hasSession ? 'Không có cữ' : record ? `Đã ghi${time ? ` ${time}` : ''}` : 'Chưa ghi'}
                  </span>
                </div>
                <p className="m-0 text-[11px] text-muted">{pen.headcount} con{ration ? ` · ${ration.rationCode}` : ' · Chưa có khẩu phần hiệu lực'}</p>
                {hasSession && lines.length > 0 && (
                  <>
                    <p className={`m-0 text-xs ${short ? 'text-err-fg' : 'text-[#183528]'}`}>
                      {lines.map((line) => `${line.name} ${formatNumber(line.plannedKg)}`).join(' · ')} kg{short ? ' (hết kho)' : ''}
                    </p>
                    <p className="m-0 text-xs font-semibold text-brand">Kế hoạch cữ: {formatNumber(plannedTotalKg)} kg</p>
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
