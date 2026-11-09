import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { Button, ErrorBlock, PageHeader, Pagination, Table, Foot, Select, inputCls } from '../../../components/ui'
import { Icon } from '../../../components/Icon'
import { BARNS0, BREEDS, EXPORTED_COUNT, STAGES, groupCount } from '../../../data/cowsData'
import { dm } from '../../../data/format'
import { backendMode } from '../../../api/backendTransport'
import { LIFE_STAGE_OPTIONS } from '../../../api/cattleBackendApi'
import { listBarns, listBreeds, listCows, listCowsPage, listPurposes } from '../api/cattleApi'
import { useQuery } from '../../../hooks/useApi'
import { useSession } from '../../authorization'
import { Chip, Panel, Th, Td, chipIcon } from '../components/parts'
import type { StatusChip } from '../../../types'
import type { CowSeed } from '../../../data/cowsData'

const backend = backendMode === 'backend'
const EXPORTED = 'Đã xuất'
const TAB_STAGE: Record<string, string> = { 'Tất cả': '', 'Khác': 'Chưa xác định' }
// Nhóm đàn theo hợp đồng backend (GBR-24) và khóa đếm tương ứng trong `counts`.
const TAB_GROUP: Record<string, string> = { 'Bò cái sinh sản': 'BREEDING_FEMALES', 'Bò tơ': 'YOUNG_STOCK', 'Vỗ béo': 'FATTENING', 'Bê': 'CALVES', 'Đực giống': 'BREEDING_BULLS', 'Khác': 'OTHER' }
const STATUS_OPTIONS = [['ACTIVE', 'Đang nuôi'], ['EXIT_PENDING', 'Chờ xuất'], ['EXITED', 'Đã xuất'], ['VOIDED', 'Đã hủy'], ['ALL', 'Tất cả']] as const
const HEALTH_OPTIONS = [['HEALTHY', 'Khỏe'], ['MONITORING', 'Theo dõi'], ['UNDER_TREATMENT', 'Đang điều trị'], ['MEAT_WITHDRAWAL', 'Ngưng sử dụng thịt']] as const
const LOCAL_HEALTH: Record<string, string> = { HEALTHY: 'Khỏe', MONITORING: 'Theo dõi', UNDER_TREATMENT: 'Đang điều trị' }
const SELECT_CLS = 'w-[calc(50%-5px)] sm:w-[170px] [&_select]:!leading-[normal]'

const chip = (h?: StatusChip | null) => (h ? <Chip tone={h.tone} icon={chipIcon(h.label)}>{h.label}</Chip> : '—')
const withdrawalLabel = (until?: string) => (until ? `Cách ly thịt đến ${/^\d{4}-/.test(until) ? dm(until) : until}` : '')

function statusCell(c: CowSeed) {
  if (c.status === 'EXITED') return { text: 'Đã xuất', detail: c.exitStatusLabel?.replace('Đã xuất · ', ''), tone: '' }
  if (c.status === 'VOIDED') return { text: 'Đã hủy', detail: undefined, tone: '' }
  if (c.status === 'EXIT_PENDING' || c.exitPending) return { text: 'Chờ xuất', detail: undefined, tone: 'text-[#b26b00]' }
  return { text: '—', detail: undefined, tone: '' }
}

// Dòng bảng danh sách theo Figma (cột: Bò · Giống · Giới tính · Tuổi · Chuồng · Mục đích · Cân · Trạng thái · Sức khỏe · Sinh sản).
function CowRow({ c, barnTag, onOpen }: { c: CowSeed; barnTag: string; onOpen: (code: string) => void }) {
  const weight = c.weight != null ? `${c.weight} kg${c.weightEst ? '*' : ''} · ${c.weightDate}` : '—'
  const status = statusCell(c)
  const withdrawal = withdrawalLabel(c.withdrawalUntil)
  return (
    <tr
      tabIndex={0}
      onClick={() => onOpen(c.code)}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(c.code)}
      className="cursor-pointer hover:bg-page focus:bg-page focus:outline-none"
    >
      <Td className="font-medium"><span>{c.code}</span>{c.name && <span> “{c.name}”</span>}</Td>
      <Td>{c.breed || '—'}</Td>
      <Td>{c.sex} · {c.ageShort}</Td>
      <Td>{c.barn ? `${c.barn}${barnTag ? ` · ${barnTag}` : ''}` : '—'}</Td>
      <Td>{c.purpose} · {c.stage}</Td>
      <Td>{weight}</Td>
      <Td className={status.tone}>{status.text}{status.detail && !status.detail.includes('· —') && <div className="text-[11px] text-muted">{status.detail}</div>}</Td>
      <Td>
        <div className="flex flex-col items-start gap-1">
          {chip(c.health)}
          {withdrawal && <span className="text-[11px] font-medium text-[#995e00]">{withdrawal}</span>}
        </div>
      </Td>
      <Td>{chip(c.repro)}</Td>
    </tr>
  )
}

