import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Badge, Button, Checkbox, EmptyBlock, ErrorBlock, Foot, Icon, LoadingBlock, Note, NoticeDialog, PageHeader, Pagination, Panel, SearchInput, Select, Table, Tabs, Td, Th } from '../../../shared/ui'
import { cx } from '../../../shared/ui/cx'
import Layout from '../../../app/layouts/FarmPlatformLayout'
import { userFacingError } from '../../../shared/api/userFacingError'
import { useDemoState } from '../../../demo/demoModules'
import { DoseStatusBadge, profilePath, recordPath, useCanWrite, useNotice } from '../components/vaccinationParts'
import { fmtDate } from '../domain/vaccinationFormat'
import { useVaccinationDoses, useVaccinationOptions, useVaccinationSchedules } from '../hooks/useVaccinationUseCase'
import type { DoseFilters, DoseTab, DueState, HerdGroup, ScheduleCard, VaccinationOptions } from '../types'

const TITLE = 'Tiêm phòng'
/** D46: chỉ còn 4 tab; số ngày "Đến hạn" lấy theo tham số trại "Thời gian nhắc tiêm". */
const TAB_ORDER: DoseTab[] = ['all', 'overdue', 'due', 'done']
const tabLabel = (tab: DoseTab, leadDays: number) =>
  ({ all: 'Tất cả', overdue: 'Quá hạn', due: `Đến hạn trong ${leadDays} ngày`, done: 'Đã tiêm' })[tab]

/** Vạch màu đầu dòng theo hạn tiêm (cùng màu với huy hiệu trạng thái). */
const STATE_EDGE: Record<DueState, string> = {
  OVERDUE: 'border-l-[#cc6b5c]', DUE: 'border-l-[#d6a34d]', UPCOMING: 'border-l-transparent', DONE: 'border-l-[#9fd3b2]',
}

/** Mũi đã chọn kèm vắc-xin của lịch: một lần ghi theo lô chỉ dùng một vắc-xin (D47). */
type PickedDose = { id: number; vaccineId: number }
/** Bộ lọc như màn chọn bò vào phiếu: tìm theo mã / tên bò, chuồng, nhóm đàn (D47). */
type RowFilters = Pick<DoseFilters, 'q' | 'penCode' | 'herdGroup'>
const MIXED_VACCINES = 'Các mũi đã chọn thuộc nhiều vắc-xin khác nhau. Hãy chọn một lịch (bấm thẻ lịch) rồi ghi từng lịch.'

const cardInfo = (c: ScheduleCard) => {
  const s = c.schedule
  const tail = s.doseCount > 1 ? `${s.doseCount} mũi cách ${s.intervalDays} ngày` : s.boosterIntervalMonths ? `nhắc lại sau ${s.boosterIntervalMonths} tháng` : '1 mũi'
  return `${c.vaccine.name} · ${tail}`
}

