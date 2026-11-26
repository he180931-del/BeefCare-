import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { userFacingError } from '../../../shared/api/userFacingError'
import Layout from '../../../app/layouts/FarmPlatformLayout'
import {
  activateTableRow, activateTableRowByKey, Badge, DateInput, EmptyBlock, ErrorBlock, Icon, interactiveRowClass, LoadingBlock,
  PageHeader, Pagination, Panel, SearchInput, Select, Table, Tabs, Td, Th,
} from '../../../shared/ui'
import { cx } from '../../../shared/ui/cx'
import { useDemoState } from '../../../demo/demoModules'
import { addDays, caseLabel, dateOf, fmtDate, SEVERITIES, SEVERITY_LABEL } from '../domain/healthFormat'
import { useHealthCases } from '../hooks/useHealthCases'
import { useHealthCaseCommands } from '../hooks/useHealthCaseCommands'
import type { CaseTab, HealthCaseCounts, HealthCaseFilters, HealthCaseRow, Severity } from '../types'
import { CaseStatusBadge, SeverityBadge } from '../components/healthUi'

const TITLE = 'Sức khỏe & Điều trị'
const PAGE_SIZE = 10
const TABS: Array<{ value: CaseTab; label: string; count: (c: HealthCaseCounts) => number }> = [
  { value: 'open', label: 'Đang mở', count: (c) => c.open },
  { value: 'chronic', label: 'Theo dõi dài hạn', count: (c) => c.chronic },
  { value: 'closed', label: 'Đã đóng', count: (c) => c.closed },
  { value: 'all', label: 'Tất cả', count: (c) => c.all },
]

/** Một màu cho mỗi mức độ, dùng chung cho thanh tỷ lệ và vạch đầu dòng của bảng (luôn kèm nhãn chữ). */
const SEVERITY_COLOR: Record<Severity, { bar: string; edge: string }> = {
  SEVERE: { bar: 'bg-[#e08a7a]', edge: 'border-l-[#cc6b5c]' },
  MODERATE: { bar: 'bg-[#e3b65c]', edge: 'border-l-[#d6a34d]' },
  MILD: { bar: 'bg-[#9fd3b2]', edge: 'border-l-[#9fd3b2]' },
}

/**
 * Màn danh sách ca sức khỏe của đàn (SCR-36, D66) theo Bento: một khối nổi bật trả lời "đàn đang có bao nhiêu ca, nặng
 * nhẹ thế nào", một khối cảnh báo chỉ đổi màu khi có ca nặng / nghi truyền nhiễm, hai khối phụ; bộ lọc, tab và bảng gom
 * trong một khối. Chỉ xem và lọc; mở ca, ghi điều trị và cập nhật ca làm trong tab Sức khỏe của hồ sơ bò.
 */
