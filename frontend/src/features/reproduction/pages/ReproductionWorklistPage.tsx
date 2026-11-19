import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { Icon } from '../../../components/Icon'
import { Badge, Card, ErrorBlock, Foot, LoadingBlock, EmptyBlock, FilterSelect, PageHeader, Segmented, Table, Td, Th, Tile } from '../../../components/ui'
import { userFacingError } from '../../../api/userFacingError'
import { useQuery } from '../../../hooks/useApi'
import { useSession } from '../../authorization'
import { reproductionApi } from '../api/reproductionApi'
import { dueLabel, eligibilityLabel, filterWorklist, formatDateTime, formatShort, tabCounts, type WorklistTab } from '../domain/reproductionRules'
import type { ReproductionRole, ReproductiveStatus, WorklistFilters } from '../types'
import { reproductionNow } from '../domain/reproductionClock'

const TABS: Array<{ value: WorklistTab; label: string }> = [
  { value: 'AWAITING_BREEDING', label: 'Chờ phối' },
  { value: 'IN_ESTRUS', label: 'Động dục – cần phối' },
  { value: 'BRED', label: 'Đã phối – chờ khám' },
  { value: 'PREGNANT', label: 'Mang thai' },
  { value: 'DUE_SOON', label: 'Sắp đẻ' },
  { value: 'POST_CALVING', label: 'Sau sinh' },
]
const STATUS_LABEL: Record<ReproductiveStatus, string> = {
  AWAITING_BREEDING: 'Chờ phối', IN_ESTRUS: 'Động dục', BRED: 'Đã phối', PREGNANT: 'Mang thai', POST_CALVING: 'Sau sinh',
}
const DAY = 86_400_000