export default function SchedulePage() {
  const navigate = useNavigate()
  const canWrite = useCanWrite()
  const demo = useDemoState()
  const [notice] = useNotice()
  const [selected, setSelected] = useState<number | null | undefined>(undefined) // undefined: lịch đầu tiên, null: tất cả
  const [showCompleted, setShowCompleted] = useState(false)
  const [tab, setTab] = useState<DoseTab>('overdue')
  const [picked, setPicked] = useState<PickedDose[]>([])
  const [filters, setFilters] = useState<RowFilters>({})
  const [reload] = useState(0)
  const [hint, setHint] = useState<string | null>(null)
  const cards = useVaccinationSchedules(reload, demo)
  const options = useVaccinationOptions()

  if (cards.loading && !cards.data) return <Layout title={TITLE}><LoadingBlock /></Layout>
  if (cards.error || !cards.data) return <Layout title={TITLE}><ErrorBlock message={userFacingError(cards.error, 'Không tải được lịch tiêm phòng.')} onRetry={cards.refetch} /></Layout>

  // D48: hàng thẻ chỉ có lịch đang chạy; lịch đã hoàn thành gom vào mục đóng / mở riêng để trang không phình dần.
  const running = cards.data.filter((c) => !c.schedule.completed)
  const completed = cards.data.filter((c) => c.schedule.completed)
  const scheduleId = selected === undefined ? running[0]?.schedule.id : selected ?? undefined
  const pick = (id: number) => { setSelected(id === scheduleId ? null : id); setTab('all') }
  const mixed = new Set(picked.map((p) => p.vaccineId)).size > 1
  const recordPicked = () => {
    if (!picked.length) return setHint('Chọn ít nhất một mũi trong danh sách để ghi nhận.')
    if (mixed) return setHint(MIXED_VACCINES)
    navigate(recordPath({ doses: picked.map((p) => p.id).join(',') }))
  }

  return (
    <Layout title={TITLE}>
      <div className="flex flex-col gap-5">
        <PageHeader title={TITLE} sub={`${running.length} lịch đang chạy · chọn mũi để ghi nhận hàng loạt`}>
          <Button onClick={() => navigate('/tiem-phong/lich-su')}><Icon name="history" />Lịch sử tiêm</Button>
          {canWrite && <Button onClick={() => navigate('/tiem-phong/quan-ly')}>Quản lý lịch</Button>}
          {canWrite && <Button variant="primary" onClick={recordPicked}><Icon name="circle-plus" />Ghi nhận tiêm</Button>}
        </PageHeader>
        {notice && <Note tone="ok">{notice}</Note>}
        {hint && <NoticeDialog title="Chưa ghi nhận được" message={hint} onClose={() => setHint(null)} />}
        <div className="grid gap-4 md:grid-cols-3">
          {running.map((c) => <ScheduleCardView key={c.schedule.id} card={c} active={c.schedule.id === scheduleId} onClick={() => pick(c.schedule.id)} />)}
        </div>
        {running.length === 0 && <EmptyBlock title="Chưa có lịch tiêm nào đang chạy" sub={canWrite ? 'Dùng "Quản lý lịch" để tạo lịch tiêm mới.' : undefined} />}
        {completed.length > 0 && (
          <div className="flex flex-col gap-3">
            <div>
              <Button aria-expanded={showCompleted} onClick={() => setShowCompleted(!showCompleted)}>
                <Icon name="circle-check" />{showCompleted ? 'Ẩn lịch đã hoàn thành' : `Lịch đã hoàn thành (${completed.length})`}
              </Button>
            </div>
            {showCompleted && (
              <div className="grid gap-4 md:grid-cols-3">
                {completed.map((c) => <ScheduleCardView key={c.schedule.id} card={c} active={c.schedule.id === scheduleId} onClick={() => pick(c.schedule.id)} />)}
              </div>
            )}
          </div>
        )}
        <DoseList
          key={`${scheduleId}-${reload}`} scheduleId={scheduleId} tab={tab} onTab={setTab} canWrite={canWrite}
          filters={filters} onFilters={setFilters} options={options.data ?? null}
          picked={picked} onPick={(next) => { setPicked(next); setHint(null) }}
          onRecordPicked={recordPicked} onRecord={(id) => navigate(recordPath({ doses: String(id) }))}
        />
        <Foot>Màn lịch tiêm cấp đàn. Thẻ lịch cho biết tiến độ từng lịch đang chạy; nhấn thẻ để lọc danh sách theo lịch đó. Lịch đã tiêm xong gom trong mục "Lịch đã hoàn thành" (bấm để mở, chọn thẻ để xem lại các mũi). Tab đếm mũi theo hạn tiêm; lịch đã tiêm xong hết hiện "Đã hoàn thành" và bị khóa sửa. Lọc theo mã bò, chuồng, nhóm đàn rồi tick từng mũi hoặc "Chọn tất cả" (mọi mũi chưa tiêm khớp bộ lọc, kể cả trang khác) và nhấn "Ghi nhận n mũi đã chọn"; mỗi lần ghi chỉ một vắc-xin; Chủ trại và Kỹ thuật viên chỉ xem, không có ô chọn và cột Thao tác.</Foot>
      </div>
    </Layout>
  )
}

