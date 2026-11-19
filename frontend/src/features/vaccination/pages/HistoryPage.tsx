import { useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { DateInput, EmptyBlock, ErrorBlock, FilterSelect, Foot, LoadingBlock, PageHeader, Pagination, SearchInput, Table, Td, Th } from '../../../components/ui'
import { userFacingError } from '../../../api/userFacingError'
import { useQuery } from '../../../hooks/useApi'
import { vaccinationApi } from '../api/vaccinationApi'
import { SOURCE_LABEL, healthCasePath, profilePath } from '../components/vaccinationParts'
import { fmtDateTime, fmtMonthYear } from '../domain/vaccinationFormat'
import type { HistoryRow, VaccinationSource } from '../types'

const TITLE = 'Lịch sử tiêm phòng'

export default function HistoryPage() {
  const [q, setQ] = useState('')
  const [vaccineId, setVaccine] = useState('')
  const [source, setSource] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const options = useQuery(() => vaccinationApi.options(), [])
  const { data, loading, error, refetch } = useQuery(
    () => vaccinationApi.listHistory({ q, vaccineId: vaccineId ? Number(vaccineId) : undefined, source: (source || undefined) as VaccinationSource | undefined, from: from || undefined, to: to || undefined, page }),
    [q, vaccineId, source, from, to, page],
  )
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1) }

  if (loading && !data) return <Layout title={TITLE}><LoadingBlock /></Layout>
  if (error || !data) return <Layout title={TITLE}><ErrorBlock message={userFacingError(error, 'Không tải được lịch sử tiêm phòng.')} onRetry={refetch} /></Layout>

  const first = data.total === 0 ? 0 : (data.page - 1) * data.size + 1
  return (
    <Layout title={TITLE}>
      <div className="flex flex-col gap-5">
        <PageHeader title={TITLE} sub="Tra cứu mũi tiêm của cả đàn · mặc định 3 tháng gần nhất" />
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-full sm:w-[280px]"><SearchInput aria-label="Tìm mã hiển thị, số tai" placeholder="Tìm mã hiển thị, số tai" value={q} onChange={(e) => reset(setQ)(e.target.value)} /></div>
          <FilterSelect aria-label="Vắc-xin" value={vaccineId} onChange={(e) => reset(setVaccine)(e.target.value)}>
            <option value="">Vắc-xin: Tất cả</option>
            {options.data?.vaccines.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </FilterSelect>
          <FilterSelect aria-label="Nguồn" value={source} onChange={(e) => reset(setSource)(e.target.value)}>
            <option value="">Nguồn: Tất cả</option>
            <option value="ON_FARM">{SOURCE_LABEL.ON_FARM}</option>
            <option value="HISTORICAL">{SOURCE_LABEL.HISTORICAL}</option>
          </FilterSelect>
          <div className="flex items-center gap-2">
            <DateInput id="vh-from" value={from || data.from} onChange={reset(setFrom)} />
            <span className="text-muted">–</span>
            <DateInput id="vh-to" value={to || data.to} onChange={reset(setTo)} />
          </div>
        </div>
        {data.rows.length === 0 ? (
          <EmptyBlock title="Không có mũi tiêm phù hợp" sub="Thử mở rộng khoảng thời gian hoặc đổi bộ lọc." />
        ) : (
          <div className="flex flex-col gap-3 rounded-md border border-edge bg-white p-4">
            <Table>
              <thead><tr><Th>Thời điểm ↓</Th><Th>Bò · chuồng</Th><Th>Vắc-xin · mũi</Th><Th>Lô · liều</Th><Th>Nguồn</Th><Th>Người tiêm</Th><Th>Phản ứng</Th></tr></thead>
              <tbody>{data.rows.map((r) => <Row key={r.id} r={r} />)}</tbody>
            </Table>
            <Pagination page={data.page} pageCount={Math.max(1, Math.ceil(data.total / data.size))} onChange={setPage} summary={`Hiển thị ${first}–${first + data.rows.length - 1} / ${data.total} mũi tiêm`} />
          </div>
        )}
        <Foot>Màn tra cứu lịch sử tiêm của cả đàn, mọi vai trò đều xem được. Bản ghi nhập lịch sử hiện "Không rõ" cho thông tin người bán không cung cấp. Nhấn mã ca ở cột Phản ứng để mở ca sức khỏe.</Foot>
      </div>
    </Layout>
  )
}

function Row({ r }: { r: HistoryRow }) {
  const voided = r.status === 'VOIDED'
  const unknown = r.source === 'HISTORICAL'
  return (
    <tr className={voided ? 'text-faint' : undefined}>
      <Td className="font-medium">{r.precision === 'MONTH' ? fmtMonthYear(r.administeredAt) : fmtDateTime(r.administeredAt)}</Td>
      <Td><Link to={profilePath(r.cattleCode)} className="text-inherit no-underline hover:underline">{r.cattleCode}{r.penCode && ` · ${r.penCode}`}</Link></Td>
      <Td>{[r.vaccineLabel, r.doseText?.replace('mũi ', '')].filter(Boolean).join(' · ')}{voided && ' (đã hủy)'}</Td>
      <Td>{r.batchNo || r.dose ? [r.batchNo, r.dose].filter(Boolean).join(' · ') : unknown ? 'Không rõ' : '—'}</Td>
      <Td>{SOURCE_LABEL[r.source]}</Td>
      <Td>{r.vaccinator ?? (unknown ? 'Không rõ' : '—')}</Td>
      <Td>{r.reactionCaseCode ? <Link to={healthCasePath(r.reactionCaseCode)} className="font-semibold text-brand no-underline hover:underline">{r.reactionCaseCode}{r.reactionNote ? ` · ${r.reactionNote}` : ''}</Link> : '—'}</Td>
    </tr>
  )
}
