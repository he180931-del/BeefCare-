import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '../../../components/Icon'
import Layout from '../../../components/Layout'
import { Badge, EmptyBlock, ErrorBlock, FilterSelect, Foot, LoadingBlock, Metric, PageHeader, Pagination, SearchInput, Table, Td, Th } from '../../../components/ui'
import { userFacingError } from '../../../api/userFacingError'
import { useDemoState } from '../../../hooks/useDemoState'
import { useQuery } from '../../../hooks/useApi'
import { growthApi } from '../api/growthApi'
import { fmtDate, fmtDec, fmtKg } from '../domain/growthFormat'
import { BASIS_LABEL, STATUS_LABEL } from '../domain/growthLabels'
import type { GrowthFilters, GrowthHerdRow, GrowthHerdStatus, GrowthWindow } from '../types'

const TITLE = 'Tăng trưởng & BCS'

const StatusBadge = ({ status }: { status: GrowthHerdStatus }) =>
  status === 'NORMAL' ? <Badge tone="ok" icon="circle-check">{STATUS_LABEL[status]}</Badge>
  : status === 'OVERDUE' ? <Badge tone="warn" icon="alert-triangle">{STATUS_LABEL[status]}</Badge>
  : <Badge tone={status === 'LOW_BCS' ? 'err' : 'warn'}>{STATUS_LABEL[status]}</Badge>

