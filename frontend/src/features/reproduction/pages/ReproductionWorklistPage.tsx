import { parseBusinessTime } from '../../../shared/lib/date/farmTime'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../../app/layouts/FarmPlatformLayout'
import {
  activateTableRow, activateTableRowByKey, Badge, EmptyBlock, ErrorBlock, FilterSelect, Foot, Icon, inputCls, interactiveRowClass,
  LoadingBlock, Metric, type MetricTone, PageHeader, Panel, Segmented, Table, Td, Th,
} from '../../../shared/ui'
import { reproductionError } from '../api/reproductionError'
import { useSession } from '../../../app/session/sessionContext'
import { NO_WEIGHING, dueLabel, eligibilityLabel, filterWorklist, formatDateTime, formatShort, tabCounts, type WorklistTab } from '../domain/reproductionRules'
import type { ReproductionRole, ReproductiveStatus, WorklistFilters } from '../types'
import { useReproductionUseCases } from '../hooks/useReproductionUseCases'

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

interface WorklistTile { label: string; value: number; note?: string; tone: MetricTone; alert?: boolean }

export default function ReproductionWorklistPage({ role }: { role?: ReproductionRole }) {
  const navigate = useNavigate()
  const session = useSession()
  const effective: ReproductionRole = role ?? (session?.role === 'OWNER' || session?.role === 'MANAGER' ? session.role : 'TECHNICIAN')
  const [filters, setFilters] = useState<WorklistFilters>({ status: 'IN_ESTRUS', eligibility: 'ALL', penCode: 'ALL', breed: 'ALL', query: '' })
  const { rows: data, worklistLoading: loading, worklistError: error, refetchWorklist: refetch, now } = useReproductionUseCases({ scope: 'worklist' })
  const rows = data ?? []
  const all = useMemo(() => rows ?? [], [rows])
  const tracked = useMemo(() => filterWorklist(all, {}, now()), [all, now])
  const counts = useMemo(() => tabCounts(all, now()), [all, now])
  const filtered = useMemo(() => filterWorklist(all, filters, now()), [all, filters, now])
  const setFilter = (patch: Partial<WorklistFilters>) => setFilters((current) => ({ ...current, ...patch }))
  const open = (code: string) => navigate(`/cattle/${encodeURIComponent(code)}?tab=repro`)

  const nowValue = parseBusinessTime(now())
  const notMet = (status: string | null) => ['AWAITING_BREEDING', 'IN_ESTRUS', 'POST_CALVING'].includes(status ?? '')
  const inWindow = tracked.filter((r) => r.breedingWindow && parseBusinessTime(r.breedingWindow.from) <= nowValue && parseBusinessTime(r.breedingWindow.to) >= nowValue).length
  const notEligible = tracked.filter((r) => notMet(r.status) && r.eligibility?.status === 'NOT_MET').length
  // Bento (docs/BeefCare-Bento-Grid.md §3): khối nổi bật là số bò đang động dục; màu vàng/xanh/đỏ chỉ bật khi có bò.
  const tiles: WorklistTile[] = [
    { label: 'Đang động dục', value: counts.IN_ESTRUS, tone: 'emphasis' },
    { label: 'Trong cửa sổ phối', value: inWindow, note: 'phối ngay hôm nay', tone: inWindow > 0 ? 'warn' : 'default' },
    { label: 'Đến hạn khám thai', value: tracked.filter((r) => r.status === 'BRED' && r.dueAt && parseBusinessTime(r.dueAt) <= nowValue).length, tone: 'default' },
    { label: 'Sắp đẻ ≤ 30 ngày', value: counts.DUE_SOON, tone: counts.DUE_SOON > 0 ? 'ok' : 'default' },
    { label: 'Sau đẻ – có thể phối', value: tracked.filter((r) => r.status === 'POST_CALVING' && r.dueAt && parseBusinessTime(r.dueAt) <= nowValue + DAY).length, tone: 'default' },
    { label: 'Chưa đủ điều kiện phối', value: notEligible, tone: 'default', alert: notEligible > 0 },
  ]

  const title = 'Sinh sản'
  if (loading && !rows) return <Layout title={title}><LoadingBlock /></Layout>
  if (error) return <Layout title={title}><ErrorBlock message={reproductionError(error, 'Không tải được danh sách sinh sản.')} onRetry={refetch} /></Layout>

  return (
    <Layout title={title} user={effective === 'OWNER' ? 'owner' : 'manager'}>
      <div className="flex flex-col gap-5 leading-[normal]">
        <PageHeader title={title} sub={`${tracked.length} bò cái đang theo dõi · nhấn 1 dòng để mở tab Sinh sản của bò`} />
        <section aria-label="Chỉ số sinh sản" className="@container">
          {/* 2 cột trên điện thoại, 3 cột khi vùng nội dung hẹp, một hàng từ 1.024 px; thẻ nổi bật rộng 1,5 lần như Figma Tab 18. */}
          <div className="grid grid-cols-2 gap-3 @min-[640px]:grid-cols-3 @min-[1024px]:grid-cols-[minmax(0,3fr)_repeat(5,minmax(0,2fr))]">
            {tiles.map((tile) => (
              <Metric
                key={tile.label}
                surface="panel"
                compact={tile.tone !== 'emphasis'}
                tone={tile.tone}
                label={tile.label}
                value={tile.alert ? <span className="text-err-fg">{tile.value}</span> : tile.value}
                sub={tile.note}
                warn={tile.tone === 'warn'}
              />
            ))}
          </div>
        </section>
        <div className="flex flex-wrap gap-2.5">
          <input aria-label="Tìm bò" className={`${inputCls} sm:w-[280px]`} placeholder="Tìm mã bò, số tai" value={filters.query ?? ''} onChange={(event) => setFilter({ query: event.target.value })} />
          <FilterSelect size="lg" className="w-full sm:w-[170px]" aria-label="Lọc chuồng" value={filters.penCode} onChange={(event) => setFilter({ penCode: event.target.value })}>
            <option value="ALL">Chuồng: Tất cả</option>
            {[...new Set(all.map((r) => r.penCode))].sort().map((pen) => <option key={pen} value={pen}>Chuồng: {pen}</option>)}
          </FilterSelect>
          <FilterSelect size="lg" className="w-full sm:w-[170px]" aria-label="Lọc giống" value={filters.breed} onChange={(event) => setFilter({ breed: event.target.value })}>
            <option value="ALL">Giống: Tất cả</option>
            {[...new Set(all.map((r) => r.breed))].sort().map((breed) => <option key={breed} value={breed}>Giống: {breed}</option>)}
          </FilterSelect>
          <FilterSelect size="lg" className="w-full sm:w-[210px]" aria-label="Lọc điều kiện phối" value={filters.eligibility} onChange={(event) => setFilter({ eligibility: event.target.value as WorklistFilters['eligibility'] })}>
            <option value="ALL">Điều kiện phối: Tất cả</option><option value="MET">Điều kiện phối: Đạt</option><option value="NOT_MET">Điều kiện phối: Chưa đạt</option>
          </FilterSelect>
        </div>
        <div className="overflow-x-auto">
          <Segmented value={filters.status ?? 'IN_ESTRUS'} onChange={(value) => setFilter({ status: value as WorklistFilters['status'] })}
            options={TABS.map((tab) => ({ value: tab.value, label: `${tab.label} (${counts[tab.value]})` }))} />
        </div>
        <Panel className="gap-0 overflow-hidden p-0!">
          {filtered.length === 0 ? <div className="p-4"><EmptyBlock title="Không có bò cái nào khớp bộ lọc" sub="Đổi tab hoặc xóa bộ lọc để xem thêm." /></div> : (
            <Table wide bordered={false}>
              <thead><tr><Th>Bò</Th><Th>Giống</Th><Th>Chuồng</Th><Th>Trạng thái sinh sản</Th><Th>Điều kiện phối</Th><Th>Sự kiện gần nhất</Th><Th>Việc cần làm</Th><Th>Thời hạn</Th><Th /></tr></thead>
              <tbody>
                {filtered.map((row) => {
                  const latest = row.events.find((event) => event.status === 'VALID')
                  const openRow = () => open(row.cattleCode)
                  return (
                    // Cả dòng mở hồ sơ: nhận focus bằng Tab, Enter/Space như nhấn chuột (§3 card bấm được có hover và focus).
                    <tr key={row.cattleCode} tabIndex={0} className={interactiveRowClass}
                      onClick={(event) => activateTableRow(event, openRow)} onKeyDown={(event) => activateTableRowByKey(event, openRow)}>
                      <Td><div className="font-medium text-ink"><span className="whitespace-nowrap">{row.cattleCode}</span>{row.name !== '—' ? ` · ${row.name}` : ''}</div><div className="text-[11px] text-muted">Số tai {row.earTag}</div></Td>
                      <Td>{row.breed}</Td>
                      <Td>{row.penCode}</Td>
                      <Td><div className="font-medium">{row.status ? STATUS_LABEL[row.status] : '—'}</div><div className="text-[11px] text-muted">từ {formatShort(row.statusAt)}</div></Td>
                      <Td>{row.eligibility && notMet(row.status) ? <Badge tone={row.eligibility.status === 'MET' ? 'ok' : eligibilityLabel(row.eligibility) === NO_WEIGHING ? 'warn' : 'err'} icon={row.eligibility.status === 'MET' ? 'circle-check' : undefined}>{row.eligibility.status === 'MET' ? 'Đạt' : eligibilityLabel(row.eligibility)}</Badge> : '—'}</Td>
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
          <p className="m-0 border-t border-rule px-4 py-3 text-xs text-muted">Điều kiện phối chỉ để tham khảo, không chặn việc ghi phối giống.</p>
        </Panel>
        <Foot>Danh sách theo dõi sinh sản cấp đàn (mọi vai trò xem được). Không ghi nhận trực tiếp ở đây: chọn 1 dòng để mở tab Sinh sản của bò. Vào hồ sơ bò cũng có thể bằng Quét QR hoặc từ Đàn bò.</Foot>
      </div>
    </Layout>
  )
}
