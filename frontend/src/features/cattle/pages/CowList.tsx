import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Layout from '../../../app/layouts/FarmPlatformLayout'
import {
  activateTableRow, activateTableRowByKey, Button, ErrorBlock, Foot, Icon, interactiveRowClass, PageHeader, Pagination, Panel, SearchInput, Select, Table, Tabs,
} from '../../../shared/ui'
import { cx } from '../../../shared/ui/cx'
import { dm } from '../../../shared/lib/format'
import { useSession } from '../../../app/session/sessionContext'
import { LIFE_STAGE_OPTIONS, useCattleListQueries } from '../hooks/useCattleQueries'
import { Chip, Th, Td, chipIcon } from '../components/parts'
import type { StatusChip } from '../types'
import type { CattleViewModel as CowSeed } from '../types'

// Máy chủ thật lọc, đếm và phân trang; bản mô phỏng tính tại trình duyệt từ đàn mẫu.
const EXPORTED = 'Đã xuất'
const TAB_STAGE: Record<string, string> = { 'Tất cả': '', 'Khác': 'Chưa xác định' }
type LocalStage = 'Bò cái sinh sản' | 'Bò tơ' | 'Vỗ béo' | 'Bê' | 'Đực giống' | 'Chưa xác định'
// Nhóm đàn theo hợp đồng backend (GBR-24) và khóa đếm tương ứng trong `counts`.
const TAB_GROUP: Record<string, string> = { 'Bò cái sinh sản': 'BREEDING_FEMALES', 'Bò tơ': 'YOUNG_STOCK', 'Vỗ béo': 'FATTENING', 'Bê': 'CALVES', 'Đực giống': 'BREEDING_BULLS', 'Khác': 'OTHER' }
const GROUP_TAB: Record<string, string> = { BREEDING_FEMALE: 'Bò cái sinh sản', YOUNG_STOCK: 'Bò tơ', FATTENING: 'Vỗ béo', CALF: 'Bê', BREEDING_BULL: 'Đực giống', OTHER: 'Khác' }
const TAB_HERD_GROUP = Object.fromEntries(Object.entries(GROUP_TAB).map(([group, label]) => [label, group])) as Record<string, string>
const STATUS_OPTIONS = [['ACTIVE', 'Đang nuôi'], ['EXIT_PENDING', 'Chờ xuất'], ['EXITED', 'Đã xuất'], ['VOIDED', 'Đã hủy'], ['ALL', 'Tất cả']] as const
const HEALTH_OPTIONS = [['HEALTHY', 'Khỏe'], ['MONITORING', 'Theo dõi'], ['UNDER_TREATMENT', 'Đang điều trị'], ['MEAT_WITHDRAWAL', 'Ngưng sử dụng thịt']] as const
const LOCAL_HEALTH: Record<string, string> = { HEALTHY: 'Khỏe', MONITORING: 'Theo dõi', UNDER_TREATMENT: 'Đang điều trị' }
/** 10 con mỗi trang (D75), cả máy chủ thật lẫn bản mô phỏng. */
const PAGE_SIZE = 10
const SELECT_CLS = 'w-full min-w-0 sm:w-[180px] [&_select]:!leading-[normal]'
const SORT_FIELDS = {
  displayCode: ['Mã bò', (cow: CowSeed) => cow.code],
  name: ['Tên bò', (cow: CowSeed) => cow.name],
  breedName: ['Giống', (cow: CowSeed) => cow.breed],
  birthDate: ['Ngày sinh', (cow: CowSeed) => cow.ageShort === '—' ? null : -cow.months],
  penCode: ['Chuồng', (cow: CowSeed) => cow.barn],
  purposeName: ['Mục đích', (cow: CowSeed) => cow.purpose],
  latestWeightKg: ['Cân gần nhất', (cow: CowSeed) => cow.weight],
} as const
type SortField = keyof typeof SORT_FIELDS
const SORT_OPTIONS = Object.entries(SORT_FIELDS).flatMap(([key, [label]]) =>
  [[key, `${label} ↑`], [`-${key}`, `${label} ↓`]],
)
const textOrder = new Intl.Collator('vi', { sensitivity: 'base', numeric: true })