export default function CowList() {
  const nav = useNavigate()
  const session = useSession()
  const [params] = useSearchParams()
  const searchRef = useRef<HTMLInputElement>(null)
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
  const [tab, setTab] = useState('Tất cả')
  const [page, setPage] = useState(0)

  // Ô tìm kiếm trên thanh trên đổi ?q= ngay trên trang này.
  const urlQ = params.get('q') ?? ''
  useEffect(() => { setQ(urlQ) }, [urlQ])
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q), backend ? 300 : 0)
    return () => clearTimeout(timer)
  }, [q])
  useEffect(() => { setPage(0) }, [debouncedQ, breed, sex, barn, stageSel, purpose, health, status, tab])

  const group = status === 'ACTIVE' ? TAB_GROUP[tab] : undefined
  const listQuery = useQuery(
    () => backend
      ? listCowsPage({ q: debouncedQ, breedId: breed, sex, penId: barn, purposeId: purpose, lifeStage: stageSel === 'ALL' ? '' : stageSel, health, herdStatus: status, herdGroup: group, page })
      : listCows().then((items) => ({ items, total: items.length, page: 0, size: items.length, counts: {} as Record<string, number> })),
    [debouncedQ, breed, sex, barn, purpose, stageSel, health, status, group, page],
  )
  const barnsQuery = useQuery(listBarns, [])
  const breedsQuery = useQuery(() => listBreeds().catch(() => []), [])
  const purposesQuery = useQuery(() => listPurposes().catch(() => []), [])
  const cows = useMemo(() => listQuery.data?.items ?? [], [listQuery.data])
  const counts = listQuery.data?.counts ?? {}
  const barnRows = barnsQuery.data ?? []
  const barnsByCode = Object.fromEntries(barnRows.map((b) => [b.code, b]))

  const localTotal = STAGES.reduce((sum, s) => sum + groupCount(cows, s), 0)
  const total = backend ? counts.ACTIVE ?? 0 : localTotal
  const exportedTotal = backend ? counts.EXITED ?? 0 : EXPORTED_COUNT
  const countOf = (label: string, stage: Parameters<typeof groupCount>[1]) => (backend ? counts[TAB_GROUP[label]] ?? 0 : groupCount(cows, stage))
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
  }
  const onStatus = (value: string) => {
    setStatus(value)
    if (tab === EXPORTED && value !== 'EXITED') setTab('Tất cả')
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
        (!kw || [c.code, c.tag, c.name].some((v) => v && v.toLowerCase().includes(kw))),
    )
  }, [cows, debouncedQ, breed, sex, barn, purpose, health, status, stageSel, tab])

  const barnTagOf = (c: CowSeed) => c.barnTag || barnsByCode[c.barn]?.tag || ''
  const size = listQuery.data?.size || rows.length || 1
  const grandTotal = backend ? listQuery.data?.total ?? 0 : rows.length
  const pageCount = Math.max(1, Math.ceil(grandTotal / size))
  const firstRow = rows.length ? page * size + 1 : 0
  const canEnter = session?.role !== 'TECHNICIAN'
  const initialLoad = listQuery.loading && !listQuery.data

  const sexOptions = backend ? [['FEMALE', 'Cái'], ['MALE', 'Đực']] : [['Cái', 'Cái'], ['Đực', 'Đực']]
  const breedOptions = backend ? (breedsQuery.data ?? []).map((b) => [String(b.id), b.name]) : BREEDS.map((b) => [b, b])
  const barnOptions = backend ? barnRows.filter((b) => typeof b.backendId === 'number').map((b) => [String(b.backendId), b.code]) : Object.keys(BARNS0).map((b) => [b, b])
  const purposeOptions = backend ? (purposesQuery.data ?? []).filter((p) => p.available).map((p) => [String(p.id), p.name]) : [...new Set(cows.map((c) => c.purpose))].map((p) => [p, p])
  const stageOptions = backend ? LIFE_STAGE_OPTIONS.map((o) => [o.value, o.label]) : STAGES.map((s) => [s, s])

  const filterSelect = (label: string, value: string, onChange: (value: string) => void, options: ReadonlyArray<ReadonlyArray<string>>, all = 'Tất cả', allValue = '') => (
    <Select className={SELECT_CLS} aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value={allValue}>{label}: {all}</option>
      {options.map(([v, text]) => <option key={v} value={v}>{label}: {text}</option>)}
    </Select>
  )

  return (
    <Layout title="Đàn bò – Danh sách" user="manager">
      <div className="flex flex-col gap-5 leading-[normal]">
        <PageHeader title="Đàn bò" sub={`${initialLoad ? '…' : total} con đang nuôi · ${exportedTotal} con đã xuất đàn`}>
          <Button className="gap-1.5 leading-[normal]" onClick={() => nav('/quet-qr')}><Icon name="qrcode" />Quét QR</Button>
          {canEnter && <Button variant="primary" className="gap-1.5 leading-[normal]" onClick={() => nav('/herd-entry/new', { state: { from: '/cattle' } })}><Icon name="circle-plus" />Nhập đàn</Button>}
        </PageHeader>

        <div className="flex flex-wrap gap-2.5">
          <input
            ref={searchRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Mã hiển thị, số tai, tên gọi…"
            aria-label="Tìm bò"
            className={`${inputCls} w-full !leading-[normal] sm:w-[300px]`}
          />
          {filterSelect('Giống', breed, setBreed, breedOptions)}
          {filterSelect('Giới tính', sex, setSex, sexOptions)}
          {filterSelect('Chuồng', barn, setBarn, barnOptions)}
          {filterSelect('Giai đoạn', stageSel, setStageSel, stageOptions, 'Tất cả', 'ALL')}
          {filterSelect('Mục đích', purpose, setPurpose, purposeOptions)}
          {filterSelect('Sức khỏe', health, setHealth, HEALTH_OPTIONS.map(([v, t]) => [v, t]))}
          <Select className="w-[calc(50%-5px)] sm:w-[230px] [&_select]:!leading-[normal]" aria-label="Trạng thái đàn" value={status} onChange={(e) => onStatus(e.target.value)}>
            {STATUS_OPTIONS.map(([v, text]) => <option key={v} value={v}>Trạng thái đàn: {text}</option>)}
          </Select>
        </div>

        <div className="flex max-w-full flex-wrap gap-[3px] self-start rounded-[5px] bg-chip p-[3px]">
          {tabs.map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => onTab(v)}
              className={`cursor-pointer rounded border px-3.5 py-[7px] text-xs leading-[normal] ${
                v === tab ? 'border-faint bg-white font-semibold text-[#212121]' : 'border-transparent text-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {listQuery.error ? (
          <ErrorBlock message="Không tải được danh sách đàn bò." onRetry={listQuery.refetch} />
        ) : (
          <Panel pad="p-2" gap="gap-0">
            <Table wide>
              <thead>
                <tr className="bg-chip">
                  <Th className="w-[150px]">Bò</Th>
                  <Th className="w-[90px]">Giống</Th>
                  <Th className="w-[110px]">Giới tính · Tuổi</Th>
                  <Th className="w-[100px]">Chuồng</Th>
                  <Th className="w-[140px]">Mục đích · Giai đoạn</Th>
                  <Th className="w-[110px]">Cân gần nhất</Th>
                  <Th className="w-[92px]">Trạng thái</Th>
                  <Th className="w-[100px]">Sức khỏe</Th>
                  <Th className="w-[100px]">Sinh sản</Th>
                </tr>
              </thead>
              <tbody>
                {initialLoad && (
                  <tr>
                    <Td colSpan={9} className="!py-6 text-center !text-[12px] text-muted">Đang tải dữ liệu…</Td>
                  </tr>
                )}
                {!initialLoad && rows.map((c) => (
                  <CowRow key={c.code} c={c} barnTag={barnTagOf(c)} onOpen={(code: string) => nav(`/cattle/${code}`)} />
                ))}
                {!initialLoad && rows.length === 0 && (
                  <tr>
                    <Td colSpan={9} className="!py-6 text-center !text-[12px] text-muted">
                      Không có bò nào khớp bộ lọc
                    </Td>
                  </tr>
                )}
              </tbody>
            </Table>
            <div className="px-3 py-3">
              <Pagination
                page={page + 1}
                pageCount={pageCount}
                onChange={(next) => setPage(next - 1)}
                summary={`Hiển thị ${rows.length ? `${firstRow}–${firstRow + rows.length - 1}` : 0} trong ${grandTotal} · * cân ước tính`}
              />
            </div>
          </Panel>
        )}

        <Foot>
          Bấm một dòng để mở hồ sơ bò. Các tab nhóm đàn cộng lại bằng tổng bò đang nuôi; tab Khác luôn hiện kể cả khi bằng 0.
        </Foot>
      </div>
    </Layout>
  )
}
