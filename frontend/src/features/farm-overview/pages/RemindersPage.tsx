import { useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { userFacingError } from '../../../api/userFacingError'
import Layout from '../../../components/Layout'
import { Icon } from '../../../components/Icon'
import { useModalParam } from '../../../components/Modal'
import { Button, EmptyBlock, ErrorBlock, FilterSelect, LoadingBlock, Metric, PageHeader, SearchInput, Segmented } from '../../../components/ui'
import { useQuery } from '../../../hooks/useApi'
import { useSession } from '../../authorization'
import { farmOverviewApi } from '../api/farmOverviewApi'
import { dayHeading, ReminderDetailModal, ReminderRow, URGENCY_STYLE } from '../components/ReminderParts'
import { countUrgency, EMPTY_FILTERS, filterReminders, TYPE_LABEL, typeOptionsFor, type DateRange, type ReminderFilters } from '../domain/reminderRules'
import { viewerRole } from '../domain/viewer'
import type { ReminderItem, ReminderType, Urgency } from '../types'

const TITLE = 'Nhắc việc'
const RANGES: Array<{ value: DateRange; label: string }> = [
  { value: 'all', label: 'Tất cả thời gian' }, { value: 'today', label: 'Hôm nay' }, { value: '3d', label: '3 ngày tới' }, { value: '7d', label: '7 ngày tới' },
]
const TABS = [{ value: 'ALL', label: 'Tất cả' }, { value: 'TODAY', label: 'Hôm nay' }, { value: 'UPCOMING', label: 'Sắp tới' }, { value: 'OVERDUE', label: 'Quá hạn' }]

function groupItems(items: ReminderItem[], byDate: boolean) {
  const groups = new Map<string, { key: string; heading: string; headCls: string; items: ReminderItem[] }>()
  for (const item of items) {
    const key = byDate ? item.dueAt?.slice(0, 10) ?? 'none' : item.urgency
    const style = URGENCY_STYLE[item.urgency]
    const group = groups.get(key) ?? { key, heading: byDate ? dayHeading(item) : style.heading, headCls: byDate ? 'text-muted' : style.head, items: [] }
    group.items.push(item)
    groups.set(key, group)
  }
  return [...groups.values()]
}

export default function RemindersPage() {
  const role = viewerRole(useSession()?.role)
  const [m, , closeModal] = useModalParam()
  const [params, setParams] = useSearchParams()
  const [draft, setDraft] = useState<ReminderFilters>(EMPTY_FILTERS)
  const [applied, setApplied] = useState<ReminderFilters>(EMPTY_FILTERS)
  const [tab, setTab] = useState<Urgency | 'ALL'>('ALL')
  const [calendar, setCalendar] = useState(false)
  const { data, loading, error, refetch } = useQuery(() => farmOverviewApi.listReminders(role), [role])

  const today = data?.today ?? ''
  const items = useMemo(() => data?.items ?? [], [data])
  const pens = useMemo(() => [...new Set(items.map((i) => i.pen).filter((p): p is string => Boolean(p)))].sort(), [items])
  const scoped = useMemo(() => filterReminders(items, applied, today, true), [items, applied, today])
  const counts = countUrgency(scoped)
  const visible = useMemo(() => filterReminders(scoped, { ...applied, urgency: tab }, today), [scoped, applied, tab, today])
  const groups = useMemo(() => groupItems(visible, calendar), [visible, calendar])

  if (loading && !data) return <Layout title={TITLE}><LoadingBlock /></Layout>
  if (error || !data) return <Layout title={TITLE}><ErrorBlock message={userFacingError(error, 'Không tải được nhắc việc.')} onRetry={refetch} /></Layout>

  const openDetail = (id: number) => { const next = new URLSearchParams(params); next.set('m', 'chi-tiet'); next.set('r', String(id)); setParams(next) }
  const selected = m === 'chi-tiet' ? items.find((i) => i.id === Number(params.get('r'))) : undefined
  const submit = (e: FormEvent) => { e.preventDefault(); setApplied(draft) }

  return (
    <Layout title={TITLE}>
      <div className="flex flex-col gap-4">
        <PageHeader title="Nhắc việc" sub="Các mốc cần xử lý theo lịch chăm sóc và dữ liệu đã ghi nhận.">
          <Button aria-pressed={calendar} onClick={() => setCalendar((v) => !v)}><Icon name="calendar-event" size={16} /> Lịch nhắc việc</Button>
        </PageHeader>

        <form onSubmit={submit} className="flex flex-wrap items-center gap-3" role="search">
          <SearchInput aria-label="Tìm nhắc việc" placeholder="Tìm theo mã bò hoặc nội dung" value={draft.query} onChange={(e) => setDraft({ ...draft, query: e.target.value })} className="w-full sm:w-[352px]" />
          <FilterSelect aria-label="Thời gian" value={draft.range} onChange={(e) => setDraft({ ...draft, range: e.target.value as DateRange })}>
            {RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </FilterSelect>
          <FilterSelect aria-label="Loại nhắc việc" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as ReminderType | '' })}>
            <option value="">Loại nhắc việc</option>
            {typeOptionsFor(role).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </FilterSelect>
          <FilterSelect aria-label="Chuồng / nhóm" value={draft.pen} onChange={(e) => setDraft({ ...draft, pen: e.target.value })}>
            <option value="">Chuồng / nhóm</option>
            {pens.map((p) => <option key={p} value={p}>{`Chuồng ${p}`}</option>)}
          </FilterSelect>
          <Button type="submit" variant="primary">Lọc</Button>
        </form>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Metric dot="#c46b56" label="Quá hạn" value={counts.OVERDUE} note="Cần xử lý sớm" />
          <Metric dot="#d3a142" label="Hôm nay" value={counts.TODAY} note="Trong ngày hôm nay" />
          <Metric dot="#4a9b6a" label="7 ngày tới" value={counts.UPCOMING} note="Sắp đến hạn" />
        </div>

        <Segmented options={TABS} value={tab} onChange={(v) => setTab(v as Urgency | 'ALL')} />

        <section aria-label="Danh sách nhắc việc" className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h2 className="m-0 text-[17px] font-bold text-[#183528]">Danh sách nhắc việc</h2>
            <span className="text-[11px] text-subtle">{visible.length} kết quả</span>
          </div>
          <div className="rounded-md border border-edge bg-white">
            {groups.length === 0 ? <EmptyBlock title="Không có nhắc việc phù hợp" sub="Thử đổi bộ lọc hoặc chọn tab khác." /> : groups.map((g) => (
              <div key={g.key}>
                <div className={`px-4 pb-1 pt-3 text-[10px] font-bold ${g.headCls}`}>{`${g.heading} · ${g.items.length}`}</div>
                {g.items.map((item) => <ReminderRow key={item.id} item={item} today={today} onOpen={() => openDetail(item.id)} />)}
              </div>
            ))}
          </div>
        </section>
      </div>
      {selected && <ReminderDetailModal item={selected} today={today} technician={false} onClose={closeModal} />}
    </Layout>
  )
}
