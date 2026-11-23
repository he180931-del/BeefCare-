import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { userFacingError } from '../../../shared/api/userFacingError'
import Layout from '../../../app/layouts/FarmPlatformLayout'
import { Button, EmptyBlock, ErrorBlock, FilterSelect, Icon, LoadingBlock, Metric, PageHeader, SearchInput, Segmented } from '../../../shared/ui'
import { useModalParam } from '../../../shared/hooks/useModalParam'
import { useSession } from '../../../app/session/sessionContext'
import { useFarmReminders } from '../hooks/useFarmOverviewUseCases'
import { dayHeading, ReminderDetailModal, ReminderRow, URGENCY_STYLE } from '../components/ReminderParts'
import { countUrgency, EMPTY_FILTERS, filterReminders, reminderGroupKey, TYPE_LABEL, typeOptionsFor, type DateRange, type ReminderFilters } from '../domain/reminderRules'
import { viewerRole } from '../domain/viewer'
import type { ReminderItem, ReminderType, Urgency } from '../types'

const TITLE = 'Nhắc việc'
const RANGES: Array<{ value: DateRange; label: string }> = [
  { value: 'all', label: 'Tất cả thời gian' }, { value: 'today', label: 'Hôm nay' }, { value: '3d', label: '3 ngày tới' }, { value: '7d', label: '7 ngày tới' },
  { value: '30d', label: '30 ngày tới' }, { value: 'due7', label: '7 ngày tới và quá hạn' },
]
const TABS = [{ value: 'ALL', label: 'Tất cả' }, { value: 'TODAY', label: 'Hôm nay' }, { value: 'UPCOMING', label: 'Sắp tới' }, { value: 'OVERDUE', label: 'Quá hạn' }]
const URGENCY_VALUES = new Set<Urgency>(['TODAY', 'UPCOMING', 'OVERDUE'])

function routeFilters(params: URLSearchParams, role: ReturnType<typeof viewerRole>) {
  const rawType = params.get('loai') ?? ''
  const rawRange = params.get('range') ?? 'all'
  const rawUrgency = params.get('muc-do') ?? 'ALL'
  const allowedTypes = typeOptionsFor(role)
  const type: ReminderFilters['type'] = allowedTypes.includes(rawType as ReminderType) ? rawType as ReminderType : ''
  const range: DateRange = RANGES.some((option) => option.value === rawRange) ? rawRange as DateRange : 'all'
  const urgency: Urgency | 'ALL' = URGENCY_VALUES.has(rawUrgency as Urgency) ? rawUrgency as Urgency : 'ALL'
  return {
    filters: { ...EMPTY_FILTERS, query: params.get('q') ?? '', range, type, pen: params.get('chuong') ?? '' },
    tab: urgency,
  }
}

function groupItems(items: ReminderItem[], byDate: boolean, timeZone?: string) {
  const groups = new Map<string, { key: string; heading: string; headCls: string; items: ReminderItem[] }>()
  for (const item of items) {
    const key = reminderGroupKey(item, byDate, timeZone)
    const style = URGENCY_STYLE[item.urgency]
    const group = groups.get(key) ?? { key, heading: byDate ? dayHeading(item, timeZone) : style.heading, headCls: byDate ? 'text-muted' : style.head, items: [] }
    group.items.push(item)
    groups.set(key, group)
  }
  return [...groups.values()]
}

