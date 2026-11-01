import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { Badge, Button, Card, Note, PageHeader, Select, Segmented, Table, Td, Th, Tile } from '../../../components/ui'
import { backendMode } from '../../../api/backendTransport'
import { reproductionApi } from '../api/reproductionApi'
import { filterWorklist, statusCounts } from '../domain/reproductionRules'
import type { ReproductiveStatus, ReproductionFemale, ReproductionRole, WorklistFilters } from '../types'

const STATUS: Record<ReproductiveStatus, { label: string; tone: 'ok' | 'err' | 'warn' | 'info' | 'outline' }> = {
  AWAITING_BREEDING: { label: 'Chờ phối', tone: 'outline' },
  IN_ESTRUS: { label: 'Động dục · cần phối', tone: 'warn' },
  BRED: { label: 'Đã phối · chờ khám', tone: 'info' },
  PREGNANT: { label: 'Mang thai', tone: 'ok' },
  POST_CALVING: { label: 'Sau sinh', tone: 'outline' },
}
const TABS: Array<{ value: string; label: string }> = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'AWAITING_BREEDING', label: 'Chờ phối' },
  { value: 'IN_ESTRUS', label: 'Động dục · cần phối' },
  { value: 'BRED', label: 'Đã phối · chờ khám' },
  { value: 'PREGNANT', label: 'Mang thai' },
  { value: 'POST_CALVING', label: 'Sau sinh' },
]

const dateText = (value: string | null) => value
  ? new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  : '—'
const daysText = (value: string | null) => {
  if (!value) return '—'
  const days = Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000)
  if (days < 0) return `Quá hạn ${Math.abs(days)} ngày`
  if (days === 0) return 'Hôm nay'
  return `Còn ${days} ngày`
}