export default function GrowthHerdPage() {
  const navigate = useNavigate()
  const demo = useDemoState()
  const [q, setQ] = useState('')
  const [penCode, setPen] = useState('')
  const [herdGroup, setGroup] = useState('')
  const [lifeStage, setStage] = useState('')
  const [windowDays, setWindow] = useState<GrowthWindow>(90)
  const [dir, setDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const filters: GrowthFilters = { q, penCode, herdGroup, lifeStage, windowDays, dir, page }
  const options = useQuery(() => growthApi.filterOptions(), [])
  const { data, loading, error, refetch } = useQuery(
    () => (demo === 'load-error' ? Promise.reject(new Error('demo')) : growthApi.listHerd(filters)),
    [q, penCode, herdGroup, lifeStage, windowDays, dir, page, demo],
  )
  const change = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1) }

  if (loading && !data) return <Layout title={TITLE}><LoadingBlock /></Layout>
  if (error || !data) return <Layout title={TITLE}><ErrorBlock message={userFacingError(error, 'Không tải được dữ liệu tăng trưởng.')} onRetry={refetch} /></Layout>

  const { tiles, rows, total, size } = data
  const first = total === 0 ? 0 : (data.page - 1) * size + 1
  return (
    <Layout title={TITLE}>
      <div className="flex flex-col gap-5">
        <PageHeader title={TITLE} sub={`${data.activeCount} con đang nuôi · ADG tính trên các lần cân hợp lệ trong kỳ đã chọn`} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[260px_repeat(4,minmax(0,1fr))]">
          <SearchInput aria-label="Tìm mã hiển thị, số tai" placeholder="Tìm mã hiển thị, số tai" value={q} onChange={(e) => change(setQ)(e.target.value)} />
          <FilterSelect aria-label="Chuồng" value={penCode} onChange={(e) => change(setPen)(e.target.value)}>
            <option value="">Chuồng: Tất cả</option>
            {options.data?.pens.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
          </FilterSelect>
          <FilterSelect aria-label="Nhóm đàn" value={herdGroup} onChange={(e) => change(setGroup)(e.target.value)}>
            <option value="">Nhóm đàn: Tất cả</option>
            {options.data?.herdGroups.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
          </FilterSelect>
          <FilterSelect aria-label="Giai đoạn" value={lifeStage} onChange={(e) => change(setStage)(e.target.value)}>
            <option value="">Giai đoạn: Tất cả</option>
            {options.data?.lifeStages.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </FilterSelect>
          <FilterSelect aria-label="Kỳ ADG" value={String(windowDays)} onChange={(e) => change(setWindow)(Number(e.target.value) as GrowthWindow)}>
            {[30, 90, 180].map((d) => <option key={d} value={d}>Kỳ ADG: {d} ngày</option>)}
          </FilterSelect>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric compact warn label="Quá hạn cân" value={tiles.overdue} sub="chu kỳ cân 30 ngày" />
          <Metric compact warn label="ADG thấp hơn TB chuồng" value={tiles.lowAdg} sub={`trong kỳ ${windowDays} ngày`} />
          <Metric compact label={<span className={tiles.lowBcs ? 'text-err-fg' : undefined}>BCS &lt; 2,5</span>} value={<span className={tiles.lowBcs ? 'text-err-fg' : undefined}>{tiles.lowBcs}</span>} sub="theo lần đo gần nhất" />
          <Metric compact label="Lượt cân 30 ngày" value={tiles.weighings30} sub="bản ghi hợp lệ" />
        </div>
        {rows.length === 0 ? (
          <EmptyBlock title="Không có bò phù hợp" sub="Thử đổi bộ lọc hoặc từ khóa tìm kiếm." />
        ) : (
          <div className="flex flex-col gap-3 rounded-md border border-edge bg-white p-4">
            <Table>
              <thead>
                <tr>
                  <Th>Bò</Th><Th>Chuồng</Th><Th>Cân gần nhất</Th>
                  <Th><button type="button" className="font-semibold" onClick={() => change(setDir)(dir === 'desc' ? 'asc' : 'desc')}>Ngày cân {dir === 'desc' ? '↓' : '↑'}</button></Th>
                  <Th>ADG {windowDays} ngày</Th><Th>BCS</Th><Th>Tình trạng</Th><Th>{''}</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => <Row key={r.code} r={r} onOpen={() => navigate(`/cattle/${r.code}?tab=growth`)} />)}
              </tbody>
            </Table>
            <Pagination page={data.page} pageCount={Math.max(1, Math.ceil(total / size))} onChange={setPage} summary={`Hiển thị ${first}–${first + rows.length - 1} / ${total} con`} />
          </div>
        )}
        <Foot>Màn theo dõi tăng trưởng cấp đàn. "—" ở ADG nghĩa là chưa đủ 2 lần cân hợp lệ trong kỳ. Tình trạng: Quá hạn cân / ADG thấp / BCS thấp / Bình thường. Nhấn › để mở tab Tăng trưởng & BCS của hồ sơ bò.</Foot>
      </div>
    </Layout>
  )
}

function Row({ r, onOpen }: { r: GrowthHerdRow; onOpen: () => void }) {
  return (
    <tr className="cursor-pointer hover:bg-page" onClick={onOpen}>
      <Td>
        <span className="font-medium">{r.name ? `${r.code} “${r.name}”` : r.code}</span>
        <span className="block text-[11px] text-muted">{r.breed} · {r.sex}</span>
      </Td>
      <Td>{r.penName}</Td>
      <Td>{r.latestWeightKg === undefined ? '—' : `${fmtKg(r.latestWeightKg)} kg · ${BASIS_LABEL[r.latestBasis!]}`}</Td>
      <Td>{r.weighedAt ? fmtDate(r.weighedAt) : '—'}</Td>
      <Td>{r.adg === undefined ? '—' : `${fmtDec(r.adg, 2)} kg/ngày`}</Td>
      <Td>{r.bcs === undefined ? '—' : fmtDec(r.bcs)}</Td>
      <Td><StatusBadge status={r.status} /></Td>
      <Td>
        <Link to={`/cattle/${r.code}?tab=growth`} aria-label={`Mở hồ sơ ${r.code}`} onClick={(e) => e.stopPropagation()} className="text-ink no-underline"><Icon name="chevron-right" /></Link>
      </Td>
    </tr>
  )
}