export default function HealthCaseList() {
  const demo = useDemoState()
  const navigate = useNavigate()
  const { now } = useHealthCaseCommands()
  const [filters, setFilters] = useState<HealthCaseFilters>(() => {
    const to = dateOf(now())
    return { tab: 'open', search: '', severity: '', penCode: '', from: addDays(to, -30), to, sort: 'openedAt', dir: 'desc' }
  })
  const [page, setPage] = useState(1)
  const { data, loading, error, refetch } = useHealthCases(filters, demo)
  const update = (patch: Partial<HealthCaseFilters>) => { setFilters((f) => ({ ...f, ...patch })); setPage(1) }
  const toggleSort = (key: 'openedAt' | 'caseCode') => update({ sort: key, dir: filters.sort === key && filters.dir === 'desc' ? 'asc' : 'desc' })

  if (loading && !data) return <Layout title={TITLE}><LoadingBlock /></Layout>
  if (error || !data) return <Layout title={TITLE}><ErrorBlock message={userFacingError(error, 'Không tải được danh sách ca sức khỏe.')} onRetry={refetch} /></Layout>

  const { rows, counts, pens } = data
  const tab = filters.tab ?? 'open'
  const withPeriod = tab === 'closed' || tab === 'all'
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const visible = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const arrow = (key: 'openedAt' | 'caseCode') => (filters.sort === key ? (filters.dir === 'asc' ? ' ↑' : ' ↓') : '')

  return (
    <Layout title={TITLE}>
      <div className="flex flex-col gap-5 leading-[normal]">
        <PageHeader title={TITLE} sub="Theo dõi ca bệnh của đàn · nhấn một dòng để ghi điều trị hoặc cập nhật ca trong hồ sơ bò" />
        <section aria-label="Chỉ số sức khỏe" className="@container">
          {/* Bento một hàng 5 + 4 + 3 từ 1.024 px; 2 cột khi hẹp; một cột trên điện thoại theo thứ tự đọc. */}
          <div className="grid gap-4 @min-[640px]:grid-cols-2 @min-[1024px]:grid-cols-12">
            <ActiveCasesBlock counts={counts} className="@min-[640px]:col-span-2 @min-[1024px]:col-span-5" />
            <AttentionBlock counts={counts} onSevere={() => update({ tab: 'open', severity: 'SEVERE' })} className="@min-[1024px]:col-span-4" />
            <SmallBlock label="Theo dõi dài hạn" value={counts.chronic} sub="Theo dõi định kỳ, chưa đóng" className="@min-[1024px]:col-span-3" />
          </div>
        </section>

        <Panel className="gap-0 overflow-hidden p-0!">
          <div className="flex flex-col gap-3 border-b border-rule px-4 pt-3 @min-[1024px]:px-6">
            <Tabs value={tab} onChange={(value) => update({ tab: value as CaseTab })} tabs={TABS.map((t) => ({ value: t.value, label: `${t.label} (${t.count(counts)})` }))} />
            <div className="flex flex-wrap items-center gap-2.5 pb-4">
              <SearchInput className="w-full sm:w-[260px]" placeholder="Tìm mã bò, mã ca" aria-label="Tìm mã bò, mã ca" value={filters.search} onChange={(e) => update({ search: e.target.value })} />
              <Select className="w-full sm:w-[190px]" aria-label="Mức độ" value={filters.severity} onChange={(e) => update({ severity: e.target.value as Severity | '' })}>
                <option value="">Mức độ: Tất cả</option>
                {SEVERITIES.map((s) => <option key={s} value={s}>Mức độ: {SEVERITY_LABEL[s]}</option>)}
              </Select>
              <Select className="w-full sm:w-[220px]" aria-label="Chuồng" value={filters.penCode} onChange={(e) => update({ penCode: e.target.value })}>
                <option value="">Chuồng: Tất cả</option>
                {pens.map((p) => <option key={p.code} value={p.code}>Chuồng: {p.code} – {p.name}</option>)}
              </Select>
              {/* Kỳ chỉ áp cho ca đã đóng nên chỉ hiện ở tab Đã đóng / Tất cả (D66). */}
              {withPeriod && (
                <div className="flex items-center gap-2 text-xs text-muted">
                  <span>Ca đóng mở từ</span>
                  <DateInput id="hc-from" label="Từ ngày" value={filters.from ?? ''} onChange={(from) => update({ from })} />
                  <span>–</span>
                  <DateInput id="hc-to" label="Đến ngày" value={filters.to ?? ''} onChange={(to) => update({ to })} />
                </div>
              )}
            </div>
          </div>
          {rows.length === 0 ? <div className="p-4"><EmptyBlock title="Không có ca sức khỏe phù hợp" sub="Đổi tab hoặc bộ lọc; mở ca mới từ hồ sơ bò." /></div> : (
            <Table wide bordered={false}>
              <thead>
                <tr>
                  <Th><button type="button" className="font-semibold" onClick={() => toggleSort('caseCode')}>Mã ca{arrow('caseCode')}</button></Th>
                  <Th>Bò</Th><Th>Chẩn đoán / dấu hiệu</Th><Th>Mức độ</Th>
                  <Th><button type="button" className="font-semibold" onClick={() => toggleSort('openedAt')}>Ngày mở{arrow('openedAt')}</button></Th>
                  <Th>Trạng thái</Th><Th />
                </tr>
              </thead>
              <tbody>{visible.map((r) => <CaseRow key={r.id} row={r} onOpen={() => navigate(`/cattle/${r.cattleCode}?tab=health`)} />)}</tbody>
            </Table>
          )}
          {rows.length > PAGE_SIZE && <div className="border-t border-rule px-4 py-3"><Pagination page={page} pageCount={pageCount} onChange={setPage} summary={`${rows.length} ca`} /></div>}
        </Panel>
      </div>
    </Layout>
  )
}

/** Khối nổi bật: số ca chưa đóng và tỷ lệ theo mức độ (thanh màu + chú giải có số). */
function ActiveCasesBlock({ counts, className }: { counts: HealthCaseCounts; className?: string }) {
  const active = counts.severe + counts.moderate + counts.mild
  const parts: Array<{ key: Severity; value: number }> = [
    { key: 'SEVERE', value: counts.severe }, { key: 'MODERATE', value: counts.moderate }, { key: 'MILD', value: counts.mild },
  ]
  return (
    <Panel tone="emphasis" className={cx('justify-between gap-4', className)}>
      <div className="flex flex-col gap-1">
        <p className="m-0 text-xs text-side-text">Ca chưa đóng</p>
        <p className="m-0 flex items-baseline gap-3"><span className="text-[40px] font-bold leading-none">{active}</span>
          <span className="text-xs text-side-text">{counts.open} đang mở · {counts.treating} đang điều trị</span></p>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex h-2.5 overflow-hidden rounded-full bg-white/15" role="img" aria-label={`Theo mức độ: ${parts.map((p) => `${SEVERITY_LABEL[p.key]} ${p.value}`).join(', ')}`}>
          {active > 0 && parts.map((p) => p.value > 0 && <span key={p.key} className={SEVERITY_COLOR[p.key].bar} style={{ width: `${(p.value / active) * 100}%` }} />)}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {parts.map((p) => (
            <span key={p.key} className="inline-flex items-center gap-1.5"><span aria-hidden="true" className={cx('size-2.5 rounded-full', SEVERITY_COLOR[p.key].bar)} />{SEVERITY_LABEL[p.key]} <strong>{p.value}</strong></span>
          ))}
        </div>
      </div>
    </Panel>
  )
}