export default function ReproductionWorklistPage({ role = 'TECHNICIAN' }: { role?: ReproductionRole }) {
  const navigate = useNavigate()
  const [rows, setRows] = useState<ReproductionFemale[]>([])
  const [filters, setFilters] = useState<WorklistFilters>({ status: 'ALL', eligibility: 'ALL' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let current = true
    void reproductionApi.listWorklist().then((result) => {
      if (current) { setRows(result); setError('') }
    }).catch((cause: unknown) => {
      if (current) setError(cause instanceof Error ? cause.message : 'Không tải được danh sách sinh sản.')
    }).finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [])

  const counts = useMemo(() => statusCounts(rows), [rows])
  const filtered = useMemo(() => filterWorklist(rows, filters), [rows, filters])
  const tracked = rows.filter((row) => row.applicable && row.herdStatus === 'ACTIVE')
  const now = Date.now()
  const in30Days = now + 30 * 86_400_000
  const tiles = [
    { label: 'Động dục', value: counts.IN_ESTRUS, note: 'Cần theo dõi cửa sổ phối', warn: counts.IN_ESTRUS > 0 },
    { label: 'Trong cửa sổ phối', value: tracked.filter((row) => row.breedingWindow && new Date(row.breedingWindow.to).getTime() >= now && new Date(row.breedingWindow.from).getTime() <= now).length, note: 'Theo REM-02' },
    { label: 'Đến hạn khám thai', value: tracked.filter((row) => row.status === 'BRED' && row.dueAt && new Date(row.dueAt).getTime() <= now).length, note: 'Theo REM-03 / REM-04' },
    { label: 'Dự kiến đẻ trong 30 ngày', value: tracked.filter((row) => row.status === 'PREGNANT' && row.openPregnancy?.expectedCalvingAt && new Date(row.openPregnancy.expectedCalvingAt).getTime() <= in30Days).length, note: 'Theo ngày dự kiến' },
    { label: 'Sau sinh · có thể phối', value: tracked.filter((row) => row.status === 'POST_CALVING' && row.dueAt && new Date(row.dueAt).getTime() <= now).length, note: 'Theo REM-07' },
    { label: 'Chưa đạt điều kiện phối', value: tracked.filter((row) => ['AWAITING_BREEDING', 'IN_ESTRUS', 'POST_CALVING'].includes(row.status ?? '') && row.eligibility?.status === 'NOT_MET').length, note: 'Chỉ là khuyến nghị' },
  ]

  const activeTab = filters.status ?? 'ALL'
  const setFilter = (patch: Partial<WorklistFilters>) => setFilters((current) => ({ ...current, ...patch }))

  return (
    <Layout title="Sinh sản" user={role === 'OWNER' ? 'owner' : 'manager'}>
      <div className="flex flex-col gap-5 leading-[normal]">
        <PageHeader
          title="Sinh sản"
          sub="Theo dõi động dục, phối giống, thai kỳ và ngày đẻ dự kiến của bò cái."
          badge={backendMode === 'local' ? <Badge tone="info">Dữ liệu minh họa</Badge> : <Badge tone="warn">Chưa nối backend</Badge>}
        />
        {role === 'TECHNICIAN' && <Note tone="info">Kỹ thuật viên xem danh sách và hồ sơ sinh sản; không ghi, sửa hoặc hủy sự kiện.</Note>}
        {error && <Note tone={backendMode === 'backend' ? 'warn' : 'err'}>{error}</Note>}
        {backendMode === 'backend' && <Note tone="warn">Dữ liệu sinh sản chưa được tích hợp API. Màn hình không thay bằng dữ liệu minh họa khi đang kết nối backend.</Note>}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {tiles.map((tile) => <Tile key={tile.label} {...tile} />)}
        </div>

        <Card>
          <div className="overflow-x-auto pb-1">
            <Segmented
              value={activeTab}
              onChange={(value) => setFilter({ status: value as ReproductiveStatus | 'ALL' })}
              options={TABS.map((tab) => ({
                value: tab.value,
                label: `${tab.label}${tab.value === 'ALL' ? ` (${tracked.length})` : ` (${counts[tab.value as ReproductiveStatus]})`}`,
              }))}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="flex flex-col gap-1.5 text-xs font-medium text-ink">
              Tìm bò
              <input aria-label="Tìm bò" className="h-10 rounded-xl border border-field px-3 text-sm font-normal" placeholder="Mã bò, số tai, tên gọi…" value={filters.query ?? ''} onChange={(event) => setFilter({ query: event.target.value })} />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-medium text-ink">
              Chuồng
              <Select aria-label="Lọc chuồng" value={filters.penCode ?? 'ALL'} onChange={(event) => setFilter({ penCode: event.target.value })}>
                <option value="ALL">Tất cả chuồng</option>
                {[...new Set(rows.map((row) => row.penCode))].sort().map((pen) => <option key={pen} value={pen}>{pen}</option>)}
              </Select>
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-medium text-ink">
              Giống
              <Select aria-label="Lọc giống" value={filters.breed ?? 'ALL'} onChange={(event) => setFilter({ breed: event.target.value })}>
                <option value="ALL">Tất cả giống</option>
                {[...new Set(rows.map((row) => row.breed))].sort().map((breed) => <option key={breed} value={breed}>{breed}</option>)}
              </Select>
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-medium text-ink">
              Điều kiện phối
              <Select aria-label="Lọc điều kiện phối" value={filters.eligibility ?? 'ALL'} onChange={(event) => setFilter({ eligibility: event.target.value as WorklistFilters['eligibility'] })}>
                <option value="ALL">Tất cả</option><option value="MET">Đạt</option><option value="NOT_MET">Chưa đạt</option>
              </Select>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
            <span>Điều kiện phối là khuyến nghị; không chặn việc ghi một sự kiện đã xảy ra.</span>
            <span className="flex-1" />
            <Button size="sm" onClick={() => setFilters({ status: 'ALL', eligibility: 'ALL', penCode: 'ALL', breed: 'ALL', query: '' })}>Xóa lọc</Button>
          </div>
          {loading ? <div className="py-10 text-center text-sm text-muted">Đang tải danh sách…</div> : (
            <Table wide>
              <thead><tr><Th>Bò cái</Th><Th>Giống · Chuồng</Th><Th>Trạng thái sinh sản</Th><Th>Điều kiện phối</Th><Th>Sự kiện gần nhất</Th><Th>Việc tiếp theo</Th><Th /></tr></thead>
              <tbody>
                {filtered.map((row) => {
                  const latest = row.events.find((event) => event.status === 'VALID')
                  const status = row.status ? STATUS[row.status] : null
                  return (
                    <tr key={row.cattleCode} className="cursor-pointer hover:bg-page" onClick={() => navigate(`/cattle/${encodeURIComponent(row.cattleCode)}?tab=repro`)}>
                      <Td><div className="font-semibold text-ink">{row.cattleCode}{row.name !== '—' && row.name ? ` · ${row.name}` : ''}</div><div className="mt-1 text-[11px] text-muted">{row.earTag || 'Chưa có số tai'}</div></Td>
                      <Td>{row.breed}<div className="mt-1 text-[11px] text-muted">{row.penCode}</div></Td>
                      <Td>{status ? <Badge tone={status.tone}>{status.label}</Badge> : <Badge>Không theo dõi</Badge>}<div className="mt-1 text-[11px] text-muted">{dateText(row.statusAt)}</div></Td>
                      <Td>{row.eligibility ? <><Badge tone={row.eligibility.status === 'MET' ? 'ok' : 'warn'}>{row.eligibility.status === 'MET' ? 'Đạt' : 'Chưa đạt'}</Badge><div className="mt-1 max-w-[180px] text-[11px] text-muted">{row.eligibility.failedConditions.join(' · ') || 'Đủ tuổi, cân nặng; không có ca sức khỏe mở'}</div></> : '—'}</Td>
                      <Td>{latest ? <><span>{latest.summary}</span><div className="mt-1 text-[11px] text-muted">{dateText(latest.occurredAt)}</div></> : 'Chưa ghi nhận'}</Td>
                      <Td>{row.nextAction}<div className="mt-1 text-[11px] text-muted">{row.dueAt ? `${dateText(row.dueAt)} · ${daysText(row.dueAt)}` : '—'}</div></Td>
                      <Td><Button size="sm" onClick={(event) => { event.stopPropagation(); navigate(`/cattle/${encodeURIComponent(row.cattleCode)}?tab=repro`) }}>Mở hồ sơ</Button></Td>
                    </tr>
                  )
                })}
                {!filtered.length && <tr><Td colSpan={7} className="py-10 text-center text-muted">{error ? 'Chưa có dữ liệu để hiển thị.' : 'Không có bò cái nào khớp bộ lọc.'}</Td></tr>}
              </tbody>
            </Table>
          )}
          <p className="m-0 text-[11px] text-muted">Hiển thị {filtered.length} trong {tracked.length} bò cái đang được theo dõi. Trạng thái được minh họa từ các sự kiện hợp lệ.</p>
        </Card>
      </div>
    </Layout>
  )
}

