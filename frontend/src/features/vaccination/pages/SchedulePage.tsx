import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Icon } from '../../../components/Icon'
import Layout from '../../../components/Layout'
import { useModalParam } from '../../../components/Modal'
import { Badge, Button, Checkbox, EmptyBlock, ErrorBlock, Foot, LoadingBlock, Note, PageHeader, Pagination, Segmented, Table, Td, Th } from '../../../components/ui'
import { userFacingError } from '../../../api/userFacingError'
import { useDemoState } from '../../../hooks/useDemoState'
import { useQuery } from '../../../hooks/useApi'
import { vaccinationApi } from '../api/vaccinationApi'
import DeferModal from '../components/DeferModal'
import { DoseStatusBadge, profilePath, recordPath, useCanWrite, useNotice } from '../components/vaccinationParts'
import { fmtDate } from '../domain/vaccinationFormat'
import type { DoseTab, ScheduleCard } from '../types'

const TITLE = 'Tiêm phòng'
const TAB_LABEL: Record<DoseTab, string> = { all: 'Tất cả', overdue: 'Quá hạn', due: 'Đến hạn 7 ngày', upcoming: 'Sắp tới', deferred: 'Đã hoãn', done: 'Đã tiêm' }

const cardInfo = (c: ScheduleCard) => {
  const s = c.schedule
  const tail = s.doseCount > 1 ? `${s.doseCount} mũi cách ${s.intervalDays} ngày` : s.boosterIntervalMonths ? `nhắc lại sau ${s.boosterIntervalMonths} tháng` : '1 mũi'
  return `${c.vaccine.name} · ${tail}`
}

export default function SchedulePage() {
  const navigate = useNavigate()
  const canWrite = useCanWrite()
  const demo = useDemoState()
  const [notice, setNotice] = useNotice()
  const [selected, setSelected] = useState<number | null | undefined>(undefined) // undefined: lịch đầu tiên, null: tất cả
  const [tab, setTab] = useState<DoseTab>('overdue')
  const [picked, setPicked] = useState<number[]>([])
  const [reload, setReload] = useState(0)
  const [hint, setHint] = useState(false)
  const [params, setParams] = useSearchParams()
  const [modal] = useModalParam()
  const cards = useQuery(() => (demo === 'load-error' ? Promise.reject(new Error('demo')) : vaccinationApi.listSchedules()), [reload, demo])

  if (cards.loading && !cards.data) return <Layout title={TITLE}><LoadingBlock /></Layout>
  if (cards.error || !cards.data) return <Layout title={TITLE}><ErrorBlock message={userFacingError(cards.error, 'Không tải được lịch tiêm phòng.')} onRetry={cards.refetch} /></Layout>

  const list = cards.data
  const scheduleId = selected === undefined ? list[0]?.schedule.id : selected ?? undefined
  const recordPicked = () => (picked.length ? navigate(recordPath({ doses: picked.join(',') })) : setHint(true))
  const openDefer = (id: number) => { const next = new URLSearchParams(params); next.set('m', 'defer'); next.set('d', String(id)); setParams(next) }
  const closeModal = () => { const next = new URLSearchParams(params); next.delete('m'); next.delete('d'); setParams(next) }
  const deferId = modal === 'defer' ? Number(params.get('d')) : 0

  return (
    <Layout title={TITLE}>
      <div className="flex flex-col gap-5">
        <PageHeader title={TITLE} sub={`${list.length} lịch đang chạy · chọn mũi để ghi nhận hàng loạt`}>
          <Button onClick={() => navigate('/tiem-phong/lich-su')}><Icon name="history" className="mr-1.5 align-[-3px]" />Lịch sử tiêm</Button>
          {canWrite && <Button onClick={() => navigate('/tiem-phong/quan-ly')}>Quản lý lịch</Button>}
          {canWrite && <Button variant="primary" onClick={recordPicked}><Icon name="circle-plus" className="mr-1.5 align-[-3px]" />Ghi nhận tiêm</Button>}
        </PageHeader>
        {notice && <Note tone="ok">{notice}</Note>}
        {hint && <Note tone="warn">Chọn ít nhất một mũi trong danh sách để ghi nhận.</Note>}
        <div className="grid gap-4 md:grid-cols-3">
          {list.map((c) => <ScheduleCardView key={c.schedule.id} card={c} active={c.schedule.id === scheduleId} onClick={() => { setSelected(c.schedule.id === scheduleId ? null : c.schedule.id); setTab('all') }} />)}
        </div>
        {list.length === 0 && <EmptyBlock title="Chưa có lịch tiêm nào đang chạy" sub={canWrite ? 'Dùng "Quản lý lịch" để tạo lịch tiêm mới.' : undefined} />}
        <DoseList
          key={`${scheduleId}-${reload}`} scheduleId={scheduleId} tab={tab} onTab={setTab} canWrite={canWrite} picked={picked} onPick={(ids) => { setPicked(ids); setHint(false) }}
          onRecordPicked={recordPicked} onRecord={(id) => navigate(recordPath({ doses: String(id) }))} onDefer={openDefer}
        />
        <Foot>Màn lịch tiêm cấp đàn. Thẻ lịch cho biết tiến độ từng lịch; nhấn thẻ để lọc danh sách theo lịch đó. Tab đếm mũi theo trạng thái. Quản lý tick nhiều mũi rồi nhấn "Ghi nhận n mũi đã chọn" để ghi hàng loạt; Chủ trại và Kỹ thuật viên chỉ xem, không có ô chọn và cột Thao tác.</Foot>
      </div>
      {canWrite && deferId > 0 && <DeferModal doseId={deferId} onClose={closeModal} onSaved={(m) => { setNotice(m); closeModal(); setReload(reload + 1) }} />}
    </Layout>
  )
}

