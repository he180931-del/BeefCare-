import { useState } from 'react'
import { Link } from 'react-router-dom'
import { backendMode } from '../../../api/backendTransport'
import { userFacingError } from '../../../api/userFacingError'
import { useQuery } from '../../../hooks/useApi'
import { listFeedFeedingRecords } from '../api/feedFeedingApi'
import { listFeedRationPens, listFeedRations } from '../api/feedRationApi'
import { listFeedStock } from '../api/feedStockApi'
import { buildTodayRationPens, effectiveRationForPen, sessionsForToday, TODAY_SESSION_LABELS } from '../data/feedTodayRations'
import type { FeedRation } from '../types/feedRation'

type TodayData = Awaited<ReturnType<typeof loadTodayData>>
const kg = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 })

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

function displayDate(date: string) {
  const parsed = new Date(`${date}T00:00:00`)
  return new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(parsed)
}

function rationSessionTime(rations: readonly FeedRation[], sessionNo: number) {
  const times = [...new Set(rations
    .filter((ration) => sessionNo <= ration.sessionsPerDay)
    .map((ration) => ration.sessionTimes?.[sessionNo - 1])
    .filter((time): time is string => Boolean(time)))]
  return times.length === 1 ? times[0] : times.length > 1 ? 'Giờ riêng từng khẩu phần' : null
}

function recordedTime(recordedAt: string | null, time: string | null) {
  if (time) return time.slice(0, 5)
  if (!recordedAt) return null
  const date = new Date(recordedAt)
  return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(date)
}

