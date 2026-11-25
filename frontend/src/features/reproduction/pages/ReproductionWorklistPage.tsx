import { parseBusinessTime } from '../../../shared/lib/date/farmTime'
import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../../app/layouts/FarmPlatformLayout'
import {
  activateTableRow, activateTableRowByKey, Badge, ErrorBlock, Foot, Icon, interactiveRowClass,
  LoadingBlock, PageHeader, Panel, SearchInput, Select, Table, Tabs, Td, Th,
} from '../../../shared/ui'
import { cx } from '../../../shared/ui/cx'
import { reproductionError } from '../api/reproductionError'
import { useSession } from '../../../app/session/sessionContext'
import { NO_WEIGHING, dueLabel, eligibilityLabel, filterWorklist, formatDateTime, formatShort, tabCounts, type WorklistTab } from '../domain/reproductionRules'
import type { ReproductionFemale, ReproductionRole, ReproductiveStatus, WorklistFilters } from '../types'
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
/** Tab mở mặc định: tab đầu tiên có bò theo thứ tự việc gấp (D71), thay vì luôn mở "Động dục" kể cả khi trống. */
const TAB_PRIORITY: WorklistTab[] = ['IN_ESTRUS', 'BRED', 'DUE_SOON', 'POST_CALVING', 'AWAITING_BREEDING', 'PREGNANT']