const withdrawalLabel = (until?: string) => (until ? `Cách ly thịt đến ${/^\d{4}-/.test(until) ? dm(until) : until}` : '')
const HEALTHY = new Set(['Khỏe', 'Khỏe mạnh'])
/** Đang điều trị luôn đỏ, kể cả khi nhãn gộp với ngưng thịt ("Đang điều trị · Ngưng sử dụng thịt"). */
const healthTone = (c: CowSeed) => (c.health?.label.startsWith('Đang điều trị') ? 'err' : c.health?.tone)

/** Trạng thái đàn chỉ hiện khi khác "Đang nuôi" (D75): đang nuôi là mặc định, lặp lại ở mọi dòng chỉ thêm chữ. */
function exitStatus(c: CowSeed): { text: string; detail?: string; tone: string } | null {
  if (c.status === 'EXITED') return { text: 'Đã xuất', detail: c.exitStatusLabel?.replace('Đã xuất · ', ''), tone: 'text-muted' }
  if (c.status === 'VOIDED') return { text: 'Đã hủy', tone: 'text-muted' }
  if (c.status === 'EXIT_PENDING' || c.exitPending) return { text: 'Chờ xuất', tone: 'font-semibold text-warn-fg' }
  return null
}

/** Vạch đầu dòng: đỏ khi sức khỏe cần xử lý, vàng khi theo dõi / ngưng thịt / chờ xuất, không tô khi bình thường. */
function edgeOf(c: CowSeed): string {
  if (healthTone(c) === 'err') return 'border-l-[#cc6b5c]'
  if (healthTone(c) === 'warn' || c.withdrawalUntil || c.status === 'EXIT_PENDING' || c.exitPending) return 'border-l-[#d6a34d]'
  return 'border-l-transparent'
}

/** Sức khỏe: "Khỏe" là chữ xám thường, chỉ tô màu khi có chuyện (Bento §3). */
function HealthCell({ c }: { c: CowSeed }) {
  const withdrawal = withdrawalLabel(c.withdrawalUntil)
  if (!c.health) return <span className="text-muted">—</span>
  return (
    <div className="flex flex-col items-start gap-1">
      {HEALTHY.has(c.health.label) ? <span className="text-muted">{c.health.label}</span> : <Chip tone={healthTone(c)} icon={chipIcon(c.health.label)}>{c.health.label}</Chip>}
      {withdrawal && <span className="text-[11px] font-medium text-warn-fg">{withdrawal}</span>}
    </div>
  )
}

/** Một dòng đàn bò (D75): giống · giới tính · tuổi gộp vào dòng phụ của Bò; cả dòng mở hồ sơ. */
function CowRow({ c, barnTag, onOpen }: { c: CowSeed; barnTag: string; onOpen: (code: string) => void }) {
  const status = exitStatus(c)
  const open = () => onOpen(c.code)
  const weighed = c.weightDate && c.weightDate !== '—' ? c.weightDate : ''
  return (
    <tr tabIndex={0} aria-label={`Mở hồ sơ ${c.code}`} className={interactiveRowClass}
      onClick={(event) => activateTableRow(event, open)} onKeyDown={(event) => activateTableRowByKey(event, open)}>
      <Td className={cx('border-l-4', edgeOf(c))}>
        <span className="font-medium"><span>{c.code}</span>{c.name && <span> “{c.name}”</span>}</span>
        <span className="block text-[11px] text-muted">{[c.breed, c.sex, c.ageShort !== '—' && c.ageShort].filter(Boolean).join(' · ')}</span>
      </Td>
      <Td>{c.barn ? `${c.barn}${barnTag ? ` · ${barnTag}` : ''}` : '—'}</Td>
      <Td>{c.purpose}<span className="block text-[11px] text-muted">{c.stage}</span></Td>
      <Td className="whitespace-nowrap">
        {c.weight != null ? `${c.weight} kg${c.weightEst ? '*' : ''}` : '—'}
        {weighed && <span className="block text-[11px] text-muted">{weighed}</span>}
      </Td>
      <Td>
        {status && <div className={status.tone}>{status.text}{status.detail && !status.detail.includes('· —') && <span className="block text-[11px] font-normal text-muted">{status.detail}</span>}</div>}
        {!status && <HealthCell c={c} />}
        {status && status.text === 'Chờ xuất' && <HealthCell c={c} />}
      </Td>
      <Td>{c.repro && c.repro.label !== 'Không áp dụng' ? <Chip tone={c.repro.tone} icon={chipIcon(c.repro.label)}>{c.repro.label}</Chip> : null}</Td>
      <Td><Icon name="chevron-right" size={14} /></Td>
    </tr>
  )
}