/** Khối cảnh báo: đỏ nhạt khi có ca nặng hoặc nghi truyền nhiễm, xanh nhạt khi không có gì cần xử lý ngay. */
function AttentionBlock({ counts, onSevere, className }: { counts: HealthCaseCounts; onSevere: () => void; className?: string }) {
  const alert = counts.severe + counts.contagious > 0
  return (
    <Panel tone={alert ? 'err' : 'ok'} className={cx('gap-3', className)}>
      <p className="m-0 flex items-center gap-2 text-sm font-semibold text-ink">
        <Icon name={alert ? 'alert-triangle' : 'circle-check'} size={18} className={alert ? 'text-err-fg' : 'text-ok-fg'} />
        {alert ? 'Cần chú ý ngay' : 'Không có ca cần xử lý gấp'}
      </p>
      <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[13px]">
        <AttentionLine value={counts.severe} text="ca mức độ nặng" action={counts.severe > 0 ? <button type="button" onClick={onSevere} className="cursor-pointer text-xs font-semibold text-brand hover:underline">Xem</button> : null} />
        <AttentionLine value={counts.contagious} text="ca nghi truyền nhiễm – cách ly, báo thú y" />
        <AttentionLine value={counts.treating} text="ca đang điều trị – theo dõi ngưng thịt" tone="warn" />
      </ul>
    </Panel>
  )
}

const AttentionLine = ({ value, text, action, tone = 'err' }: { value: number; text: string; action?: ReactNode; tone?: 'err' | 'warn' }) => (
  <li className="flex items-center gap-2 border-t border-black/5 pt-2 first:border-t-0 first:pt-0">
    <strong className={cx('min-w-7 text-xl', value === 0 ? 'text-muted' : tone === 'err' ? 'text-err-fg' : 'text-warn-fg')}>{value}</strong>
    <span className={cx('flex-1', value === 0 ? 'text-muted' : 'text-ink')}>{text}</span>{action}
  </li>
)

const SmallBlock = ({ label, value, sub, className }: { label: string; value: number; sub: string; className?: string }) => (
  <Panel className={cx('justify-between gap-1', className)}>
    <p className="m-0 text-xs text-label">{label}</p>
    <p className="m-0 text-[32px] font-bold leading-none text-ink">{value}</p>
    <p className="m-0 text-[11px] text-label">{sub}</p>
  </Panel>
)

/** Một dòng ca: vạch màu đầu dòng theo mức độ, nền đỏ nhạt khi nghi truyền nhiễm; cả dòng mở tab Sức khỏe của bò. */
function CaseRow({ row: r, onOpen }: { row: HealthCaseRow; onOpen: () => void }) {
  return (
    // Cả dòng bấm được: nhận focus bằng Tab, Enter/Space như nhấn chuột (Bento §3).
    <tr tabIndex={0} aria-label={`Ca ${r.caseCode} của ${r.cattleCode}`} className={cx(interactiveRowClass, r.suspectedContagious && 'bg-err-bg/50')}
      onClick={(event) => activateTableRow(event, onOpen)} onKeyDown={(event) => activateTableRowByKey(event, onOpen)}>
      <Td className={cx('border-l-4 font-semibold text-brand', SEVERITY_COLOR[r.severity].edge)}>{r.caseCode}</Td>
      <Td>
        <div className="font-medium text-ink"><span className="whitespace-nowrap">{r.cattleCode}</span>{r.cattleName && ` · ${r.cattleName}`}</div>
        <div className="text-[11px] text-muted">{[r.breed, r.sex, r.penCode && `Chuồng ${r.penCode}`].filter(Boolean).join(' · ')}</div>
      </Td>
      <Td><div className="flex flex-wrap items-center gap-1.5">{caseLabel(r)}{r.suspectedContagious && <Badge tone="err" icon="alert-triangle">Nghi truyền nhiễm</Badge>}</div></Td>
      <Td><SeverityBadge severity={r.severity} /></Td>
      <Td className="whitespace-nowrap">{fmtDate(r.openedDate)}</Td>
      <Td><CaseStatusBadge status={r.status} day={r.day} chronicSince={r.chronicSince} outcome={r.outcome} /></Td>
      <Td><Icon name="chevron-right" size={14} /></Td>
    </tr>
  )
}
