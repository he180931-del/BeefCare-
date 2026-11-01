import { useMemo, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { Badge, Button, Card, Field, Note, PageHeader, Select, Table, Td, Th, Tile, Textarea, inputCls, smInputCls } from '../../../components/ui'
import { backendMode } from '../../../api/backendTransport'
import { userFacingError } from '../../../api/userFacingError'
import { useQuery } from '../../../hooks/useApi'
import { correctFeedSessionDemo, listFeedFeedingRecords, recordFeedSessionDemo, voidFeedSessionDemo } from '../api/feedFeedingApi'
import { listFeedRationFeeds, listFeedRationPens, listFeedRations } from '../api/feedRationApi'
import FeedManagementTabs from '../components/FeedManagementTabs'
import type { FeedFeedingDraftInput, FeedFeedingLineInput, FeedFeedingRecord } from '../types/feedFeeding'
import type { FeedRation, FeedRationPenOption } from '../types/feedRation'
import type { FeedStockRow } from '../types'

type PeriodView = 'DAY' | 'WEEK'
type DialogState = { action: 'record'; penId?: number; sessionNo?: number } | { action: 'correct' | 'void'; record: FeedFeedingRecord }
type FeedingData = { records: FeedFeedingRecord[]; rations: FeedRation[]; pens: FeedRationPenOption[]; feeds: FeedStockRow[] }
type FeedingFormLine = { feedItemId: string; plannedKg: string; actualKg: string; inRation: boolean }
type FeedingForm = {
  feedingDate: string
  penId: string
  sessionNo: number
  time: string
  fedBy: string
  leftoverKg: string
  note: string
  rationCode: string | null
  rationVersion: number | null
  lines: FeedingFormLine[]
}

const kgFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 })
const moneyFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 })
const SESSION_LABELS: Record<number, string> = { 1: 'Sáng', 2: 'Chiều', 3: 'Tối' }
const SESSION_TIMES: Record<number, string> = { 1: '06:30', 2: '16:30', 3: '20:00' }
const today = () => {
  const date = new Date()
  return formatDate(date)
}
const formatDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const isCalendarDate = (value: string | null): value is string => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00`)
  return !Number.isNaN(date.getTime()) && formatDate(date) === value
}
const roundKg = (value: number) => Math.round(value * 10) / 10

function periodRange(selectedDate: string, view: PeriodView) {
  if (view === 'DAY') return { from: selectedDate, to: selectedDate }
  const date = new Date(`${selectedDate}T00:00:00`)
  const day = date.getDay() || 7
  date.setDate(date.getDate() - day + 1)
  const from = formatDate(date)
  date.setDate(date.getDate() + 6)
  return { from, to: formatDate(date) }
}

function getRationForPen(rations: readonly FeedRation[], penId: number, date: string) {
  return rations
    .filter((ration) => ration.penIds.includes(penId) && ration.effectiveFrom <= date && (!ration.effectiveTo || ration.effectiveTo >= date))
    .sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom) || right.versionNo - left.versionNo)[0] ?? null
}

function planForSession(ration: FeedRation | null, pen: FeedRationPenOption | undefined, sessionNo: number) {
  if (!ration || !pen || sessionNo > ration.sessionsPerDay) return [] as Array<{ feedItemId: number; plannedKg: number }>
  return ration.components.flatMap((line) => {
    const perHead = sessionNo === 1 ? line.session1Kg : sessionNo === 2 ? line.session2Kg : line.session3Kg
    const plannedKg = roundKg(perHead * pen.headcount)
    return plannedKg > 0 ? [{ feedItemId: line.feedItemId, plannedKg }] : []
  })
}

function numberOfDays(from: string, to: string, until: string) {
  const end = to < until ? to : until
  if (from > end) return [] as string[]
  const values: string[] = []
  const cursor = new Date(`${from}T00:00:00`)
  const last = new Date(`${end}T00:00:00`)
  while (cursor <= last) {
    values.push(formatDate(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return values
}

export default function FeedFeedingPage() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const readOnlyView = searchParams.get('readOnly') === '1'
  const initialDate = searchParams.get('date')
  const routeMessage = typeof location.state === 'object' && location.state !== null && 'feedingMessage' in location.state
    ? String((location.state as { feedingMessage?: unknown }).feedingMessage ?? '')
    : ''
  const [view, setView] = useState<PeriodView>('DAY')
  const [selectedDate, setSelectedDate] = useState(() => isCalendarDate(initialDate) ? initialDate : today())
  const [penFilter, setPenFilter] = useState('ALL')
  const [sessionFilter, setSessionFilter] = useState('ALL')
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [message, setMessage] = useState(routeMessage)
  const range = useMemo(() => periodRange(selectedDate, view), [selectedDate, view])
  const query = useQuery(async (): Promise<FeedingData> => {
    const [records, rations, pens, feeds] = await Promise.all([
      listFeedFeedingRecords(range), listFeedRations(), listFeedRationPens(), listFeedRationFeeds(),
    ])
    return { records, rations, pens, feeds }
  }, [range.from, range.to])

  const data = query.data
  const pens = data?.pens ?? []
  const rations = data?.rations ?? []
  const records = data?.records ?? []
  const feeds = data?.feeds ?? []
  const activePens = pens.filter((pen) => pen.status === 'ACTIVE' && pen.headcount > 0)
  const filteredRecords = records.filter((record) => (penFilter === 'ALL' || String(record.penId) === penFilter)
    && (sessionFilter === 'ALL' || String(record.sessionNo) === sessionFilter))
  const validRecords = filteredRecords.filter((record) => record.status === 'VALID')
  const actualKg = validRecords.reduce((sum, record) => sum + record.actualTotalKg, 0)
  const expectedDays = numberOfDays(range.from, range.to, today())
  const expected = expectedDays.reduce((summary, date) => {
    for (const pen of activePens.filter((row) => penFilter === 'ALL' || String(row.id) === penFilter)) {
      const ration = getRationForPen(rations, pen.id, date)
      if (!ration) continue
      const allowed = Array.from({ length: ration.sessionsPerDay }, (_, index) => index + 1)
        .filter((sessionNo) => sessionFilter === 'ALL' || String(sessionNo) === sessionFilter)
      summary.byPen.set(pen.id, (summary.byPen.get(pen.id) ?? 0) + allowed.length)
      summary.sessions += allowed.length
      summary.plannedKg += allowed.reduce((sessionSum, sessionNo) => sessionSum
        + planForSession(ration, pen, sessionNo).reduce((lineSum, line) => lineSum + line.plannedKg, 0), 0)
    }
    return summary
  }, { sessions: 0, plannedKg: 0, byPen: new Map<number, number>() })
  const expectedSessions = expected.sessions
  const recordedPlanned = validRecords.reduce((sum, record) => sum + record.plannedTotalKg, 0)
  const recordedActual = validRecords.reduce((sum, record) => sum + record.actualTotalKg, 0)
  const variance = recordedPlanned > 0 ? ((recordedActual - recordedPlanned) / recordedPlanned) * 100 : null
  const costKnown = validRecords.every((record) => record.lines.every((line) => line.totalCost !== null))
  const deductedValue = validRecords.reduce((sum, record) => sum + record.lines.reduce((lineSum, line) => lineSum + (line.totalCost ?? 0), 0), 0)
  const recordedByPen = new Map<number, number>()
  validRecords.forEach((record) => recordedByPen.set(record.penId, (recordedByPen.get(record.penId) ?? 0) + 1))
  const notRecordedPens = activePens.filter((pen) => (penFilter === 'ALL' || String(pen.id) === penFilter)
    && (expected.byPen.get(pen.id) ?? 0) > (recordedByPen.get(pen.id) ?? 0))
  const usageByFeed = useMemo(() => {
    const totals = new Map<number, number>()
    for (const record of validRecords) for (const line of record.lines) totals.set(line.feedItemId, (totals.get(line.feedItemId) ?? 0) + line.actualKg)
    return feeds.filter((feed) => totals.has(feed.feedItemId)).map((feed) => ({ feed, usedKg: totals.get(feed.feedItemId) ?? 0 }))
  }, [feeds, validRecords])
  const backendError = query.error ? userFacingError(query.error, 'Không thể tải nhật ký cho ăn.') : null

  const finishMutation = (nextMessage: string) => {
    setDialog(null)
    setMessage(nextMessage)
    void query.refetch()
  }

  return (
    <Layout title="Thức ăn – Nhật ký cho ăn" user="manager">
      <PageHeader title="Nhật ký cho ăn" sub="Theo dõi lượng thức ăn thực tế theo ngày, chuồng và từng cữ.">
        {!readOnlyView && <Button variant="primary" disabled={backendMode === 'backend'} title={backendMode === 'backend' ? 'Ghi cữ chưa sẵn sàng ở chế độ kết nối.' : undefined} onClick={() => setDialog({ action: 'record' })}>
          Ghi cữ cho ăn
        </Button>}
      </PageHeader>
      {backendMode === 'local' && <Badge tone="info">Dữ liệu minh họa</Badge>}
      <FeedManagementTabs />
      {message && <Note tone="ok">{message}</Note>}
      {readOnlyView && <Note tone="info">Chế độ chỉ xem dành cho Kỹ thuật viên. Quản lý ghi nhận, sửa và hủy cữ cho ăn.</Note>}
      {!readOnlyView && backendMode === 'backend' && <Note tone="warn">Xem nhật ký đã kết nối. Ghi, sửa và hủy cữ chưa sẵn sàng ở chế độ kết nối.</Note>}

      <section role="tabpanel" aria-label="Nhật ký cho ăn" className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">Khoảng xem</span>
            <div className="flex gap-1 rounded bg-chip p-1">
              <Button size="sm" aria-pressed={view === 'DAY'} onClick={() => setView('DAY')}>Theo ngày</Button>
              <Button size="sm" aria-pressed={view === 'WEEK'} onClick={() => setView('WEEK')}>Theo tuần</Button>
            </div>
          </div>
          <Field label="Ngày" id="feeding-date">
            <input id="feeding-date" type="date" max={today()} value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className={inputCls} />
          </Field>
          <Field label="Chuồng" id="feeding-pen-filter">
            <Select id="feeding-pen-filter" value={penFilter} onChange={(event) => setPenFilter(event.target.value)} className="min-w-[190px]">
              <option value="ALL">Tất cả chuồng</option>
              {pens.map((pen) => <option key={pen.id} value={pen.id}>{pen.code} · {pen.name}</option>)}
            </Select>
          </Field>
          <Field label="Cữ" id="feeding-session-filter">
            <Select id="feeding-session-filter" value={sessionFilter} onChange={(event) => setSessionFilter(event.target.value)}>
              <option value="ALL">Tất cả cữ</option>
              {[1, 2, 3].map((sessionNo) => <option key={sessionNo} value={sessionNo}>{SESSION_LABELS[sessionNo]}</option>)}
            </Select>
          </Field>
        </div>
        <p className="m-0 text-xs text-muted">{view === 'DAY' ? range.from : `${range.from} – ${range.to}`}</p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Tile label="Thực tế / kế hoạch" value={`${kgFormat.format(actualKg)} / ${kgFormat.format(expected.plannedKg)} kg`} note="Tổng lượng theo kế hoạch trong khoảng xem" />
          <Tile label="Cữ đã ghi / dự kiến" value={`${validRecords.length} / ${expectedSessions}`} note={notRecordedPens.length ? `Chưa ghi: ${notRecordedPens.map((pen) => pen.code).join(', ')}` : 'Đã lọc theo chuồng và cữ'} warn={notRecordedPens.length > 0} />
          <Tile label="Chênh lệch cữ đã ghi" value={variance === null ? '—' : `${variance > 0 ? '+' : ''}${variance.toFixed(1)}%`} note="So với lượng kế hoạch của các cữ đã ghi" />
          <Tile label="Giá trị thức ăn đã dùng" value={costKnown ? `${moneyFormat.format(deductedValue)} đ` : '—'} note="Theo giá trị ghi nhận tại từng cữ" />
        </div>

        {query.loading && !data && <div role="status" className="rounded-md border border-edge bg-white p-8 text-center text-sm text-muted">Đang tải nhật ký…</div>}
        {backendError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-err-bg bg-white p-4 text-sm text-err-fg"><span>{backendError}</span><Button size="sm" disabled={query.loading} onClick={() => query.refetch()}>Thử tải lại</Button></div>}
        {!query.loading && !backendError && view === 'DAY' && (
          <DailyFeedingTable
            date={selectedDate}
            pens={activePens.filter((pen) => penFilter === 'ALL' || String(pen.id) === penFilter)}
            records={filteredRecords}
            rations={rations}
            readOnly={readOnlyView || backendMode === 'backend'}
            onRecord={(penId, sessionNo) => setDialog({ action: 'record', penId, sessionNo })}
            onCorrect={(record) => setDialog({ action: 'correct', record })}
            onVoid={(record) => setDialog({ action: 'void', record })}
          />
        )}
        {!query.loading && !backendError && view === 'WEEK' && (
          <WeeklyFeedingTable
            records={filteredRecords}
            feeds={feeds}
            readOnly={readOnlyView || backendMode === 'backend'}
            onCorrect={(record) => setDialog({ action: 'correct', record })}
            onVoid={(record) => setDialog({ action: 'void', record })}
          />
        )}
        {query.data && !backendError && <ConsumptionTable rows={usageByFeed} />}
        <Note tone="info">Chỉ cữ hợp lệ làm giảm tồn kho. Hủy cữ sẽ hoàn lại lượng đã ghi; mọi lần sửa hoặc hủy đều lưu lý do trong lịch sử.</Note>
      </section>
      {dialog && data && <FeedSessionDialog key={`${dialog.action}-${'record' in dialog ? dialog.record.id : `${dialog.penId ?? 'new'}-${dialog.sessionNo ?? 1}`}`} dialog={dialog} data={data} selectedDate={selectedDate} onClose={() => setDialog(null)} onSaved={finishMutation} />}
    </Layout>
  )
}

function DailyFeedingTable({ date, pens, records, rations, readOnly, onRecord, onCorrect, onVoid }: {
  date: string
  pens: FeedRationPenOption[]
  records: FeedFeedingRecord[]
  rations: FeedRation[]
  readOnly: boolean
  onRecord: (penId: number, sessionNo: number) => void
  onCorrect: (record: FeedFeedingRecord) => void
  onVoid: (record: FeedFeedingRecord) => void
}) {
  const visibleSessions = [1, 2, 3]
  if (!pens.length) return <Note tone="info">Không có chuồng đang hoạt động trong bộ lọc này.</Note>
  return (
    <Card title="Các cữ trong ngày" sub="Lượng dự kiến được tính từ khẩu phần hiệu lực và số con hiện tại.">
      <Table scroll>
        <thead><tr><Th>Chuồng / đầu con</Th>{visibleSessions.map((sessionNo) => <Th key={sessionNo}>{SESSION_LABELS[sessionNo]}</Th>)}</tr></thead>
        <tbody>{pens.map((pen) => {
          const ration = getRationForPen(rations, pen.id, date)
          return <tr key={pen.id}>
            <Td><strong>{pen.code} · {pen.name}</strong><span className="block text-muted">{pen.headcount} con{ration ? ` · ${ration.rationCode} v${ration.versionNo}` : ' · Chưa có khẩu phần'}</span></Td>
            {visibleSessions.map((sessionNo) => {
              const row = records.find((record) => record.penId === pen.id && record.sessionNo === sessionNo && record.status === 'VALID')
                ?? records.filter((record) => record.penId === pen.id && record.sessionNo === sessionNo).sort((a, b) => b.version - a.version)[0]
              const allowed = !ration || sessionNo <= ration.sessionsPerDay
              const planKg = planForSession(ration, pen, sessionNo).reduce((sum, line) => sum + line.plannedKg, 0)
              if (!allowed) return <Td key={sessionNo}><span className="text-muted">—</span></Td>
              if (!row || row.status === 'VOIDED') return <Td key={sessionNo}>
                {row && <Badge tone="err">Đã hủy</Badge>}
                <span className="mb-2 block text-muted">Kế hoạch {kgFormat.format(planKg)} kg</span>
                {row && <FeedingHistory record={row} />}
                {!readOnly && <Button size="sm" onClick={() => onRecord(pen.id, sessionNo)}>Ghi cữ</Button>}
              </Td>
              return <Td key={sessionNo}>
                <div className="mb-1 font-semibold">{kgFormat.format(row.actualTotalKg)} / {kgFormat.format(row.plannedTotalKg)} kg</div>
                <span className="block text-muted">{row.time ?? '—'} · {row.fedBy ?? '—'}</span>
                <span className="block text-muted">Ghi lúc {formatRecordedAt(row.recordedAt)}</span>
                {row.rationCode && <span className="block text-muted">{row.rationCode}{row.rationVersion ? ` v${row.rationVersion}` : ''}</span>}
                {row.note && <span className="block text-muted">Ghi chú: {row.note}</span>}
                <FeedingHistory record={row} />
                {!readOnly && <div className="mt-2 flex flex-wrap gap-1.5">
                  <Button size="sm" onClick={() => onCorrect(row)}>Sửa cữ</Button>
                  <Button size="sm" onClick={() => onVoid(row)}>Hủy cữ</Button>
                </div>}
              </Td>
            })}
          </tr>
        })}</tbody>
      </Table>
    </Card>
  )
}

function WeeklyFeedingTable({ records, feeds, readOnly, onCorrect, onVoid }: {
  records: FeedFeedingRecord[]
  feeds: FeedStockRow[]
  readOnly: boolean
  onCorrect: (record: FeedFeedingRecord) => void
  onVoid: (record: FeedFeedingRecord) => void
}) {
  if (!records.length) return <Note tone="info">Chưa có cữ cho ăn trong tuần được chọn.</Note>
  return <Card title="Nhật ký trong tuần">
    <Table scroll>
      <thead><tr><Th>Ngày / chuồng</Th><Th>Cữ</Th><Th>Thức ăn thực tế</Th><Th>Giờ / người cho ăn</Th><Th>Trạng thái</Th><Th>Thao tác</Th></tr></thead>
      <tbody>{records.map((record) => <tr key={record.id}>
        <Td><strong>{record.feedingDate}</strong><span className="block text-muted">{record.penCode ?? `Chuồng ${record.penId}`} · {record.headCount} con</span></Td>
        <Td>{SESSION_LABELS[record.sessionNo] ?? `Cữ ${record.sessionNo}`}</Td>
        <Td>{record.lines.map((line) => `${feeds.find((feed) => feed.feedItemId === line.feedItemId)?.code ?? line.feedCode}: ${kgFormat.format(line.actualKg)} kg`).join(' · ') || '—'}</Td>
        <Td>{record.time ?? '—'} · {record.fedBy ?? '—'}<span className="block text-muted">Ghi lúc {formatRecordedAt(record.recordedAt)}</span>{record.note && <span className="block text-muted">{record.note}</span>}</Td>
        <Td><Badge tone={record.status === 'VALID' ? 'ok' : record.status === 'VOIDED' ? 'err' : 'warn'}>{record.status === 'VALID' ? 'Hợp lệ' : record.status === 'VOIDED' ? 'Đã hủy' : record.status}</Badge><FeedingHistory record={record} /></Td>
        <Td>{!readOnly && record.status === 'VALID' && <div className="flex gap-1.5"><Button size="sm" onClick={() => onCorrect(record)}>Sửa cữ</Button><Button size="sm" onClick={() => onVoid(record)}>Hủy cữ</Button></div>}</Td>
      </tr>)}</tbody>
    </Table>
  </Card>
}

function ConsumptionTable({ rows }: { rows: Array<{ feed: FeedStockRow; usedKg: number }> }) {
  return <Card title="Tiêu thụ theo thức ăn" sub="Tổng lượng cữ hợp lệ trong khoảng xem.">
    {!rows.length ? <p className="m-0 text-xs text-muted">Chưa có lượng tiêu thụ trong khoảng này.</p> : <Table>
      <thead><tr><Th>Thức ăn</Th><Th>Đã dùng</Th><Th>Tồn còn lại</Th><Th>Trạng thái</Th></tr></thead>
      <tbody>{rows.map(({ feed, usedKg }) => <tr key={feed.feedItemId}><Td>{feed.code} · {feed.name}</Td><Td>{kgFormat.format(usedKg)} kg</Td><Td>{kgFormat.format(feed.onHandKg)} kg</Td><Td><Badge tone={feed.status === 'OUT_OF_STOCK' ? 'err' : feed.status === 'LOW' ? 'warn' : 'ok'}>{feed.status === 'OUT_OF_STOCK' ? 'Hết hàng' : feed.status === 'LOW' ? 'Sắp hết' : feed.status === 'SUFFICIENT' ? 'Đủ dùng' : feed.status}</Badge></Td></tr>)}</tbody>
    </Table>}
  </Card>
}

function formatRecordedAt(value: string | null) {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString('vi-VN')
}

function FeedingHistory({ record }: { record: FeedFeedingRecord }) {
  if (!record.revisions.length) return null
  return <details className="mt-1 text-[11px]"><summary className="cursor-pointer">Lịch sử sửa / hủy ({record.revisions.length})</summary>{record.revisions.map((revision, index) => (
    <div key={`${revision.action}-${index}`} className="my-1 border-l border-edge pl-2">
      <p className="m-0">{revision.action === 'VOIDED' ? 'Hủy' : 'Sửa'} · {revision.reason}</p>
      {revision.lines.map((line) => <p key={line.feedItemId} className="m-0 text-muted">{line.feedCode}: {kgFormat.format(line.actualKg)} kg</p>)}
    </div>
  ))}</details>
}

function initialForm(dialog: DialogState, selectedDate: string, data: FeedingData): FeedingForm {
  if (dialog.action === 'record') return buildFormForScope(dialog.penId, dialog.sessionNo ?? 1, selectedDate, data, 'Nhân viên demo')
  if (dialog.action === 'void') return buildFormForScope(dialog.record.penId, dialog.record.sessionNo, dialog.record.feedingDate, data, dialog.record.fedBy ?? '')
  return {
    feedingDate: dialog.record.feedingDate,
    penId: String(dialog.record.penId),
    sessionNo: dialog.record.sessionNo,
    time: dialog.record.time ?? '',
    fedBy: dialog.record.fedBy ?? '',
    leftoverKg: dialog.record.leftoverKg === null ? '' : String(dialog.record.leftoverKg),
    note: dialog.record.note ?? '',
    rationCode: dialog.record.rationCode,
    rationVersion: dialog.record.rationVersion,
    lines: dialog.record.lines.map((line) => ({ feedItemId: String(line.feedItemId), plannedKg: String(line.plannedKg), actualKg: String(line.actualKg), inRation: line.inRation === true })),
  }
}

function buildFormForScope(penId: number | undefined, sessionNo: number, date: string, data: FeedingData, fedBy: string): FeedingForm {
  const pen = data.pens.find((row) => row.id === penId)
  const ration = pen ? getRationForPen(data.rations, pen.id, date) : null
  const plan = planForSession(ration, pen, sessionNo)
  return {
    feedingDate: date,
    penId: penId ? String(penId) : '',
    sessionNo,
    time: SESSION_TIMES[sessionNo] ?? '',
    fedBy,
    leftoverKg: '',
    note: '',
    rationCode: ration?.rationCode ?? null,
    rationVersion: ration?.versionNo ?? null,
    lines: plan.map((line) => ({ feedItemId: String(line.feedItemId), plannedKg: String(line.plannedKg), actualKg: '0', inRation: true })),
  }
}

function FeedSessionDialog({ dialog, data, selectedDate, onClose, onSaved }: {
  dialog: DialogState
  data: FeedingData
  selectedDate: string
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const [form, setForm] = useState(() => initialForm(dialog, selectedDate, data))
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const pen = data.pens.find((row) => row.id === Number(form.penId))
  const ration = pen ? getRationForPen(data.rations, pen.id, form.feedingDate) : null
  const sessionsForPen = ration?.sessionsPerDay ?? 3
  const plannedTotal = form.lines.reduce((sum, line) => sum + (Number(line.plannedKg) || 0), 0)
  const actualTotal = form.lines.reduce((sum, line) => sum + (Number(line.actualKg) || 0), 0)

  const changeScope = (nextDate: string, nextPenId: number | undefined, nextSessionNo: number) => {
    const next = buildFormForScope(nextPenId, nextSessionNo, nextDate, data, form.fedBy)
    setForm((current) => ({ ...next, leftoverKg: current.leftoverKg, note: current.note }))
  }

  const addExtraLine = () => setForm((current) => ({ ...current, lines: [...current.lines, { feedItemId: '', plannedKg: '0', actualKg: '0', inRation: false }] }))
  const removeLine = (index: number) => setForm((current) => ({ ...current, lines: current.lines.filter((_, rowIndex) => rowIndex !== index) }))
  const updateLine = (index: number, key: keyof FeedingFormLine, value: string) => setForm((current) => ({
    ...current,
    lines: current.lines.map((line, rowIndex) => rowIndex === index ? { ...line, [key]: value } : line),
  }))
  const selectLineFeed = (index: number, value: string) => setForm((current) => ({
    ...current,
    lines: current.lines.map((line, rowIndex) => rowIndex === index ? { ...line, feedItemId: value, inRation: false } : line),
  }))
  const fillFromPlan = () => setForm((current) => ({ ...current, lines: current.lines.map((line) => ({ ...line, actualKg: line.plannedKg })) }))

  const toLines = (): FeedFeedingLineInput[] => form.lines.map((line) => ({
    feedItemId: Number(line.feedItemId),
    plannedKg: Number(line.plannedKg),
    actualKg: Number(line.actualKg),
    inRation: line.inRation,
  }))

  const submitRecord = async () => {
    if (savingRef.current) return
    if (!form.penId) return setError('Chọn chuồng.')
    if (!form.fedBy.trim()) return setError('Nhập người cho ăn.')
    if (!form.time) return setError('Nhập giờ cho ăn.')
    if (!form.lines.length || form.lines.some((line) => !line.feedItemId)) return setError('Chọn thức ăn cho từng dòng.')
    if (form.leftoverKg && (!Number.isFinite(Number(form.leftoverKg)) || Number(form.leftoverKg) < 0)) return setError('Thức ăn thừa phải là số không âm.')
    savingRef.current = true
    setSaving(true)
    setError('')
    try {
      const payload: FeedFeedingDraftInput = {
        penId: Number(form.penId), feedingDate: form.feedingDate, sessionNo: form.sessionNo,
        time: form.time, fedBy: form.fedBy, leftoverKg: form.leftoverKg ? Number(form.leftoverKg) : null,
        note: form.note, rationCode: form.rationCode, rationVersion: form.rationVersion, lines: toLines(),
      }
      await recordFeedSessionDemo(payload)
      onSaved('Đã ghi cữ cho ăn trong bản demo; tồn kho đã được cập nhật.')
    } catch (nextError) {
      setError(userFacingError(nextError, 'Không thể ghi cữ cho ăn.'))
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const submitCorrection = async () => {
    if (savingRef.current || dialog.action !== 'correct') return
    if (reason.trim().length < 5) return setError('Nhập lý do sửa, tối thiểu 5 ký tự.')
    if (reason.trim().length > 500) return setError('Lý do tối đa 500 ký tự.')
    if (form.lines.some((line) => !line.feedItemId)) return setError('Chọn thức ăn cho từng dòng.')
    savingRef.current = true
    setSaving(true)
    setError('')
    try {
      await correctFeedSessionDemo(dialog.record.id, {
        expectedVersion: dialog.record.version,
        reason,
        time: form.time,
        fedBy: form.fedBy,
        leftoverKg: form.leftoverKg ? Number(form.leftoverKg) : null,
        note: form.note,
        lines: toLines(),
      })
      onSaved('Đã sửa bản ghi trong bản demo; tồn kho được điều chỉnh theo phần chênh lệch.')
    } catch (nextError) {
      setError(userFacingError(nextError, 'Không thể sửa bản ghi.'))
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const submitVoid = async () => {
    if (savingRef.current || dialog.action !== 'void') return
    if (reason.trim().length < 5) return setError('Nhập lý do hủy, tối thiểu 5 ký tự.')
    savingRef.current = true
    setSaving(true)
    setError('')
    try {
      await voidFeedSessionDemo(dialog.record.id, reason)
      onSaved('Đã hủy cữ trong bản demo; lượng thức ăn đã ghi được hoàn lại kho.')
    } catch (nextError) {
      setError(userFacingError(nextError, 'Không thể hủy bản ghi.'))
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const isRecord = dialog.action === 'record'
  const isCorrect = dialog.action === 'correct'
  const title = isRecord ? 'Ghi cữ cho ăn' : isCorrect ? 'Sửa bản ghi cho ăn' : 'Hủy bản ghi cho ăn'
  const existing = dialog.action === 'record' ? null : dialog.record

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/40 p-2 sm:items-center sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose() }}>
      <section role="dialog" aria-modal="true" aria-label={title} className="my-auto max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white p-4 shadow-xl sm:p-6">
        <header className="mb-4 flex items-start gap-3">
          <div><h2 className="m-0 text-lg font-semibold">{title}</h2><p className="mb-0 mt-1 text-xs text-muted">Dữ liệu minh họa được lưu trên thiết bị này.</p></div>
          <span className="flex-1" />
          <Button size="sm" disabled={saving} aria-label="Đóng" onClick={onClose}>Đóng</Button>
        </header>
        {error && <div role="alert" className="mb-3 rounded border border-err-bg bg-err-bg p-3 text-xs text-err-fg">{error}</div>}
        {dialog.action === 'void' ? (
          <div className="flex flex-col gap-4">
            <Note tone="warn">Hủy cữ sẽ hoàn lại lượng đã ghi vào tồn kho. Lý do hủy được giữ trong lịch sử.</Note>
            <p className="m-0 text-sm">{existing?.feedingDate} · {existing?.penCode ?? `Chuồng ${existing?.penId}`} · {SESSION_LABELS[existing?.sessionNo ?? 0] ?? 'Cữ'} · {kgFormat.format(existing?.actualTotalKg ?? 0)} kg</p>
            <Field label="Lý do hủy *" id="feeding-void-reason"><Textarea id="feeding-void-reason" value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} /></Field>
            <div className="flex justify-end gap-2"><Button disabled={saving} onClick={onClose}>Đóng</Button><Button variant="danger" disabled={saving} onClick={() => void submitVoid()}>{saving ? 'Đang hủy…' : 'Xác nhận hủy'}</Button></div>
          </div>
        ) : <div className="flex flex-col gap-4">
          {isCorrect && existing && <Note tone="info">Thay đổi tồn kho bằng lượng mới trừ lượng đã ghi. Nhập lý do để lưu lịch sử.</Note>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Ngày" id="feeding-form-date"><input id="feeding-form-date" type="date" max={today()} disabled={!isRecord || saving} value={form.feedingDate} onChange={(event) => changeScope(event.target.value, form.penId ? Number(form.penId) : undefined, form.sessionNo)} className={inputCls} /></Field>
            <Field label="Chuồng *" id="feeding-form-pen"><Select id="feeding-form-pen" disabled={!isRecord || saving} value={form.penId} onChange={(event) => changeScope(form.feedingDate, event.target.value ? Number(event.target.value) : undefined, form.sessionNo)}><option value="">Chọn chuồng</option>{data.pens.filter((row) => row.status === 'ACTIVE').map((row) => <option key={row.id} value={row.id}>{row.code} · {row.name} ({row.headcount} con)</option>)}</Select></Field>
            <Field label="Cữ *" id="feeding-form-session"><Select id="feeding-form-session" disabled={!isRecord || saving} value={form.sessionNo} onChange={(event) => changeScope(form.feedingDate, form.penId ? Number(form.penId) : undefined, Number(event.target.value))}>{Array.from({ length: sessionsForPen }, (_, index) => index + 1).map((sessionNo) => <option key={sessionNo} value={sessionNo}>{SESSION_LABELS[sessionNo]}</option>)}</Select></Field>
            <Field label="Giờ cho ăn *" id="feeding-form-time"><input id="feeding-form-time" type="time" disabled={saving} value={form.time} onChange={(event) => setForm((current) => ({ ...current, time: event.target.value }))} className={inputCls} /></Field>
            <Field label="Người cho ăn *" id="feeding-form-fedby"><input id="feeding-form-fedby" disabled={saving} value={form.fedBy} maxLength={100} onChange={(event) => setForm((current) => ({ ...current, fedBy: event.target.value }))} className={inputCls} /></Field>
            <Field label="Thức ăn thừa (kg)" id="feeding-form-leftover"><input id="feeding-form-leftover" type="number" min="0" step="0.1" disabled={saving} value={form.leftoverKg} onChange={(event) => setForm((current) => ({ ...current, leftoverKg: event.target.value }))} className={inputCls} /></Field>
            <div className="flex items-end pb-1 text-xs text-muted lg:col-span-2">{ration ? `Khẩu phần ${ration.rationCode} phiên bản ${ration.versionNo} · ${pen?.headcount ?? existing?.headCount ?? 0} con` : 'Chưa có khẩu phần hiệu lực; có thể ghi thực tế bằng cách thêm thức ăn.'}</div>
          </div>
          <Card title="Thức ăn đã cho" sub="Số lượng thực tế không được vượt quá tồn kho.">
            <div className="mb-3 flex flex-wrap gap-2">
              <Button size="sm" disabled={!form.lines.length || saving} onClick={fillFromPlan}>Điền theo kế hoạch</Button>
              <Button size="sm" disabled={saving} onClick={addExtraLine}>+ Thêm ngoài khẩu phần</Button>
            </div>
            {!form.lines.length ? <Note tone="info">Chưa có khẩu phần cho cữ này. Thêm loại thức ăn thực tế để tiếp tục.</Note> : <Table scroll>
              <thead><tr><Th>Thức ăn</Th><Th>Kế hoạch (kg)</Th><Th>Thực tế (kg) *</Th><Th>Tồn hiện tại</Th><Th /></tr></thead>
              <tbody>{form.lines.map((line, index) => {
                const feed = data.feeds.find((row) => row.feedItemId === Number(line.feedItemId))
                return <tr key={`${index}-${line.feedItemId}`}>
                  <Td><Select aria-label={`Thức ăn dòng ${index + 1}`} disabled={saving || line.inRation && feed?.available !== false} value={line.feedItemId} onChange={(event) => selectLineFeed(index, event.target.value)}><option value="">Chọn thức ăn</option>{data.feeds.filter((row) => row.available !== false || row.feedItemId === Number(line.feedItemId)).map((row) => <option key={row.feedItemId} value={row.feedItemId}>{row.code} · {row.name}{row.available === false ? ' · Ngừng hoạt động' : ''}</option>)}</Select>{line.inRation && <span className="block text-muted">Theo khẩu phần</span>}</Td>
                  <Td>{kgFormat.format(Number(line.plannedKg) || 0)} kg</Td>
                  <Td><input aria-label={`Lượng thực tế dòng ${index + 1}`} type="number" min="0" step="0.1" disabled={saving} value={line.actualKg} onChange={(event) => updateLine(index, 'actualKg', event.target.value)} className={`${smInputCls} w-28`} /></Td>
                  <Td>{feed ? `${kgFormat.format(feed.onHandKg)} kg` : '—'}</Td>
                  <Td><Button size="sm" disabled={saving || line.inRation} aria-label={`Xóa thức ăn dòng ${index + 1}`} onClick={() => removeLine(index)}>Xóa</Button></Td>
                </tr>
              })}</tbody>
            </Table>}
            <div className="mt-3 flex flex-wrap gap-5 text-xs"><span>Dự kiến: <strong>{kgFormat.format(plannedTotal)} kg</strong></span><span>Thực tế: <strong>{kgFormat.format(actualTotal)} kg</strong></span></div>
          </Card>
          <Field label="Ghi chú" id="feeding-form-note"><Textarea id="feeding-form-note" maxLength={500} disabled={saving} value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} /></Field>
          {isCorrect && <Field label="Lý do sửa *" id="feeding-correct-reason"><Textarea id="feeding-correct-reason" maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /></Field>}
          <div className="flex flex-wrap justify-end gap-2"><Button disabled={saving} onClick={onClose}>Đóng</Button>{isRecord
            ? <Button variant="primary" disabled={saving} onClick={() => void submitRecord()}>{saving ? 'Đang ghi…' : 'Lưu & trừ kho'}</Button>
            : <Button variant="primary" disabled={saving} onClick={() => void submitCorrection()}>{saving ? 'Đang lưu…' : 'Lưu thay đổi'}</Button>}</div>
        </div>}
      </section>
    </div>
  )
}