function ScheduleCardView({ card, active, onClick }: { card: ScheduleCard; active: boolean; onClick: () => void }) {
  const pct = card.targetCount ? Math.round((card.doneCount / card.targetCount) * 100) : 0
  // Bento (Figma Tab 17 ②b): lịch đang chọn là khối xanh đậm; lịch đúng tiến độ nền xanh nhạt; nhãn chữ luôn đi kèm màu.
  const surface = active ? 'border-brand-dark bg-brand-dark' : card.overdueCount > 0 ? 'border-field bg-white hover:bg-[#f4f8f5]' : 'border-ok-bg bg-ok-bg'
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={`flex min-w-0 cursor-pointer flex-col gap-2 rounded-2xl border p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${surface}`}>
      <span className="flex items-center justify-between gap-2">
        <span className={`text-sm font-semibold ${active ? 'text-white' : 'text-ink'}`}>{card.schedule.name}</span>
        {card.schedule.completed
          ? <Badge tone="ok" icon="circle-check" className={active ? undefined : 'border-white! bg-white!'}>Đã hoàn thành</Badge>
          : card.overdueCount > 0
            ? <Badge tone="err" icon="alert-triangle">{card.overdueCount} quá hạn</Badge>
            : <Badge tone="ok" className={active ? undefined : 'border-white! bg-white!'}>Đúng tiến độ</Badge>}
      </span>
      <span className={`text-xs ${active ? 'text-side-text' : 'text-muted'}`}>{cardInfo(card)}</span>
      <span className={`h-1.5 w-full overflow-hidden rounded-full ${active ? 'bg-white/20' : 'bg-chip'}`}><span className={`block h-full rounded-full ${active ? 'bg-white' : 'bg-brand'}`} style={{ width: `${pct}%` }} /></span>
      <span className={`text-xs font-medium ${active ? 'text-white' : 'text-ink'}`}>Đã tiêm {card.doneCount} / {card.targetCount}</span>
    </button>
  )
}