export default function CowList() {
  const nav = useNavigate()
  const session = useSession()
  const [params, setParams] = useSearchParams()
  const herdGroupParam = params.get('nhom') ?? ''
  const skipGroupUrlSync = useRef(false)
  const [q, setQ] = useState(params.get('q') ?? '')
  const [debouncedQ, setDebouncedQ] = useState(q)
  const [breed, setBreed] = useState('')
  const [sex, setSex] = useState('')
  // ?pen= mở từ SCR-17 "Xem tất cả n con" (id chuồng ở backend, mã chuồng ở chế độ demo)
  const [barn, setBarn] = useState(params.get('pen') ?? '')
  const [stageSel, setStageSel] = useState('ALL')
  const [purpose, setPurpose] = useState('')
  const [health, setHealth] = useState('')
  const [status, setStatus] = useState('ACTIVE')
  const [tab, setTab] = useState(() => GROUP_TAB[herdGroupParam] ?? 'Tất cả')
  const [page, setPage] = useState(0)
  const [sort, setSort] = useState('displayCode')
  const [weightFilter, setWeightFilter] = useState('')
  const [moreFilters, setMoreFilters] = useState(false)
  const sortField = sort.replace(/^-/, '') as SortField
  const descending = sort.startsWith('-')

  // Ô tìm kiếm trên thanh trên đổi ?q= ngay trên trang này.
  const urlQ = params.get('q') ?? ''
  useEffect(() => { setQ(urlQ) }, [urlQ])
  useEffect(() => {
    if (skipGroupUrlSync.current) {
      skipGroupUrlSync.current = false
      return
    }
    setStatus('ACTIVE')
    setTab(GROUP_TAB[herdGroupParam] ?? 'Tất cả')
  }, [herdGroupParam])
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q), backend ? 300 : 0)
    return () => clearTimeout(timer)
  }, [q])
  useEffect(() => { setPage(0) }, [debouncedQ, breed, sex, barn, stageSel, purpose, health, status, tab])

  const group = status === 'ACTIVE' ? TAB_GROUP[tab] : undefined
  const { backend, local, listQuery, barnsQuery, breedsQuery, purposesQuery } = useCattleListQueries({
    q: debouncedQ,
    breedId: breed,
    sex,
    penId: barn,
    purposeId: purpose,
    lifeStage: stageSel === 'ALL' ? '' : stageSel,
    health,
    herdStatus: status,
    herdGroup: group,
    page,
    size: PAGE_SIZE,
    sort,
    weightFilter,
  })
  const cows = useMemo(() => listQuery.data?.items ?? [], [listQuery.data])
  const counts = listQuery.data?.counts ?? {}
  const barnRows = barnsQuery.data ?? []
  const barnsByCode = Object.fromEntries(barnRows.map((b) => [b.code, b]))

  const localTotal = local ? local.stages.reduce((sum, s) => sum + local.groupCount(cows, s), 0) : 0
  const total = backend ? counts.ACTIVE ?? 0 : localTotal
  const exportedTotal = local ? local.exported : counts.EXITED ?? 0
  const countOf = (label: string, stage: LocalStage) => (local ? local.groupCount(cows, stage) : counts[TAB_GROUP[label]] ?? 0)
  const tabs = [
    ['Tất cả', `Tất cả (${total})`],
    ['Bò cái sinh sản', `Bò cái sinh sản (${countOf('Bò cái sinh sản', 'Bò cái sinh sản')})`],
    ['Bò tơ', `Bò tơ (${countOf('Bò tơ', 'Bò tơ')})`],
    ['Vỗ béo', `Vỗ béo (${countOf('Vỗ béo', 'Vỗ béo')})`],
    ['Bê', `Bê (${countOf('Bê', 'Bê')})`],
    ['Đực giống', `Đực giống (${countOf('Đực giống', 'Đực giống')})`],
    ['Khác', `Khác (${countOf('Khác', 'Chưa xác định')})`],
    [EXPORTED, `Đã xuất (${exportedTotal})`],
  ]

  const onTab = (value: string) => {
    if (value === EXPORTED) setStatus('EXITED')
    else if (tab === EXPORTED) setStatus('ACTIVE')
    setTab(value)
    const next = new URLSearchParams(params)
    const group = value === EXPORTED ? undefined : TAB_HERD_GROUP[value]
    if (group) next.set('nhom', group)
    else next.delete('nhom')
    if (next.toString() !== params.toString()) {
      skipGroupUrlSync.current = true
      setParams(next, { replace: true })
    }
  }
  const onStatus = (value: string) => {
    setStatus(value)
    if (tab === EXPORTED && value !== 'EXITED') setTab('Tất cả')
    else if (value !== 'ACTIVE' && tab !== EXPORTED) setTab('Tất cả')
    if (value !== 'ACTIVE' && herdGroupParam) {
      const next = new URLSearchParams(params)
      next.delete('nhom')
      skipGroupUrlSync.current = true
      setParams(next, { replace: true })
    }
  }
  const changeSort = (value: string) => {
    setPage(0)
    setSort(value)
  }

  // Chế độ mock lọc tại chỗ; chế độ backend để máy chủ lọc và phân trang.
  const rows = useMemo(() => {
    if (backend) return cows
    const kw = debouncedQ.trim().toLowerCase()
    const stage = TAB_STAGE[tab] ?? tab
    return cows.filter(
      (c) =>
        (status === 'ALL' ? true : status === 'ACTIVE' ? c.inList && c.status === 'ACTIVE' : c.status === status) &&
        (status !== 'ACTIVE' || !stage || c.stage === stage) &&
        (!breed || c.breed === breed) &&
        (!sex || c.sex === sex) &&
        (!barn || c.barn === barn) &&
        (!purpose || c.purpose === purpose) &&
        (!health || (health === 'MEAT_WITHDRAWAL' ? !!c.withdrawalUntil : c.health?.label === LOCAL_HEALTH[health])) &&
        (!stageSel || stageSel === 'ALL' || c.stage === stageSel) &&
        (!weightFilter || (c.weight != null) === (weightFilter === 'yes')) &&
        (!kw || [c.code, c.tag, c.name].some((v) => v && v.toLowerCase().includes(kw))),
    ).sort((left, right) => {
      const value = SORT_FIELDS[sortField][1]
      const a = value(left)
      const b = value(right)
      const missingA = a == null || a === ''
      const missingB = b == null || b === ''
      const order = missingA || missingB
        ? Number(missingA) - Number(missingB)
        : (typeof a === 'number' && typeof b === 'number' ? a - b : textOrder.compare(String(a), String(b))) * (descending ? -1 : 1)
      return order || textOrder.compare(left.code, right.code)
    })
  }, [cows, debouncedQ, breed, sex, barn, purpose, health, status, stageSel, tab, weightFilter, sortField, descending])

  const barnTagOf = (c: CowSeed) => c.barnTag || barnsByCode[c.barn]?.tag || ''
  const size = backend ? listQuery.data?.size || PAGE_SIZE : PAGE_SIZE
  const grandTotal = backend ? listQuery.data?.total ?? 0 : rows.length
  // Máy chủ thật đã phân trang; bản mô phỏng cắt trang tại trình duyệt.
  const pageRows = backend ? rows : rows.slice(page * size, (page + 1) * size)
  const pageCount = Math.max(1, Math.ceil(grandTotal / size))
  const canEnter = session?.role !== 'TECHNICIAN'
  const initialLoad = listQuery.loading && !listQuery.data

  const sexOptions = backend ? [['FEMALE', 'Cái'], ['MALE', 'Đực']] : [['Cái', 'Cái'], ['Đực', 'Đực']]
  const breedOptions = backend ? (breedsQuery.data ?? []).map((b) => [String(b.id), b.name]) : (local?.breeds ?? []).map((b) => [b, b])
  const barnOptions = backend ? barnRows.filter((b) => typeof b.backendId === 'number').map((b) => [String(b.backendId), b.code]) : (local?.barns ?? []).map((b) => [b, b])
  const purposeOptions = backend ? (purposesQuery.data ?? []).filter((p) => p.available).map((p) => [String(p.id), p.name]) : [...new Set(cows.map((c) => c.purpose))].map((p) => [p, p])
  const stageOptions = backend ? LIFE_STAGE_OPTIONS.map((o) => [o.value, o.label]) : (local?.stages ?? []).map((s) => [s, s])

  // Bộ lọc ít dùng gom sau nút "Bộ lọc khác"; số trên nút là số bộ lọc đang áp (D75). Sắp xếp không tính là lọc.
  const extraActive = [breed, sex, stageSel !== 'ALL', purpose, weightFilter].filter(Boolean).length
  const showMore = moreFilters || extraActive > 0
  const filterSelect = (label: string, value: string, onChange: (value: string) => void, options: ReadonlyArray<ReadonlyArray<string>>, all = 'Tất cả', allValue = '') => (
    <Select className={SELECT_CLS} aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value={allValue}>{label}: {all}</option>
      {options.map(([v, text]) => <option key={v} value={v}>{label}: {text}</option>)}
    </Select>
  )
  const sortableHeader = (field: SortField, label: string) => (
    <Th aria-sort={sortField === field ? (descending ? 'descending' : 'ascending') : undefined}>
      <button type="button" className="cursor-pointer font-semibold hover:underline" onClick={() => changeSort(sort === field ? `-${field}` : field)}>
        {label} <span aria-hidden="true">{sortField === field ? (descending ? '↓' : '↑') : '↕'}</span>
      </button>
    </Th>
  )
  const first = grandTotal === 0 ? 0 : page * size + 1

  return (
    <Layout title="Đàn bò – Danh sách" user="manager">
      <div className="@container flex min-w-0 flex-col gap-5 leading-[normal]">
        <PageHeader title="Đàn bò" sub={`${initialLoad ? '…' : total} con đang nuôi · ${exportedTotal} con đã xuất đàn`}>
          <Button className="gap-1.5 leading-[normal]" onClick={() => nav('/quet-qr')}><Icon name="qrcode" />Quét QR</Button>
          {canEnter && <Button variant="primary" className="gap-1.5 leading-[normal]" onClick={() => nav('/herd-entry/new', { state: { from: '/cattle' } })}><Icon name="circle-plus" />Nhập đàn</Button>}
        </PageHeader>

        {/* Bento (D75): một khối gồm tab nhóm đàn (gạch chân), bộ lọc và bảng – như Sức khỏe, Sinh sản, Cân nặng. */}
        <Panel className="gap-0 overflow-hidden p-0!">
          <section aria-label="Bộ lọc đàn bò" className="flex flex-col gap-3 border-b border-rule px-4 pt-3 @min-[1024px]:px-6">
            <div role="group" aria-label="Nhóm đàn"><Tabs value={tab} onChange={onTab} tabs={tabs.map(([value, label]) => ({ value, label }))} /></div>
            <div className="flex flex-wrap items-center gap-2.5 pb-4">
              <SearchInput className="w-full sm:w-[260px]" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Mã hiển thị, số tai, tên gọi…" aria-label="Tìm bò" />
              <Select className="w-full min-w-0 sm:w-[230px] [&_select]:!leading-[normal]" aria-label="Trạng thái đàn" value={status} onChange={(e) => onStatus(e.target.value)}>
                {STATUS_OPTIONS.map(([v, text]) => <option key={v} value={v}>Trạng thái đàn: {text}</option>)}
              </Select>
              {filterSelect('Chuồng', barn, setBarn, barnOptions)}
              {filterSelect('Sức khỏe', health, setHealth, HEALTH_OPTIONS.map(([v, t]) => [v, t]))}
              <Button type="button" aria-expanded={showMore} onClick={() => setMoreFilters((v) => !v)} className="gap-1.5 leading-[normal]">
                <Icon name="adjustments" size={16} />Bộ lọc khác{extraActive > 0 && ` (${extraActive})`}
              </Button>
            </div>
            {showMore && (
              <div className="flex flex-wrap items-center gap-2.5 pb-4">
                {filterSelect('Giống', breed, setBreed, breedOptions)}
                {filterSelect('Giới tính', sex, setSex, sexOptions)}
                {filterSelect('Giai đoạn', stageSel, setStageSel, stageOptions, 'Tất cả', 'ALL')}
                {filterSelect('Mục đích', purpose, setPurpose, purposeOptions)}
                {filterSelect('Dữ liệu cân', weightFilter, (value) => { setPage(0); setWeightFilter(value) }, [['yes', 'Có số cân'], ['no', 'Chưa có số cân']])}
                <Select className={SELECT_CLS} aria-label="Sắp xếp" value={sort} onChange={(e) => changeSort(e.target.value)}>
                  {SORT_OPTIONS.map(([value, label]) => <option key={value} value={value}>Sắp xếp: {label}</option>)}
                </Select>
              </div>
            )}
          </section>

          {listQuery.error ? (
            <div className="p-4"><ErrorBlock message="Không tải được danh sách đàn bò." onRetry={listQuery.refetch} /></div>
          ) : initialLoad ? (
            <p className="m-0 px-4 py-10 text-center text-xs text-muted">Đang tải dữ liệu…</p>
          ) : pageRows.length === 0 ? (
            // Trống nằm ngay trong khối, không lồng khung thứ hai.
            <div className="flex flex-col items-center gap-1 px-4 py-10 text-center">
              <p className="m-0 text-sm font-semibold text-ink">Không có bò nào khớp bộ lọc</p>
              <p className="m-0 text-xs text-muted">Thử đổi tab, bộ lọc hoặc từ khóa tìm kiếm.</p>
            </div>
          ) : (
            <>
              <Table wide bordered={false}>
                <thead>
                  <tr>
                    {sortableHeader('displayCode', 'Bò')}
                    {sortableHeader('penCode', 'Chuồng')}
                    {sortableHeader('purposeName', 'Mục đích · Giai đoạn')}
                    {sortableHeader('latestWeightKg', 'Cân gần nhất')}
                    <Th>Tình trạng</Th>
                    <Th>Sinh sản</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((c) => <CowRow key={c.code} c={c} barnTag={barnTagOf(c)} onOpen={(code: string) => nav(`/cattle/${code}`)} />)}
                </tbody>
              </Table>
              <div className="border-t border-rule px-4 py-3">
                <Pagination page={page + 1} pageCount={pageCount} onChange={(next) => setPage(next - 1)} summary={`Hiển thị ${first}–${first + pageRows.length - 1} / ${grandTotal} con`} />
              </div>
            </>
          )}
        </Panel>

        <Foot>Nhấn một dòng để mở hồ sơ bò. Các tab nhóm đàn cộng lại bằng tổng bò đang nuôi.</Foot>
      </div>
    </Layout>
  )
}