export default function FeedTodayRationsPage() {
  const [date] = useState(localToday)
  const [sessionNo, setSessionNo] = useState(1)
  const query = useQuery(() => loadTodayData(date), [date])
  const data: TodayData | null = query.data
  const activePens = data?.pens.filter((pen) => pen.status === 'ACTIVE' && pen.headcount > 0) ?? []
  const sessions = data ? sessionsForToday(data.pens, data.rations, date) : []
  const activeRations = data
    ? activePens.map((pen) => effectiveRationForPen(data.rations, pen.id, date)).filter((ration): ration is FeedRation => ration !== null)
    : []
  const safeSessionNo = sessions.includes(sessionNo) ? sessionNo : sessions[0] ?? 1
  const rows = data ? buildTodayRationPens({ ...data, date, sessionNo: safeSessionNo }) : []
  const error = query.error ? userFacingError(query.error, 'Không thể tải khẩu phần hôm nay.') : null

  return (
    <div className="min-h-screen bg-[#f3f6f3] text-[#21352a]">
      <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-[#fbfcfb] shadow-[0_0_28px_rgba(21,60,38,0.08)]">
        <header className="sticky top-0 z-10 border-b border-[#e6ece7] bg-white/95 px-5 pb-3 pt-[max(14px,env(safe-area-inset-top))] backdrop-blur">
          <div className="flex items-center gap-3">
            <Link to="/tong-quan" aria-label="Quay lại trang trại" className="flex size-9 items-center justify-center rounded-full bg-[#eef4ef] text-lg text-[#256541]">‹</Link>
            <div className="min-w-0 flex-1">
              <p className="m-0 text-[11px] font-medium uppercase tracking-[0.08em] text-[#71907b]">BeefCare · Kỹ thuật viên</p>
              <h1 className="m-0 truncate text-base font-bold text-[#174b2c]">Khẩu phần hôm nay</h1>
            </div>
            <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-full bg-[#eaf3ec] text-base">🐄</span>
          </div>
        </header>

        <main className="flex-1 px-4 pb-5 pt-4">
          <section aria-label="Tổng quan khẩu phần hôm nay" className="rounded-2xl bg-[#17613a] p-4 text-white shadow-sm">
            <p className="m-0 text-xs font-medium capitalize text-white/75">{displayDate(date)}</p>
            <div className="mt-2 flex items-end justify-between gap-3">
              <div>
                <p className="m-0 text-[25px] font-bold leading-tight">{data ? activePens.length : '—'} chuồng</p>
                <p className="m-0 mt-1 text-xs text-white/75">Chuồng đang hoạt động có đầu con</p>
              </div>
              <div className="rounded-xl bg-white/10 px-3 py-2 text-right">
                <p className="m-0 text-[10px] text-white/75">Cữ đang xem</p>
                <p className="m-0 text-sm font-bold">{TODAY_SESSION_LABELS[safeSessionNo] ?? '—'}</p>
              </div>
            </div>
          </section>

          {backendMode === 'local' && <p className="mb-0 mt-3 rounded-lg bg-[#edf5ee] px-3 py-2 text-[11px] text-[#527260]">Dữ liệu minh họa · chỉ xem</p>}

          <div className="mt-4 flex items-center justify-between gap-2">
            <h2 className="m-0 text-sm font-bold">Các cữ trong ngày</h2>
            <Link to={`/thuc-an/nhat-ky?date=${encodeURIComponent(date)}&readOnly=1`} className="whitespace-nowrap text-xs font-semibold text-[#17613a] underline decoration-[#b6d4bf] underline-offset-2">
              Nhật ký cho ăn ↗
            </Link>
          </div>

          {sessions.length > 0 && (
            <div role="tablist" aria-label="Cữ cho ăn hôm nay" className="mt-3 grid grid-cols-3 gap-2">
              {sessions.map((number) => {
                const selected = safeSessionNo === number
                const time = rationSessionTime(activeRations, number)
                return (
                  <button key={number} type="button" role="tab" aria-selected={selected} onClick={() => setSessionNo(number)} className={`min-h-14 rounded-xl border px-2 py-2 text-center transition ${selected ? 'border-[#17613a] bg-[#eaf4ed] text-[#174b2c] shadow-sm' : 'border-[#e2e9e3] bg-white text-[#687a6d]'}`}>
                    <span className="block text-xs font-bold">Cữ {TODAY_SESSION_LABELS[number]?.toLocaleLowerCase('vi') ?? number}</span>
                    <span className="mt-0.5 block text-[10px]">{time ?? 'Chưa có giờ'}</span>
                  </button>
                )
              })}
            </div>
          )}

          <div className="mt-3 flex items-center justify-between px-1 text-[11px] text-[#748579]">
            <span>{sessions.length ? `Kế hoạch cữ ${TODAY_SESSION_LABELS[safeSessionNo]?.toLowerCase()}` : 'Kế hoạch theo chuồng'}</span>
            <span>{data ? `${rows.length} chuồng` : 'Đang tải'}</span>
          </div>

          {query.loading && !data && <div role="status" className="mt-3 rounded-xl border border-[#e5ebe6] bg-white p-7 text-center text-sm text-[#6d7c70]">Đang tải khẩu phần hôm nay…</div>}
          {error && <div role="alert" className="mt-3 rounded-xl border border-[#f2d2c8] bg-white p-4 text-sm text-[#8a3323]"><p className="m-0">{error}</p><button type="button" disabled={query.loading} onClick={() => query.refetch()} className="mt-3 rounded-lg bg-[#17613a] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Thử tải lại</button></div>}
          {!query.loading && !error && data && rows.length === 0 && <div className="mt-3 rounded-xl border border-[#e5ebe6] bg-white p-5 text-center text-sm text-[#6d7c70]">Chưa có chuồng hoạt động có đầu con để xem khẩu phần.</div>}
          {!query.loading && !error && data && rows.length > 0 && (
            <div className="mt-3 flex flex-col gap-2.5">
              {rows.map(({ pen, ration, record, lines, plannedTotalKg, hasSession }) => {
                const time = record ? recordedTime(record.recordedAt, record.time) : null
                return (
                  <article key={pen.id} className="rounded-2xl border border-[#e4ebe5] bg-white p-3.5 shadow-[0_2px_8px_rgba(23,70,42,0.035)]">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="m-0 truncate text-sm font-bold text-[#263d2d]">{pen.code} · {pen.name}</h3>
                        <p className="m-0 mt-1 text-[11px] text-[#718075]">{pen.headcount} con{ration ? ` · ${ration.rationCode} v${ration.versionNo}` : ' · Chưa có khẩu phần hiệu lực'}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${!hasSession ? 'bg-[#f1f3f1] text-[#68746b]' : record ? 'bg-[#e8f4eb] text-[#267242]' : 'bg-[#fff3dd] text-[#93620a]'}`}>
                        {!hasSession ? 'Không có cữ' : record ? `Đã ghi${time ? ` ${time}` : ''}` : 'Chưa ghi'}
                      </span>
                    </div>
                    {hasSession && lines.length > 0 ? (
                      <div className="mt-3 border-t border-dashed border-[#e4ebe5] pt-2.5">
                        {lines.map((line) => (
                          <div key={line.feedItemId} className="flex items-center justify-between gap-2 py-1 text-xs">
                            <span className="min-w-0 truncate text-[#516355]">{line.code} · {line.name}{line.outOfStock && <span className="ml-1.5 rounded bg-[#fff0e8] px-1.5 py-0.5 text-[9px] font-semibold text-[#a24926]">Hết kho</span>}</span>
                            <span className="shrink-0 font-semibold text-[#334b38]">{kg.format(line.plannedKg)} kg</span>
                          </div>
                        ))}
                        <div className="mt-1 flex items-center justify-between border-t border-[#edf1ed] pt-2 text-xs font-bold text-[#174b2c]">
                          <span>Tổng kế hoạch cữ</span><span>{kg.format(plannedTotalKg)} kg</span>
                        </div>
                      </div>
                    ) : hasSession ? (
                      <p className="mb-0 mt-3 border-t border-dashed border-[#e4ebe5] pt-2.5 text-xs text-[#718075]">Khẩu phần không có lượng thức ăn cho cữ này.</p>
                    ) : null}
                  </article>
                )
              })}
            </div>
          )}

          <aside className="mt-4 rounded-xl border border-[#e8eee9] bg-[#f2f6f2] p-3 text-[11px] leading-relaxed text-[#65776a]">
            <strong className="text-[#385842]">Chỉ xem.</strong> Quản lý ghi nhận cữ cho ăn. Nếu phát hiện thiếu thức ăn, hãy báo Quản lý.
          </aside>
        </main>

        <nav aria-label="Điều hướng kỹ thuật viên" className="sticky bottom-0 grid grid-cols-5 border-t border-[#e4ebe5] bg-white/95 px-1 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 backdrop-blur">
          {[
            { label: 'Trang trại', to: '/tong-quan', glyph: '⌂' },
            { label: 'Đàn bò', to: '/cattle', glyph: '♧' },
            { label: 'Quét QR', to: '/cattle/scan', glyph: '▦' },
            { label: 'Sinh sản', to: '/sinh-san', glyph: '♡' },
            { label: 'Thức ăn', to: '/thuc-an/hom-nay', glyph: '◉' },
          ].map((item) => (
            <Link key={item.to} to={item.to} aria-current={item.to === '/thuc-an/hom-nay' ? 'page' : undefined} className={`flex min-h-12 flex-col items-center justify-center gap-0.5 text-[9px] font-medium ${item.to === '/thuc-an/hom-nay' ? 'text-[#17613a]' : 'text-[#87938a]'}`}>
              <span aria-hidden="true" className="text-base leading-none">{item.glyph}</span>{item.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  )
}