function DoseList({ scheduleId, tab, onTab, canWrite, filters, onFilters, options, picked, onPick, onRecordPicked, onRecord }: {
  scheduleId?: number; tab: DoseTab; onTab: (t: DoseTab) => void; canWrite: boolean
  filters: RowFilters; onFilters: (f: RowFilters) => void; options: VaccinationOptions | null
  picked: PickedDose[]; onPick: (next: PickedDose[]) => void
  onRecordPicked: () => void; onRecord: (id: number) => void
}) {
  const [page, setPage] = useState(1)
  const [dir, setDir] = useState<'asc' | 'desc'>('asc')
  const { data, loading, error, refetch } = useVaccinationDoses({ scheduleId, tab, ...filters, page, dir })
  if (loading && !data) return <LoadingBlock />
  if (error || !data) return <ErrorBlock message={userFacingError(error, 'Không tải được danh sách mũi tiêm.')} onRetry={refetch} />
  const { rows, total, size, counts, leadDays, selectable } = data
  const first = total === 0 ? 0 : (data.page - 1) * size + 1
  const pickedIds = new Set(picked.map((p) => p.id))
  const toggle = (id: number, vaccineId: number) =>
    onPick(pickedIds.has(id) ? picked.filter((p) => p.id !== id) : [...picked, { id, vaccineId }])
  // "Chọn tất cả": mọi mũi chưa tiêm khớp bộ lọc (mọi trang). Chỉ bật khi chúng cùng một vắc-xin.
  const oneVaccine = new Set(selectable.map((d) => d.vaccineId)).size <= 1
  const allPicked = selectable.length > 0 && selectable.every((d) => pickedIds.has(d.id))
  const toggleAll = () => {
    const ids = new Set(selectable.map((d) => d.id))
    onPick(allPicked ? picked.filter((p) => !ids.has(p.id)) : [...picked, ...selectable.filter((d) => !pickedIds.has(d.id))])
  }
  const mixed = new Set(picked.map((p) => p.vaccineId)).size > 1
  const setFilter = (patch: RowFilters) => { setPage(1); onFilters({ ...filters, ...patch }) }
  return (
    <Panel className="gap-0 overflow-hidden p-0!">
      <div className="flex flex-col gap-3 border-b border-rule px-4 pt-3 @min-[1024px]:px-6">
        <Tabs value={tab} onChange={(v) => { setPage(1); onTab(v as DoseTab) }} tabs={TAB_ORDER.map((t) => ({ value: t, label: `${tabLabel(t, leadDays)} (${counts[t]})` }))} />
        <div className="flex flex-wrap items-center gap-2.5 pb-4">
          <SearchInput className="w-full sm:w-[260px]" aria-label="Tìm mã bò, tên bò" placeholder="Tìm mã bò, tên bò" value={filters.q ?? ''} onChange={(e) => setFilter({ q: e.target.value || undefined })} />
          <Select className="w-full sm:w-[200px]" aria-label="Chuồng" value={filters.penCode ?? ''} onChange={(e) => setFilter({ penCode: e.target.value || undefined })}>
            <option value="">Chuồng: Tất cả</option>
            {(options?.pens ?? []).map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
          </Select>
          <Select className="w-full sm:w-[200px]" aria-label="Nhóm đàn" value={filters.herdGroup ?? ''} onChange={(e) => setFilter({ herdGroup: (e.target.value || undefined) as HerdGroup | undefined })}>
            <option value="">Nhóm đàn: Tất cả</option>
            {(options?.herdGroups ?? []).map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
          </Select>
          {canWrite && picked.length > 0 && (
            <div className="ml-auto flex items-center gap-2.5">
              <span className="text-xs font-medium text-muted">Đã chọn {picked.length} mũi</span>
              <Button variant="link" onClick={() => onPick([])}>Bỏ chọn</Button>
              <Button variant="primary" disabled={mixed} onClick={onRecordPicked}>Ghi nhận {picked.length} mũi đã chọn</Button>
            </div>
          )}
        </div>
        {canWrite && mixed && <div className="pb-3"><Note tone="warn">{MIXED_VACCINES}</Note></div>}
      </div>
      {rows.length === 0 ? (
        // Trống nằm ngay trong khối danh sách, không thêm khung viền thứ hai.
        <div className="flex flex-col items-center gap-1 px-4 py-10 text-center">
          <p className="m-0 text-sm font-semibold text-ink">Không có mũi nào trong mục này</p>
          <p className="m-0 text-xs text-muted">Chọn tab, lịch hoặc bộ lọc khác để xem các mũi còn lại.</p>
        </div>
      ) : (
        <>
          <Table wide bordered={false}>
            <thead>
              <tr>
                {canWrite && (
                  <Th className="w-6">
                    <Checkbox
                      aria-label={oneVaccine ? `Chọn tất cả ${selectable.length} mũi chưa tiêm` : 'Chọn một lịch để chọn tất cả'}
                      title={oneVaccine ? undefined : 'Các mũi thuộc nhiều vắc-xin: chọn một lịch để chọn tất cả'}
                      checked={allPicked}
                      disabled={!selectable.length || !oneVaccine}
                      onChange={toggleAll}
                    />
                  </Th>
                )}
                <Th>Bò</Th><Th>Lịch · Mũi</Th>
                <Th><button type="button" className="font-semibold" onClick={() => setDir(dir === 'asc' ? 'desc' : 'asc')}>Hạn tiêm {dir === 'asc' ? '↓' : '↑'}</button></Th>
                <Th>Trạng thái</Th>{canWrite && <Th>Thao tác</Th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={pickedIds.has(r.id) ? 'bg-page' : undefined}>
                  {canWrite && <Td className={cx('border-l-4', STATE_EDGE[r.state])}>{r.state !== 'DONE' && <Checkbox aria-label={`Chọn ${r.cattleCode}`} checked={pickedIds.has(r.id)} onChange={() => toggle(r.id, r.vaccineId)} />}</Td>}
                  <Td className={canWrite ? undefined : cx('border-l-4', STATE_EDGE[r.state])}>
                    <Link to={profilePath(r.cattleCode)} className="font-medium text-ink no-underline hover:underline">{r.cattleName ? `${r.cattleCode} · ${r.cattleName}` : r.cattleCode}</Link>
                    <span className="block text-[11px] text-muted">{[r.breed, r.sex, r.penName].filter(Boolean).join(' · ')}</span>
                  </Td>
                  <Td>{r.scheduleShort} · {r.doseText}</Td>
                  <Td className="whitespace-nowrap">{fmtDate(r.dueDate)}</Td>
                  <Td><DoseStatusBadge row={r} /></Td>
                  {canWrite && <Td>{r.state === 'DONE' ? '—' : <Button variant="link" onClick={() => onRecord(r.id)}>Ghi nhận</Button>}</Td>}
                </tr>
              ))}
            </tbody>
          </Table>
          <div className="border-t border-rule px-4 py-3">
            <Pagination page={data.page} pageCount={Math.max(1, Math.ceil(total / size))} onChange={setPage} summary={`Hiển thị ${first}–${first + rows.length - 1} / ${total} mũi${tab === 'all' ? '' : ` ${tabLabel(tab, leadDays).toLowerCase()}`}`} />
          </div>
        </>
      )}
    </Panel>
  )
}
