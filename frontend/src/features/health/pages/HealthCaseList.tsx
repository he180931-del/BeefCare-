import { useState } from 'react'
import { Link } from 'react-router-dom'
import { userFacingError } from '../../../api/userFacingError'
import Layout from '../../../components/Layout'
import { Badge, DateInput, EmptyBlock, ErrorBlock, FilterSelect, Foot, LoadingBlock, PageHeader, Pagination, SearchInput, Segmented, Table, Td, Th } from '../../../components/ui'
import { useQuery } from '../../../hooks/useApi'
import { useDemoState } from '../../../hooks/useDemoState'
import { healthApi } from '../api/healthApi'
import { addDays, dateOf, SEVERITIES, SEVERITY_LABEL } from '../domain/healthFormat'
import type { CaseTab, HealthCaseFilters, Severity } from '../types'
import { CaseStatusBadge, SeverityBadge } from '../components/healthUi'

const TITLE = 'Sức khỏe & Điều trị'
const PAGE_SIZE = 10
const NOTE = 'Màn danh sách ca sức khỏe của đàn. Tab Đang mở luôn hiện mọi ca chưa đóng, không lọc theo kỳ. Trạng thái: OPEN · ngày n, CHRONIC · từ ngày, CLOSED · kết quả. Nhấn mã ca hoặc › để mở tab Sức khỏe của hồ sơ bò.'

function initialFilters(): HealthCaseFilters {
  const to = dateOf(healthApi.now())
  return { tab: 'open', search: '', severity: '', penCode: '', from: addDays(to, -30), to, sort: 'openedAt', dir: 'desc' }
}

export default function HealthCaseList() {
  const demo = useDemoState()
  const [filters, setFilters] = useState<HealthCaseFilters>(initialFilters)
  const [page, setPage] = useState(1)
  const { data, loading, error, refetch } = useQuery(() => (demo === 'load-error' ? Promise.reject(new Error('Không tải được danh sách ca sức khỏe.')) : healthApi.listCases(filters)), [filters, demo])
  const update = (patch: Partial<HealthCaseFilters>) => { setFilters((f) => ({ ...f, ...patch })); setPage(1) }
  const toggleSort = (key: 'openedAt' | 'caseCode') => update({ sort: key, dir: filters.sort === key && filters.dir === 'desc' ? 'asc' : 'desc' })

  if (loading && !data) return <Layout title={TITLE}><LoadingBlock /></Layout>
  if (error || !data) return <Layout title={TITLE}><ErrorBlock message={userFacingError(error, 'Không tải được danh sách ca sức khỏe.')} onRetry={refetch} /></Layout>

  const { rows, counts, pens } = data
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const visible = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const arrow = (key: 'openedAt' | 'caseCode') => (filters.sort === key ? (filters.dir === 'asc' ? ' ↑' : ' ↓') : '')

  return (
    <Layout title={TITLE}>
      <PageHeader title={TITLE} sub={`${counts.open} ca đang mở · ${counts.chronic} ca theo dõi mạn tính · mở ca mới từ hồ sơ bò`} />
      <Segmented
        value={filters.tab ?? 'open'}
        onChange={(tab) => update({ tab: tab as CaseTab })}
        options={[
          { value: 'open', label: `Đang mở (${counts.open})` },
          { value: 'chronic', label: `Mạn tính (${counts.chronic})` },
          { value: 'closed', label: `Đã đóng (${counts.closed})` },
          { value: 'all', label: `Tất cả (${counts.all})` },
        ]}
      />
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput className="w-full sm:w-[280px]" placeholder="Tìm mã bò, mã ca" aria-label="Tìm mã bò, mã ca" value={filters.search} onChange={(e) => update({ search: e.target.value })} />
        <FilterSelect aria-label="Mức độ" value={filters.severity} onChange={(e) => update({ severity: e.target.value as Severity | '' })}>
          <option value="">Mức độ: Tất cả</option>
          {SEVERITIES.map((s) => <option key={s} value={s}>{SEVERITY_LABEL[s]}</option>)}
        </FilterSelect>
        <FilterSelect aria-label="Chuồng" value={filters.penCode} onChange={(e) => update({ penCode: e.target.value })}>
          <option value="">Chuồng: Tất cả</option>
          {pens.map((p) => <option key={p.code} value={p.code}>{p.code} – {p.name}</option>)}
        </FilterSelect>
        <div className="flex items-center gap-2 text-xs text-muted">
          <span>Mở từ</span>
          <DateInput id="hc-from" value={filters.from ?? ''} onChange={(from) => update({ from })} />
          <span>–</span>
          <DateInput id="hc-to" value={filters.to ?? ''} onChange={(to) => update({ to })} />
        </div>
        <Foot>Kỳ chỉ lọc ca đã đóng; ca đang mở và mạn tính luôn hiện.</Foot>
      </div>
      {rows.length === 0 ? (
        <EmptyBlock title="Không có ca sức khỏe phù hợp" sub="Thử đổi bộ lọc hoặc mở ca mới từ hồ sơ bò." />
      ) : (
        <>
          <Table wide>
            <thead>
              <tr>
                <Th className="w-[88px]"><button type="button" className="font-semibold" onClick={() => toggleSort('caseCode')}>Mã ca{arrow('caseCode')}</button></Th>
                <Th>Bò</Th><Th>Chuồng</Th><Th>Dấu hiệu</Th><Th>Mức độ</Th>
                <Th><button type="button" className="font-semibold" onClick={() => toggleSort('openedAt')}>Mở lúc{arrow('openedAt')}</button></Th>
                <Th>Trạng thái</Th><Th className="w-8"><span className="sr-only">Mở</span></Th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const to = `/cattle/${r.cattleCode}?tab=health`
                return (
                  <tr key={r.id}>
                    <Td><Link to={to} className="font-semibold text-brand no-underline hover:underline">{r.caseCode}</Link></Td>
                    <Td><div className="font-medium text-ink">{r.cattleCode}{r.cattleName && ` “${r.cattleName}”`}</div><div className="text-[11px] text-muted">{r.breed} · {r.sex}</div></Td>
                    <Td>{r.penCode} – {r.penName}</Td>
                    <Td>{r.signs}{r.suspectedContagious && <> <Badge tone="err">Truyền nhiễm</Badge></>}</Td>
                    <Td><SeverityBadge severity={r.severity} /></Td>
                    <Td>{r.openedDate.split('-').reverse().join('/')}</Td>
                    <Td><CaseStatusBadge status={r.status} day={r.day} chronicSince={r.chronicSince} outcome={r.outcome} /></Td>
                    <Td><Link to={to} aria-label={`Mở hồ sơ ${r.cattleCode}`} className="text-ink no-underline">›</Link></Td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
          {rows.length > PAGE_SIZE && <Pagination page={page} pageCount={pageCount} onChange={setPage} summary={`${rows.length} ca`} />}
        </>
      )}
      <Foot>{NOTE}</Foot>
    </Layout>
  )
}