export default function ReproductionWorklistPage({ role }: { role?: ReproductionRole }) {
  const navigate = useNavigate()
  const session = useSession()
  const effective: ReproductionRole = role ?? (session?.role === 'OWNER' || session?.role === 'MANAGER' ? session.role : 'TECHNICIAN')
  const [filters, setFilters] = useState<WorklistFilters>({ status: 'IN_ESTRUS', eligibility: 'ALL', penCode: 'ALL', breed: 'ALL', query: '' })
  const { data: rows, loading, error, refetch } = useQuery(() => reproductionApi.listWorklist(), [])
  const all = useMemo(() => rows ?? [], [rows])
  const tracked = useMemo(() => filterWorklist(all, {}), [all])
  const counts = useMemo(() => tabCounts(all), [all])
  const filtered = useMemo(() => filterWorklist(all, filters), [all, filters])
  const setFilter = (patch: Partial<WorklistFilters>) => setFilters((current) => ({ ...current, ...patch }))
  const open = (code: string) => navigate(`/cattle/${encodeURIComponent(code)}?tab=repro`)

  const now = Date.parse(reproductionNow())
  const notMet = (status: string | null) => ['AWAITING_BREEDING', 'IN_ESTRUS', 'POST_CALVING'].includes(status ?? '')
  const tiles = [
    { label: 'Đang động dục', value: counts.IN_ESTRUS },
    { label: 'Trong cửa sổ phối', value: tracked.filter((r) => r.breedingWindow && Date.parse(r.breedingWindow.from) <= now && Date.parse(r.breedingWindow.to) >= now).length, note: 'phối ngay hôm nay', warn: true },
    { label: 'Đến hạn khám thai', value: tracked.filter((r) => r.status === 'BRED' && r.dueAt && Date.parse(r.dueAt) <= now).length },
    { label: 'Sắp đẻ ≤ 30 ngày', value: counts.DUE_SOON },
    { label: 'Sau đẻ – có thể phối', value: tracked.filter((r) => r.status === 'POST_CALVING' && r.dueAt && Date.parse(r.dueAt) <= now + DAY).length },
    { label: 'Chưa đủ điều kiện phối', value: tracked.filter((r) => notMet(r.status) && r.eligibility?.status === 'NOT_MET').length, warn: true },
  ]

  const title = 'Sinh sản'
  if (loading && !rows) return <Layout title={title}><LoadingBlock /></Layout>
  if (error) return <Layout title={title}><ErrorBlock message={userFacingError(error, 'Không tải được danh sách sinh sản.')} onRetry={refetch} /></Layout>

  return (
    <Layout title={title} user={effective === 'OWNER' ? 'owner' : 'manager'}>
      <div className="flex flex-col gap-4 leading-[normal]">
        <PageHeader title={title} sub={`${tracked.length} bò cái đang theo dõi · nhấn 1 dòng để mở tab Sinh sản của bò`} />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {tiles.map((tile) => <Tile key={tile.label} label={tile.label} value={tile.value} note={tile.note ?? ''} warn={tile.warn && tile.value > 0} />)}
        </div>
        <div className="flex flex-wrap gap-3">
          <input aria-label="Tìm bò" className="h-[38px] w-full rounded-xl border border-field bg-white px-3 text-sm sm:w-[280px]" placeholder="Tìm mã bò, số tai" value={filters.query ?? ''} onChange={(event) => setFilter({ query: event.target.value })} />
          <FilterSelect aria-label="Lọc chuồng" value={filters.penCode} onChange={(event) => setFilter({ penCode: event.target.value })}>
            <option value="ALL">Chuồng: Tất cả</option>
            {[...new Set(all.map((r) => r.penCode))].sort().map((pen) => <option key={pen} value={pen}>Chuồng: {pen}</option>)}
          </FilterSelect>
          <FilterSelect aria-label="Lọc giống" value={filters.breed} onChange={(event) => setFilter({ breed: event.target.value })}>
            <option value="ALL">Giống: Tất cả</option>
            {[...new Set(all.map((r) => r.breed))].sort().map((breed) => <option key={breed} value={breed}>Giống: {breed}</option>)}
          </FilterSelect>
          <FilterSelect aria-label="Lọc điều kiện phối" value={filters.eligibility} onChange={(event) => setFilter({ eligibility: event.target.value as WorklistFilters['eligibility'] })}>
            <option value="ALL">Điều kiện phối: Tất cả</option><option value="MET">Điều kiện phối: Đạt</option><option value="NOT_MET">Điều kiện phối: Chưa đạt</option>
          </FilterSelect>
        </div>
        <div className="overflow-x-auto">
          <Segmented value={filters.status ?? 'IN_ESTRUS'} onChange={(value) => setFilter({ status: value as WorklistFilters['status'] })}
            options={TABS.map((tab) => ({ value: tab.value, label: `${tab.label} (${counts[tab.value]})` }))} />
        </div>
        <Card>
          {filtered.length === 0 ? <EmptyBlock title="Không có bò cái nào khớp bộ lọc" sub="Đổi tab hoặc xóa bộ lọc để xem thêm." /> : (
            <Table wide>
              <thead><tr><Th>Bò</Th><Th>Giống</Th><Th>Chuồng</Th><Th>Trạng thái sinh sản</Th><Th>Điều kiện phối</Th><Th>Sự kiện gần nhất</Th><Th>Việc cần làm</Th><Th>Thời hạn</Th><Th /></tr></thead>
              <tbody>
                {filtered.map((row) => {
                  const latest = row.events.find((event) => event.status === 'VALID')
                  return (
                    <tr key={row.cattleCode} className="cursor-pointer hover:bg-page" onClick={() => open(row.cattleCode)}>
                      <Td><div className="font-medium text-ink"><span className="whitespace-nowrap">{row.cattleCode}</span>{row.name !== '—' ? ` · ${row.name}` : ''}</div><div className="text-[11px] text-muted">Số tai {row.earTag}</div></Td>
                      <Td>{row.breed}</Td>
                      <Td>{row.penCode}</Td>
                      <Td><div className="font-medium">{row.status ? STATUS_LABEL[row.status] : '—'}</div><div className="text-[11px] text-muted">từ {formatShort(row.statusAt)}</div></Td>
                      <Td>{row.eligibility && notMet(row.status) ? <Badge tone={row.eligibility.status === 'MET' ? 'ok' : 'err'} icon={row.eligibility.status === 'MET' ? 'circle-check' : undefined}>{row.eligibility.status === 'MET' ? 'Đạt' : eligibilityLabel(row.eligibility).replace('Chưa đạt · ', 'Chưa đạt · ')}</Badge> : '—'}</Td>
                      <Td>{latest ? `${latest.summary.split(' · ')[0]} · ${formatDateTime(latest.occurredAt)}` : 'Chưa ghi nhận'}</Td>
                      <Td>{row.nextAction}</Td>
                      <Td>{dueLabel(row) === '—' ? '—' : <Badge tone="warn">{dueLabel(row)}</Badge>}</Td>
                      <Td><Icon name="chevron-right" size={14} /></Td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
          )}
          <p className="m-0 mt-2 text-xs text-muted">Điều kiện phối chỉ để tham khảo, không chặn việc ghi phối giống.</p>
        </Card>
        <Foot>Danh sách theo dõi sinh sản cấp đàn (mọi vai trò xem được). Không ghi nhận trực tiếp ở đây: chọn 1 dòng để mở tab Sinh sản của bò. Vào hồ sơ bò cũng có thể bằng Quét QR hoặc từ Đàn bò.</Foot>
      </div>
    </Layout>
  )
}