function ScheduleCardView({ card, active, onClick }: { card: ScheduleCard; active: boolean; onClick: () => void }) {
  const pct = card.targetCount ? Math.round((card.doneCount / card.targetCount) * 100) : 0
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={`flex flex-col gap-2 rounded-md border bg-white p-4 text-left ${active ? 'border-brand' : 'border-edge'}`}>
      <span className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-ink">{card.schedule.name}</span>
        {card.overdueCount > 0 ? <Badge tone="err" icon="alert-triangle">{card.overdueCount} quá hạn</Badge> : <Badge tone="ok">Đúng tiến độ</Badge>}
      </span>
      <span className="text-xs text-muted">{cardInfo(card)}</span>
      <span className="h-1.5 w-full overflow-hidden rounded-full bg-chip"><span className="block h-full rounded-full bg-brand" style={{ width: `${pct}%` }} /></span>
      <span className="text-xs font-medium text-ink">Đã tiêm {card.doneCount} / {card.targetCount}</span>
    </button>
  )
}

function DoseList({ scheduleId, tab, onTab, canWrite, picked, onPick, onRecordPicked, onRecord, onDefer }: {
  scheduleId?: number; tab: DoseTab; onTab: (t: DoseTab) => void; canWrite: boolean; picked: number[]; onPick: (ids: number[]) => void
  onRecordPicked: () => void; onRecord: (id: number) => void; onDefer: (id: number) => void
}) {
  const [page, setPage] = useState(1)
  const [dir, setDir] = useState<'asc' | 'desc'>('asc')
  const { data, loading, error, refetch } = useQuery(() => vaccinationApi.listDoses({ scheduleId, tab, page, dir }), [scheduleId, tab, page, dir])
  if (loading && !data) return <LoadingBlock />
  if (error || !data) return <ErrorBlock message={userFacingError(error, 'Không tải được danh sách mũi tiêm.')} onRetry={refetch} />
  const { rows, total, size, counts } = data
  const first = total === 0 ? 0 : (data.page - 1) * size + 1
  const toggle = (id: number) => onPick(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id])
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          options={(Object.keys(TAB_LABEL) as DoseTab[]).map((t) => ({ value: t, label: `${TAB_LABEL[t]} (${counts[t]})` }))}
          value={tab}
          onChange={(v) => { setPage(1); onTab(v as DoseTab) }}
        />
        <div className="flex-1" />
        {canWrite && picked.length > 0 && (
          <>
            <span className="text-xs font-medium text-muted">Đã chọn {picked.length} mũi</span>
            <Button variant="primary" onClick={onRecordPicked}>Ghi nhận {picked.length} mũi đã chọn</Button>
          </>
        )}
      </div>
      {rows.length === 0 ? (
        <EmptyBlock title="Không có mũi nào trong mục này" sub="Chọn tab hoặc lịch khác để xem các mũi còn lại." />
      ) : (
        <div className="flex flex-col gap-3 rounded-md border border-edge bg-white p-4">
          <Table>
            <thead>
              <tr>
                {canWrite && <Th className="w-6">{''}</Th>}
                <Th>Bò</Th><Th>Chuồng</Th><Th>Lịch · Mũi</Th>
                <Th><button type="button" className="font-semibold" onClick={() => setDir(dir === 'asc' ? 'desc' : 'asc')}>Ngày dự kiến {dir === 'asc' ? '↓' : '↑'}</button></Th>
                <Th>Trạng thái</Th>{canWrite && <Th>Thao tác</Th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={picked.includes(r.id) ? 'bg-page' : undefined}>
                  {canWrite && <Td>{r.state !== 'DONE' && <Checkbox aria-label={`Chọn ${r.cattleCode}`} checked={picked.includes(r.id)} onChange={() => toggle(r.id)} />}</Td>}
                  <Td>
                    <Link to={profilePath(r.cattleCode)} className="font-medium text-ink no-underline hover:underline">{r.cattleName ? `${r.cattleCode} “${r.cattleName}”` : r.cattleCode}</Link>
                    <span className="block text-[11px] text-muted">{r.breed} · {r.sex}</span>
                  </Td>
                  <Td>{r.penName}</Td>
                  <Td>{r.scheduleShort} · {r.doseText}</Td>
                  <Td>{fmtDate(r.effectiveDate)}</Td>
                  <Td><DoseStatusBadge row={r} /></Td>
                  {canWrite && <Td>{r.state === 'DONE' ? '—' : <><Button variant="link" onClick={() => onRecord(r.id)}>Ghi nhận</Button> · <Button variant="link" onClick={() => onDefer(r.id)}>Hoãn</Button></>}</Td>}
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination page={data.page} pageCount={Math.max(1, Math.ceil(total / size))} onChange={setPage} summary={`Hiển thị ${first}–${first + rows.length - 1} / ${total} mũi${tab === 'all' ? '' : ` ${TAB_LABEL[tab].toLowerCase()}`}`} />
        </div>
      )}
    </>
  )
}
