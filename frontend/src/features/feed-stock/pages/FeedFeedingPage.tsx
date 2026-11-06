import { useMemo, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { Icon } from '../../../components/Icon'
import { useModalParam } from '../../../components/Modal'
import { Badge, Button, Card, Foot, Metric, Note, PageHeader, Segmented, Select, Table, Td, Th } from '../../../components/ui'
import { backendMode } from '../../../api/backendTransport'
import { userFacingError } from '../../../api/userFacingError'
import { useQuery } from '../../../hooks/useApi'
import { useSession } from '../../authorization'
import { listFeedFeedingRecords } from '../api/feedFeedingApi'
import { listFeedReceipts } from '../api/feedReceiptApi'
import { listFeedRationFeeds, listFeedRationPens, listFeedRations } from '../api/feedRationApi'
import { effectiveRationForPen } from '../data/feedTodayRations'
import { planForSession, SESSION_NAMES, sessionTimeFor, shortPersonName } from '../domain/feedPlan'
import { formatDate, formatKg, formatNumber } from '../domain/feedLabels'
import FeedManagementTabs from '../components/FeedManagementTabs'
import { FeedCorrectDialog, FeedQuickFillDialog, FeedRecordDialog, type FeedingData } from '../components/FeedSessionDialogs'
import type { FeedFeedingRecord } from '../types/feedFeeding'
import type { FeedRation, FeedRationPenOption } from '../types/feedRation'
import type { FeedStockRow } from '../types'

type PeriodView = 'DAY' | 'WEEK'
const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const pad = (value: number) => String(value).padStart(2, '0')
const formatIso = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const today = () => formatIso(new Date())
const isCalendarDate = (value: string | null): value is string => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00`)
  return !Number.isNaN(date.getTime()) && formatIso(date) === value
}
const shiftDate = (iso: string, days: number) => {
  const date = new Date(`${iso}T00:00:00`)
  date.setDate(date.getDate() + days)
  return formatIso(date)
}
const dateLabel = (iso: string) => `${WEEKDAYS[new Date(`${iso}T00:00:00`).getDay()]}, ${formatDate(iso)}`

function periodRange(selectedDate: string, view: PeriodView) {
  if (view === 'DAY') return { from: selectedDate, to: selectedDate }
  const date = new Date(`${selectedDate}T00:00:00`)
  date.setDate(date.getDate() - (date.getDay() || 7) + 1)
  const from = formatIso(date)
  date.setDate(date.getDate() + 6)
  return { from, to: formatIso(date) }
}

function daysBetween(from: string, to: string, until: string) {
  const end = to < until ? to : until
  const days: string[] = []
  for (let day = from; day <= end; day = shiftDate(day, 1)) days.push(day)
  return days
}

/** Whole kilograms from 10 kg up, one decimal below ("158 → 155 kg", "7,5 → 6 kg"). */
const kgCell = (value: number) => formatNumber(value, value >= 10 ? 0 : 1)

type CellInfo = { text: string; tone?: 'err' }
/** Small line under a recorded cell: time and who fed, the shortfall note, or what was corrected. */
function cellNotes(record: FeedFeedingRecord): CellInfo[] {
  const lines: CellInfo[] = []
  const fedByOther = record.fedBy && record.recordedBy && record.fedBy !== record.recordedBy
  lines.push({ text: `${record.time ?? '—'}${fedByOther ? ` · ${record.fedBy} cho ăn` : ''}` })
  if (record.note) lines.push({ text: record.note, tone: /hết kho/i.test(record.note) ? 'err' : undefined })
  if (record.revisions.length) {
    const short = record.lines.filter((line) => line.plannedKg > 0 && line.actualKg !== line.plannedKg && line.actualKg < line.plannedKg * 0.95)
    lines.push({ text: `${short.map((line) => `${line.feedName ?? line.feedCode} ${formatNumber(line.actualKg)} / ${formatNumber(line.plannedKg)} kg`).join(', ')}${short.length ? ' · ' : ''}đã sửa` })
  }
  return lines
}

export default function FeedFeedingPage() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const session = useSession()
  const [modal, openModal, closeModal] = useModalParam()
  const readOnlyView = searchParams.get('readOnly') === '1' || Boolean(session && session.role !== 'MANAGER')
  const canRecord = !readOnlyView && backendMode === 'local'
  const initialDate = searchParams.get('date')
  const routeMessage = typeof location.state === 'object' && location.state !== null && 'feedingMessage' in location.state
    ? String((location.state as { feedingMessage?: unknown }).feedingMessage ?? '')
    : ''
  const [view, setView] = useState<PeriodView>('DAY')
  const [selectedDate, setSelectedDate] = useState(() => isCalendarDate(initialDate) ? initialDate : today())
  const [penFilter, setPenFilter] = useState('ALL')
  const [sessionFilter, setSessionFilter] = useState('ALL')
  const [pending, setPending] = useState<{ penId?: number; sessionNo?: number } | null>(null)
  const [editing, setEditing] = useState<{ record: FeedFeedingRecord; action: 'correct' | 'void' } | null>(null)
  const [message, setMessage] = useState(routeMessage)
  const range = useMemo(() => periodRange(selectedDate, view), [selectedDate, view])
  const query = useQuery(async (): Promise<FeedingData & { receipts: Awaited<ReturnType<typeof listFeedReceipts>> }> => {
    const [records, rations, pens, feeds, receipts] = await Promise.all([
      listFeedFeedingRecords(range), listFeedRations(), listFeedRationPens(), listFeedRationFeeds(), listFeedReceipts().catch(() => []),
    ])
    return { records, rations, pens, feeds, receipts }
  }, [range.from, range.to])

  const data = query.data
  const pens = data?.pens ?? []
  const rations = data?.rations ?? []
  const records = data?.records ?? []
  const feeds = data?.feeds ?? []
  const isToday = selectedDate === today()
  const activePens = pens.filter((pen) => pen.status === 'ACTIVE' && pen.headcount > 0 && (penFilter === 'ALL' || String(pen.id) === penFilter))
  const maxSessions = Math.max(2, ...rations.map((ration) => ration.sessionsPerDay))
  const sessionNos = Array.from({ length: maxSessions }, (_, index) => index + 1).filter((sessionNo) => sessionFilter === 'ALL' || String(sessionNo) === sessionFilter)
  const filteredRecords = records.filter((record) => (penFilter === 'ALL' || String(record.penId) === penFilter) && (sessionFilter === 'ALL' || String(record.sessionNo) === sessionFilter))
  const validRecords = filteredRecords.filter((record) => record.status === 'VALID')
  const expectedDays = daysBetween(range.from, range.to, today())

  // Expected sessions and their plan over the viewed days; a pen without an effective ration expects nothing.
  const expected = { sessions: 0, plannedKg: 0, missing: [] as Array<{ pen: FeedRationPenOption; sessionNo: number }> }
  for (const date of expectedDays) {
    for (const pen of activePens) {
      const ration = effectiveRationForPen(rations, pen.id, date)
      if (!ration) continue
      for (const sessionNo of sessionNos.filter((value) => value <= ration.sessionsPerDay)) {
        expected.sessions += 1
        expected.plannedKg += planForSession(ration, pen, sessionNo).reduce((sum, line) => sum + line.plannedKg, 0)
        if (!validRecords.some((record) => record.penId === pen.id && record.feedingDate === date && record.sessionNo === sessionNo)) expected.missing.push({ pen, sessionNo })
      }
    }
  }
  const actualKg = validRecords.reduce((sum, record) => sum + record.actualTotalKg, 0)
  const recordedPlanned = validRecords.reduce((sum, record) => sum + record.plannedTotalKg, 0)
  const variance = recordedPlanned > 0 ? ((actualKg - recordedPlanned) / recordedPlanned) * 100 : null
  const costKnown = validRecords.every((record) => record.lines.every((line) => line.totalCost !== null))
  const deductedValue = validRecords.reduce((sum, record) => sum + record.lines.reduce((lineSum, line) => lineSum + (line.totalCost ?? 0), 0), 0)
  const missingText = (() => {
    const bySession = new Map<number, string[]>()
    expected.missing.forEach((item) => bySession.set(item.sessionNo, [...(bySession.get(item.sessionNo) ?? []), item.pen.code]))
    return [...bySession.entries()].map(([sessionNo, codes]) => ({ sessionNo, codes }))
  })()
  const usageByFeed = useMemo(() => {
    const totals = new Map<number, number>()
    for (const record of validRecords) for (const line of record.lines) totals.set(line.feedItemId, (totals.get(line.feedItemId) ?? 0) + line.actualKg)
    return feeds.filter((feed) => totals.has(feed.feedItemId)).map((feed) => ({ feed, usedKg: totals.get(feed.feedItemId) ?? 0 })).sort((a, b) => b.usedKg - a.usedKg)
  }, [feeds, validRecords])
  const lowFeeds = feeds.filter((feed) => feed.status === 'OUT_OF_STOCK' || feed.status === 'LOW' && feed.averageDailyUseKg > 0 && feed.onHandKg < feed.averageDailyUseKg)
  const draftReceipt = (data?.receipts ?? []).find((receipt) => receipt.status === 'DRAFT' && receipt.lines.some((line) => lowFeeds.some((feed) => feed.feedItemId === line.feedItemId)))
  const backendError = query.error ? userFacingError(query.error, 'Không thể tải nhật ký cho ăn.') : null
  const periodWord = view === 'WEEK' ? 'trong tuần' : isToday ? 'hôm nay' : `ngày ${formatDate(selectedDate)}`

  const finish = (nextMessage: string) => {
    setEditing(null)
    setPending(null)
    closeModal()
    setMessage(nextMessage)
    void query.refetch()
  }
  const startRecord = (penId?: number, sessionNo?: number) => { setPending({ penId, sessionNo }); openModal('ghi') }

  return (
    <Layout title="Thức ăn › Nhật ký cho ăn" user="manager">
      <PageHeader title="Nhật ký cho ăn" sub="Ghi theo chuồng và cữ · kế hoạch = khẩu phần × số con · lưu là trừ kho">
        {canRecord && <Button onClick={() => openModal('nhanh')}>Ghi nhanh theo khẩu phần</Button>}
        {!readOnlyView && (
          <Button variant="primary" disabled={backendMode === 'backend'} title={backendMode === 'backend' ? 'Ghi cữ chưa sẵn sàng ở chế độ kết nối.' : undefined} onClick={() => startRecord()}>
            <span className="inline-flex items-center gap-1.5"><Icon name="circle-plus" size={16} />Ghi cữ cho ăn</span>
          </Button>
        )}
      </PageHeader>
      <FeedManagementTabs />
      {message && <Note tone="ok">{message}</Note>}
      {readOnlyView && <Note tone="info">Chế độ chỉ xem. Quản lý ghi nhận, sửa và hủy cữ cho ăn.</Note>}
      {!readOnlyView && backendMode === 'backend' && <Note tone="warn">Xem nhật ký đã kết nối. Ghi, sửa và hủy cữ chưa sẵn sàng ở chế độ kết nối.</Note>}

      <section role="tabpanel" aria-label="Nhật ký cho ăn" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-11 items-center gap-1 rounded-xl border border-field bg-white px-2 text-sm">
            <button type="button" aria-label="Ngày trước" onClick={() => setSelectedDate(shiftDate(selectedDate, view === 'WEEK' ? -7 : -1))} className="grid size-7 cursor-pointer place-items-center rounded text-muted hover:bg-page"><Icon name="chevron-left" size={16} /></button>
            <label className="relative min-w-[130px] cursor-pointer text-center text-ink">
              {dateLabel(selectedDate)}
              <input type="date" aria-label="Ngày" max={today()} value={selectedDate} onChange={(event) => event.target.value && setSelectedDate(event.target.value)} className="absolute inset-0 size-full cursor-pointer opacity-0" />
            </label>
            <button type="button" aria-label="Ngày sau" disabled={shiftDate(selectedDate, view === 'WEEK' ? 7 : 1) > today() && view === 'DAY'} onClick={() => setSelectedDate(shiftDate(selectedDate, view === 'WEEK' ? 7 : 1))} className="grid size-7 cursor-pointer place-items-center rounded text-muted hover:bg-page disabled:cursor-not-allowed disabled:opacity-40"><Icon name="chevron-right" size={16} /></button>
          </div>
          <label className="sr-only" htmlFor="feeding-session-filter">Cữ</label>
          <Select id="feeding-session-filter" value={sessionFilter} onChange={(event) => setSessionFilter(event.target.value)} className="w-[150px]">
            <option value="ALL">Cữ: Tất cả</option>
            {Array.from({ length: maxSessions }, (_, index) => index + 1).map((sessionNo) => <option key={sessionNo} value={sessionNo}>Cữ {SESSION_NAMES[sessionNo]}</option>)}
          </Select>
          <label className="sr-only" htmlFor="feeding-pen-filter">Chuồng</label>
          <Select id="feeding-pen-filter" value={penFilter} onChange={(event) => setPenFilter(event.target.value)} className="w-[170px]">
            <option value="ALL">Chuồng: Tất cả</option>
            {pens.map((pen) => <option key={pen.id} value={pen.id}>{pen.code} · {pen.name}</option>)}
          </Select>
          <span className="flex-1" />
          <Segmented value={view} onChange={(value) => setView(value as PeriodView)} options={[{ value: 'DAY', label: 'Theo ngày' }, { value: 'WEEK', label: 'Theo tuần' }]} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric compact label={`Thực tế ${periodWord}`} value={formatKg(actualKg)} sub={`Kế hoạch ${view === 'WEEK' ? 'cả tuần' : 'cả ngày'} ${formatKg(expected.plannedKg, 0)}`} />
          <Metric compact warn={expected.missing.length > 0} label="Cữ đã ghi" value={`${validRecords.length} / ${expected.sessions}`} sub={missingText.length ? missingText.map(({ sessionNo, codes }) => `${codes.join(', ')} chưa ghi cữ ${SESSION_NAMES[sessionNo]}`).join(' · ') : 'Đã ghi đủ các cữ'} />
          <Metric compact label="Chênh lệch các cữ đã ghi" value={variance === null ? '—' : `${variance > 0 ? '+' : variance < 0 ? '−' : ''}${formatNumber(Math.abs(variance))}%`} sub={`${formatNumber(actualKg)} / ${formatNumber(recordedPlanned)} kg kế hoạch`} />
          <Metric compact label={`Đã trừ kho ${periodWord}`} value={formatKg(actualKg)} sub={costKnown ? `≈ ${formatNumber(deductedValue / 1_000_000)} triệu đ theo giá bình quân` : 'Chưa đủ giá để tính giá trị'} />
        </div>

        {query.loading && !data && <div role="status" className="rounded-md border border-edge bg-white p-8 text-center text-sm text-muted">Đang tải nhật ký…</div>}
        {backendError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-err-bg bg-white p-4 text-sm text-err-fg"><span>{backendError}</span><Button size="sm" disabled={query.loading} onClick={() => query.refetch()}>Thử tải lại</Button></div>}

        {data && !backendError && view === 'DAY' && (
          <DailyTable
            date={selectedDate}
            pens={activePens}
            records={filteredRecords}
            rations={rations}
            sessionNos={sessionNos}
            canRecord={canRecord}
            onRecord={startRecord}
            onEdit={(record, action) => { setEditing({ record, action }); openModal('sua') }}
          />
        )}
        {data && !backendError && view === 'WEEK' && (
          <WeeklyTable records={filteredRecords} feeds={feeds} canEdit={canRecord} onEdit={(record, action) => { setEditing({ record, action }); openModal('sua') }} />
        )}

        {data && !backendError && isToday && view === 'DAY' && expected.missing.length > 0 && (
          <Note tone="warn">
            Nhắc việc: {missingText.map(({ sessionNo, codes }) => `${codes.join(' và ')} chưa ghi cữ ${SESSION_NAMES[sessionNo]} (${sessionTimeFor(rations, sessionNo)})`).join('; ')}. Nhắc việc hiện cho Quản lý và Kỹ thuật viên.
          </Note>
        )}

        {data && !backendError && (
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,660px)_minmax(0,1fr)]">
            <Card title={`Tiêu thụ theo thức ăn ${periodWord}`} sub="Đã trừ kho theo các cữ đã ghi">
              {!usageByFeed.length ? <p className="m-0 text-xs text-muted">Chưa có lượng tiêu thụ trong khoảng này.</p> : (
                <Table scroll stack={false}>
                  <thead><tr><Th>Thức ăn</Th><Th>Thực tế</Th><Th>Tồn còn lại</Th><Th aria-label="Cảnh báo" /></tr></thead>
                  <tbody>
                    {usageByFeed.map(({ feed, usedKg }) => (
                      <tr key={feed.feedItemId}>
                        <Td className="font-medium">{feed.name}</Td>
                        <Td className="whitespace-nowrap">{formatKg(usedKg)}</Td>
                        <Td className="whitespace-nowrap">{formatKg(feed.onHandKg)}</Td>
                        <Td>{feed.status === 'OUT_OF_STOCK' ? <Badge tone="err">Hết</Badge> : feed.status === 'LOW' ? <Badge tone="warn" icon="alert-triangle">Sắp hết</Badge> : null}</Td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr><Td className="font-semibold">Tổng</Td><Td className="whitespace-nowrap font-semibold">{formatKg(usageByFeed.reduce((sum, row) => sum + row.usedKg, 0))}</Td><Td /><Td /></tr></tfoot>
                </Table>
              )}
            </Card>
            <div className="flex flex-col gap-3">
              {lowFeeds.length > 0 && (
                <Note tone="err">
                  {lowFeeds.map((feed) => feed.status === 'OUT_OF_STOCK' ? `${feed.name} đã hết` : `${feed.name} còn ${formatNumber(feed.onHandKg)} kg (< 1 ngày)`).join(' và ')} – {draftReceipt ? `lưu phiếu nhập kho ${draftReceipt.code} hoặc ` : ''}nhập thêm trước cữ sáng mai.
                </Note>
              )}
              {lowFeeds.length > 0 && (
                <Link to={draftReceipt ? `/thuc-an/phieu-nhap/${draftReceipt.id}` : '/thuc-an/phieu-nhap/moi'} className="rounded border border-edge bg-white px-4 py-[9px] text-center text-xs font-semibold text-ink no-underline hover:bg-page">
                  {draftReceipt ? `Mở phiếu nhập kho ${draftReceipt.code}` : 'Tạo phiếu nhập kho'}
                </Link>
              )}
              <Note>Thuốc trộn vào thức ăn được ghi trong ca sức khỏe, không ghi ở đây. Chủ trại và Kỹ thuật viên chỉ xem nhật ký; Quản lý ghi, sửa và hủy.</Note>
            </div>
          </div>
        )}
        <Note tone="info">Chỉ cữ hợp lệ làm giảm tồn kho. Hủy cữ sẽ hoàn lại lượng đã ghi; mọi lần sửa hoặc hủy đều lưu lý do trong lịch sử.</Note>
      </section>
      <Foot>Nhật ký cho ăn theo ngày. Mỗi ô cữ hiển thị kế hoạch → thực tế, giờ và người cho ăn; ô “Chưa ghi” mở nhanh hộp thoại ghi cữ. Nút ⋯ ở mỗi dòng để sửa hoặc hủy bản ghi. Tổng thực tế đã trừ kho; chênh lệch tính trên các cữ đã ghi.</Foot>

      {data && modal === 'ghi' && canRecord && <FeedRecordDialog key={`${pending?.penId ?? 'new'}-${pending?.sessionNo ?? 1}`} data={data} date={selectedDate} penId={pending?.penId} sessionNo={pending?.sessionNo} onClose={() => { setPending(null); closeModal() }} onSaved={finish} />}
      {data && modal === 'sua' && canRecord && editing && <FeedCorrectDialog key={`${editing.record.id}-${editing.action}`} data={data} record={editing.record} initialAction={editing.action} onClose={() => { setEditing(null); closeModal() }} onSaved={finish} />}
      {data && modal === 'nhanh' && canRecord && <FeedQuickFillDialog data={data} date={selectedDate} missing={expected.missing} onClose={closeModal} onSaved={finish} />}
    </Layout>
  )
}

function DailyTable({ date, pens, records, rations, sessionNos, canRecord, onRecord, onEdit }: {
  date: string
  pens: FeedRationPenOption[]
  records: FeedFeedingRecord[]
  rations: FeedRation[]
  sessionNos: number[]
  canRecord: boolean
  onRecord: (penId: number, sessionNo: number) => void
  onEdit: (record: FeedFeedingRecord, action: 'correct' | 'void') => void
}) {
  if (!pens.length) return <Note tone="info">Không có chuồng đang hoạt động trong bộ lọc này.</Note>
  const totals = { head: 0, actual: 0, plan: 0 }
  const body = pens.map((pen) => {
    const ration = effectiveRationForPen(rations, pen.id, date)
    const penRecords = records.filter((record) => record.penId === pen.id && record.status === 'VALID')
    const dayPlan = sessionNos.reduce((sum, sessionNo) => sum + planForSession(ration, pen, sessionNo).reduce((lineSum, line) => lineSum + line.plannedKg, 0), 0)
    const dayActual = penRecords.reduce((sum, record) => sum + record.actualTotalKg, 0)
    totals.head += pen.headcount
    totals.actual += dayActual
    totals.plan += dayPlan
    return { pen, ration, penRecords, dayPlan, dayActual }
  })
  return (
    <div className="rounded-md border border-edge bg-white p-px">
      <Table scroll stack={false}>
        <thead>
          <tr>
            <Th>Chuồng</Th><Th>Khẩu phần</Th>
            {sessionNos.map((sessionNo) => <Th key={sessionNo} className="whitespace-nowrap">Cữ {SESSION_NAMES[sessionNo]} {sessionTimeFor(rations, sessionNo)} · KH → TT</Th>)}
            <Th className="whitespace-nowrap">Cả ngày TT / KH</Th><Th>Người ghi</Th><Th aria-label="Thao tác" />
          </tr>
        </thead>
        <tbody>
          {body.map(({ pen, ration, penRecords, dayPlan, dayActual }) => (
            <tr key={pen.id}>
              <Td className="min-w-[110px]"><div className="font-medium">{pen.name}</div><div className="text-[11px] text-muted">{pen.headcount} con</div></Td>
              <Td className="whitespace-nowrap">{ration ? `${ration.rationCode}${rations.filter((row) => row.rationCode === ration.rationCode).length > 1 ? ` v${ration.versionNo}` : ''}` : '—'}</Td>
              {sessionNos.map((sessionNo) => {
                const record = penRecords.find((row) => row.sessionNo === sessionNo)
                const allowed = ration && sessionNo <= ration.sessionsPerDay
                if (!allowed) return <Td key={sessionNo} className="text-muted">—</Td>
                if (!record) {
                  return (
                    <Td key={sessionNo}>
                      {canRecord
                        ? <button type="button" aria-label={`Ghi cữ ${pen.code} ${SESSION_NAMES[sessionNo]}`} onClick={() => onRecord(pen.id, sessionNo)} className="cursor-pointer border-0 bg-transparent p-0"><Badge tone="warn">Chưa ghi</Badge></button>
                        : <Badge tone="warn">Chưa ghi</Badge>}
                    </Td>
                  )
                }
                return (
                  <Td key={sessionNo} className="min-w-[150px]">
                    <div className="whitespace-nowrap font-medium">{kgCell(record.plannedTotalKg)} → {kgCell(record.actualTotalKg)} kg</div>
                    {cellNotes(record).map((note, index) => <div key={index} className={`text-[11px] ${note.tone === 'err' ? 'text-err-fg' : 'text-muted'}`}>{note.text}</div>)}
                  </Td>
                )
              })}
              <Td className="whitespace-nowrap">{kgCell(dayActual)} / {kgCell(dayPlan)} kg</Td>
              <Td className="whitespace-nowrap">{penRecords.length ? shortPersonName(penRecords[0].recordedBy ?? penRecords[0].fedBy) : '—'}</Td>
              <Td>
                {canRecord && penRecords.length > 0 && (
                  <details className="relative">
                    <summary aria-label={`Thao tác ${pen.code}`} className="grid size-7 cursor-pointer list-none place-items-center rounded text-muted hover:bg-page [&::-webkit-details-marker]:hidden">⋯</summary>
                    <div role="menu" className="absolute right-0 top-8 z-20 flex min-w-[150px] flex-col rounded-md border border-edge bg-white py-1 text-xs shadow-md">
                      {penRecords.flatMap((record) => [
                        <button key={`c${record.id}`} type="button" role="menuitem" onClick={(event) => { event.currentTarget.closest('details')?.removeAttribute('open'); onEdit(record, 'correct') }} className="cursor-pointer whitespace-nowrap border-0 bg-transparent px-3 py-1.5 text-left hover:bg-page">Sửa cữ {SESSION_NAMES[record.sessionNo]}</button>,
                        <button key={`v${record.id}`} type="button" role="menuitem" onClick={(event) => { event.currentTarget.closest('details')?.removeAttribute('open'); onEdit(record, 'void') }} className="cursor-pointer whitespace-nowrap border-0 bg-transparent px-3 py-1.5 text-left text-err-fg hover:bg-page">Hủy cữ {SESSION_NAMES[record.sessionNo]}</button>,
                      ])}
                    </div>
                  </details>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <Td className="whitespace-nowrap font-semibold">{pens.length} chuồng · {totals.head} con</Td><Td />
            {sessionNos.map((sessionNo) => <Td key={sessionNo} />)}
            <Td className="whitespace-nowrap font-semibold">{formatNumber(totals.actual)} / {formatNumber(totals.plan, 0)} kg</Td><Td /><Td />
          </tr>
        </tfoot>
      </Table>
    </div>
  )
}

function WeeklyTable({ records, feeds, canEdit, onEdit }: {
  records: FeedFeedingRecord[]
  feeds: FeedStockRow[]
  canEdit: boolean
  onEdit: (record: FeedFeedingRecord, action: 'correct' | 'void') => void
}) {
  if (!records.length) return <Note tone="info">Chưa có cữ cho ăn trong tuần được chọn.</Note>
  return (
    <div className="rounded-md border border-edge bg-white p-px">
      <Table scroll stack={false}>
        <thead><tr><Th>Ngày / chuồng</Th><Th>Cữ</Th><Th>Thức ăn thực tế</Th><Th>Giờ / người cho ăn</Th><Th>Trạng thái</Th><Th aria-label="Thao tác" /></tr></thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id}>
              <Td className="whitespace-nowrap"><div className="font-medium">{formatDate(record.feedingDate)}</div><div className="text-[11px] text-muted">{record.penCode ?? `Chuồng ${record.penId}`} · {record.headCount} con</div></Td>
              <Td className="whitespace-nowrap">Cữ {SESSION_NAMES[record.sessionNo] ?? record.sessionNo}</Td>
              <Td>{record.lines.map((line) => `${feeds.find((feed) => feed.feedItemId === line.feedItemId)?.name ?? line.feedCode} ${formatNumber(line.actualKg)} kg`).join(' · ') || '—'}</Td>
              <Td className="whitespace-nowrap">{record.time ?? '—'} · {record.fedBy ?? '—'}</Td>
              <Td><Badge tone={record.status === 'VALID' ? 'ok' : record.status === 'VOIDED' ? 'err' : 'warn'}>{record.status === 'VALID' ? 'Hợp lệ' : record.status === 'VOIDED' ? 'Đã hủy' : record.status}</Badge></Td>
              <Td>{canEdit && record.status === 'VALID' && (
                <div className="flex gap-2 whitespace-nowrap">
                  <Button variant="link" size="sm" onClick={() => onEdit(record, 'correct')}>Sửa</Button>
                  <Button variant="link" size="sm" onClick={() => onEdit(record, 'void')}>Hủy</Button>
                </div>
              )}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  )
}