export default function RemindersPage() {
  const role = viewerRole(useSession()?.role)
  const [m, , closeModal] = useModalParam()
  const [params, setParams] = useSearchParams()
  const filterParamsKey = ['q', 'range', 'loai', 'chuong'].map((key) => params.get(key) ?? '').join('\u0000')
  const urgencyKey = params.get('muc-do') ?? ''
  const initialFilters = routeFilters(params, role)
  const [draft, setDraft] = useState<ReminderFilters>(initialFilters.filters)
  const [applied, setApplied] = useState<ReminderFilters>(initialFilters.filters)
  const [tab, setTab] = useState<Urgency | 'ALL'>(initialFilters.tab)
  const [calendar, setCalendar] = useState(false)
  const { data, loading, error, refetch } = useFarmReminders(role)

  useEffect(() => {
    const next = routeFilters(params, role)
    setDraft(next.filters)
    setApplied(next.filters)
  }, [filterParamsKey, role])
  useEffect(() => { setTab(routeFilters(params, role).tab) }, [urgencyKey, role])

  const today = data?.today ?? ''
  const items = useMemo(() => data?.items ?? [], [data])
  const pens = useMemo(() => [...new Set(items.map((i) => i.pen).filter((p): p is string => Boolean(p)))].sort(), [items])
  const scoped = useMemo(() => filterReminders(items, applied, today, true, data?.timeZone), [items, applied, today, data?.timeZone])
  const counts = countUrgency(scoped)
  const visible = useMemo(() => filterReminders(scoped, { ...applied, urgency: tab }, today, false, data?.timeZone), [scoped, applied, tab, today, data?.timeZone])
  const groups = useMemo(() => groupItems(visible, calendar, data?.timeZone), [visible, calendar, data?.timeZone])

  if (loading && !data) return <Layout title={TITLE}><LoadingBlock /></Layout>
  if (error || !data) return <Layout title={TITLE}><ErrorBlock message={userFacingError(error, 'Không tải được nhắc việc.')} onRetry={refetch} /></Layout>

  const openDetail = (id: number | string) => { const next = new URLSearchParams(params); next.set('m', 'chi-tiet'); next.set('r', String(id)); setParams(next) }
  const selected = m === 'chi-tiet' ? items.find((i) => String(i.id) === params.get('r')) : undefined
  const updateFilterUrl = (filters: ReminderFilters, urgency: Urgency | 'ALL') => {
    const next = new URLSearchParams(params)
    const values: Array<[string, string]> = [
      ['q', filters.query.trim()], ['range', filters.range === 'all' ? '' : filters.range],
      ['loai', filters.type], ['chuong', filters.pen], ['muc-do', urgency === 'ALL' ? '' : urgency],
    ]
    for (const [key, value] of values) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    setParams(next, { replace: true })
  }
  const submit = (e: FormEvent) => { e.preventDefault(); setApplied(draft); updateFilterUrl(draft, tab) }
  const changeTab = (value: string) => {
    const next = value as Urgency | 'ALL'
    setTab(next)
    updateFilterUrl(applied, next)
  }

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

        {/* Bento (Figma Tab 15 ①b): Quá hạn là khối nổi bật xanh đậm; 7 ngày tới vàng nhạt khi có việc sắp đến hạn. */}
        <div className="grid grid-cols-1 gap-4 @min-[640px]:grid-cols-3">
          <Metric surface="panel" tone="emphasis" dot="#c46b56" label="Quá hạn" value={counts.OVERDUE} note="Cần xử lý sớm" />
          <Metric surface="panel" dot="#d3a142" label="Hôm nay" value={counts.TODAY} note="Trong ngày hôm nay" />
          <Metric surface="panel" tone={counts.UPCOMING ? 'warn' : 'default'} dot="#4a9b6a" label="7 ngày tới" value={counts.UPCOMING} note="Sắp đến hạn" />
        </div>

        <Segmented options={TABS} value={tab} onChange={changeTab} />

        <section aria-label="Danh sách nhắc việc" className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h2 className="m-0 text-[17px] font-bold text-[#183528]">Danh sách nhắc việc</h2>
            <span className="text-[11px] text-subtle">{visible.length} kết quả</span>
          </div>
          <div className="min-w-0 overflow-hidden rounded-2xl border border-field bg-white">
            {groups.length === 0 ? <EmptyBlock title="Không có nhắc việc phù hợp" sub="Thử đổi bộ lọc hoặc chọn tab khác." /> : groups.map((g) => (
              <div key={g.key}>
                <div className={`px-4 pb-1 pt-3 text-[10px] font-bold ${g.headCls}`}>{`${g.heading} · ${g.items.length}`}</div>
                {g.items.map((item) => <ReminderRow key={item.id} item={item} today={today} timeZone={data.timeZone} onOpen={() => openDetail(item.id)} />)}
              </div>
            ))}
          </div>
        </section>
      </div>
      {selected && <ReminderDetailModal item={selected} today={today} timeZone={data.timeZone} technician={false} onClose={closeModal} />}
    </Layout>
  )
}