export default function ReproductionWorklistPage({ role }: { role?: ReproductionRole }) {
  const navigate = useNavigate()
  const session = useSession()
  const effective: ReproductionRole = role ?? (session?.role === 'OWNER' || session?.role === 'MANAGER' ? session.role : 'TECHNICIAN')
  const [filters, setFilters] = useState<WorklistFilters>({ eligibility: 'ALL', penCode: 'ALL', breed: 'ALL', query: '' })
  const { rows: data, worklistLoading: loading, worklistError: error, refetchWorklist: refetch, now } = useReproductionUseCases({ scope: 'worklist' })
  const rows = data ?? []
  const all = useMemo(() => rows ?? [], [rows])
  const tracked = useMemo(() => filterWorklist(all, {}, now()), [all, now])
  const counts = useMemo(() => tabCounts(all, now()), [all, now])
  const tab = (filters.status as WorklistTab | undefined) ?? TAB_PRIORITY.find((t) => counts[t] > 0) ?? 'IN_ESTRUS'
  const filtered = useMemo(() => filterWorklist(all, { ...filters, status: tab }, now()), [all, filters, tab, now])
  const setFilter = (patch: Partial<WorklistFilters>) => setFilters((current) => ({ ...current, ...patch }))
  const open = (code: string) => navigate(`/cattle/${encodeURIComponent(code)}?tab=repro`)

  const nowValue = parseBusinessTime(now())
  const notMet = (status: string | null) => ['AWAITING_BREEDING', 'IN_ESTRUS', 'POST_CALVING'].includes(status ?? '')
  const checkDue = tracked.filter((r) => r.status === 'BRED' && r.dueAt && parseBusinessTime(r.dueAt) <= nowValue).length
  const notEligibleRows = tracked.filter((r) => notMet(r.status) && r.eligibility?.status === 'NOT_MET')
  const notEligible = notEligibleRows.length
  // "Xem" mở tab đầu tiên có bò chưa đủ điều kiện (Chờ phối, Động dục hoặc Sau sinh).
  const notEligibleTab = (['AWAITING_BREEDING', 'IN_ESTRUS', 'POST_CALVING'] as const).find((s) => notEligibleRows.some((r) => r.status === s)) ?? 'AWAITING_BREEDING'
  const overdue = tracked.filter((r) => r.indicators.overdueForConception).length
  const go = (patch: Partial<WorklistFilters>) => setFilters((current) => ({ ...current, ...patch }))

  const title = 'Sinh sản'
  if (loading && !rows) return <Layout title={title}><LoadingBlock /></Layout>
  if (error) return <Layout title={title}><ErrorBlock message={reproductionError(error, 'Không tải được danh sách sinh sản.')} onRetry={refetch} /></Layout>

  return (
    <Layout title={title} user={effective === 'OWNER' ? 'owner' : 'manager'}>
      <div className="flex flex-col gap-5 leading-[normal]">
        <PageHeader title={title} sub={`${tracked.length} bò cái đang theo dõi · nhấn một dòng để ghi trong tab Sinh sản của bò`} />
        <section aria-label="Chỉ số sinh sản" className="@container">
          {/* Bento một hàng 5 + 4 + 3 từ 1.024 px (như Sức khỏe); một cột trên điện thoại theo thứ tự đọc. */}
          <div className="grid gap-4 @min-[640px]:grid-cols-2 @min-[1024px]:grid-cols-12">
            <Panel tone="emphasis" className="justify-between gap-3 @min-[640px]:col-span-2 @min-[1024px]:col-span-5">
              <div className="flex flex-col gap-1">
                <p className="m-0 text-xs text-side-text">Việc cần làm</p>
                <p className="m-0 text-[40px] font-bold leading-none">{counts.IN_ESTRUS + checkDue + counts.DUE_SOON}</p>
              </div>
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[13px]">
                <TodoLine value={counts.IN_ESTRUS} text="bò động dục – cần phối" onView={() => go({ status: 'IN_ESTRUS' })} />
                <TodoLine value={checkDue} text="bò đến hạn khám thai" onView={() => go({ status: 'BRED' })} />
                <TodoLine value={counts.DUE_SOON} text="bò sắp đẻ trong 30 ngày" onView={() => go({ status: 'DUE_SOON' })} />
              </ul>
            </Panel>
            <Panel tone={notEligible + overdue > 0 ? 'err' : 'ok'} className="gap-3 @min-[1024px]:col-span-4">
              <p className="m-0 flex items-center gap-2 text-sm font-semibold text-ink">
                <Icon name={notEligible + overdue > 0 ? 'alert-triangle' : 'circle-check'} size={18} className={notEligible + overdue > 0 ? 'text-err-fg' : 'text-ok-fg'} />
                {notEligible + overdue > 0 ? 'Cần chú ý' : 'Không có bò cần chú ý'}
              </p>
              <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[13px]">
                <AlertLine value={notEligible} text="bò chưa đủ điều kiện phối" onView={() => go({ status: notEligibleTab, eligibility: 'NOT_MET' })} />
                <AlertLine value={overdue} text="bò quá hạn thụ thai sau đẻ" />
              </ul>
            </Panel>
            <Panel className="justify-between gap-1 @min-[1024px]:col-span-3">
              <p className="m-0 text-xs text-label">Đang mang thai</p>
              <p className="m-0 text-[32px] font-bold leading-none text-ink">{counts.PREGNANT}</p>
              <p className="m-0 text-[11px] text-label">{counts.AWAITING_BREEDING + counts.POST_CALVING} bò chờ phối / sau sinh</p>
            </Panel>
          </div>
        </section>
        <Panel className="gap-0 overflow-hidden p-0!">
          <div className="flex flex-col gap-3 border-b border-rule px-4 pt-3 @min-[1024px]:px-6">
            <Tabs value={tab} onChange={(value) => setFilter({ status: value as WorklistFilters['status'] })} tabs={TABS.map((t) => ({ value: t.value, label: `${t.label} (${counts[t.value]})` }))} />
            <div className="flex flex-wrap items-center gap-2.5 pb-4">
              <SearchInput className="w-full sm:w-[260px]" aria-label="Tìm bò" placeholder="Tìm mã bò, số tai" value={filters.query ?? ''} onChange={(event) => setFilter({ query: event.target.value })} />
              <Select className="w-full sm:w-[170px]" aria-label="Lọc chuồng" value={filters.penCode} onChange={(event) => setFilter({ penCode: event.target.value })}>
                <option value="ALL">Chuồng: Tất cả</option>
                {[...new Set(all.map((r) => r.penCode))].sort().map((pen) => <option key={pen} value={pen}>Chuồng: {pen}</option>)}
              </Select>
              <Select className="w-full sm:w-[170px]" aria-label="Lọc giống" value={filters.breed} onChange={(event) => setFilter({ breed: event.target.value })}>
                <option value="ALL">Giống: Tất cả</option>
                {[...new Set(all.map((r) => r.breed))].sort().map((breed) => <option key={breed} value={breed}>Giống: {breed}</option>)}
              </Select>
              <Select className="w-full sm:w-[210px]" aria-label="Lọc điều kiện phối" value={filters.eligibility} onChange={(event) => setFilter({ eligibility: event.target.value as WorklistFilters['eligibility'] })}>
                <option value="ALL">Điều kiện phối: Tất cả</option><option value="MET">Điều kiện phối: Đạt</option><option value="NOT_MET">Điều kiện phối: Chưa đạt</option>
              </Select>
            </div>
          </div>
          {filtered.length === 0 ? (
            // Trống nằm ngay trong khối danh sách, không lồng khung viền thứ hai.
            <div className="flex flex-col items-center gap-1 px-4 py-10 text-center">
              <p className="m-0 text-sm font-semibold text-ink">Không có bò cái nào khớp bộ lọc</p>
              <p className="m-0 text-xs text-muted">Đổi tab hoặc xóa bộ lọc để xem thêm.</p>
            </div>
          ) : (
            <Table wide bordered={false}>
              <thead><tr><Th>Bò</Th><Th>Trạng thái</Th><Th>Điều kiện phối</Th><Th>Sự kiện gần nhất</Th><Th>Việc cần làm</Th><Th>Thời hạn</Th><Th /></tr></thead>
              <tbody>
                {filtered.map((row) => {
                  const latest = row.events.find((event) => event.status === 'VALID')
                  const openRow = () => open(row.cattleCode)
                  return (
                    // Cả dòng mở hồ sơ: nhận focus bằng Tab, Enter/Space như nhấn chuột (§3 card bấm được có hover và focus).
                    <tr key={row.cattleCode} tabIndex={0} className={interactiveRowClass}
                      onClick={(event) => activateTableRow(event, openRow)} onKeyDown={(event) => activateTableRowByKey(event, openRow)}>
                      <Td className={cx('border-l-4', urgencyEdge(row, nowValue))}>
                        <div className="font-medium text-ink"><span className="whitespace-nowrap">{row.cattleCode}</span>{row.name !== '—' ? ` · ${row.name}` : ''}</div>
                        <div className="text-[11px] text-muted">{[`Số tai ${row.earTag}`, row.breed, `Chuồng ${row.penCode}`].join(' · ')}</div>
                      </Td>
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
        </Panel>
        <Foot>Điều kiện phối chỉ để tham khảo, không chặn việc ghi phối giống.</Foot>
      </div>
    </Layout>
  )
}

/** Vạch đầu dòng: vàng khi có việc tới hạn (đang động dục, đến hạn khám, sắp đẻ), còn lại không tô (D71). */
function urgencyEdge(row: ReproductionFemale, now: number): string {
  const due = row.dueAt != null && parseBusinessTime(row.dueAt) <= now
  return row.status === 'IN_ESTRUS' || (row.status === 'BRED' && due) || (row.status === 'PREGNANT' && due) ? 'border-l-[#d6a34d]' : 'border-l-transparent'
}

/** Dòng trong khối "Việc cần làm" (nền xanh đậm). */
function TodoLine({ value, text, onView }: { value: number; text: string; onView: () => void }) {
  return (
    <li className="flex items-center gap-2 border-t border-white/10 pt-1.5 first:border-t-0 first:pt-0">
      <strong className={cx('min-w-7 text-lg', value === 0 ? 'text-side-text/60' : 'text-white')}>{value}</strong>
      <span className={cx('flex-1', value === 0 ? 'text-side-text/70' : 'text-white')}>{text}</span>
      {value > 0 && <button type="button" onClick={onView} className="cursor-pointer text-xs font-semibold text-white underline-offset-2 hover:underline">Xem</button>}
    </li>
  )
}

/** Dòng trong khối cảnh báo; số 0 tô xám. */
function AlertLine({ value, text, onView }: { value: number; text: string; onView?: () => void }): ReactNode {
  return (
    <li className="flex items-center gap-2 border-t border-black/5 pt-2 first:border-t-0 first:pt-0">
      <strong className={cx('min-w-7 text-xl', value === 0 ? 'text-muted' : 'text-err-fg')}>{value}</strong>
      <span className={cx('flex-1', value === 0 ? 'text-muted' : 'text-ink')}>{text}</span>
      {value > 0 && onView && <button type="button" onClick={onView} className="cursor-pointer text-xs font-semibold text-brand hover:underline">Xem</button>}
    </li>
  )
}
