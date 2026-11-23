import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import TechnicianLayout from '../../../app/layouts/TechnicianLayout'
import { Button, EmptyBlock, ErrorBlock, Icon, LoadingBlock, SearchInput } from '../../../shared/ui'
import { useTechnicianHerdQuery } from '../hooks/useCattleQueries'
import { Chip, Seg, chipIcon } from './parts'

const FILTERS = [
  ['all', 'Tất cả'],
  ['cow', 'Bò cái'],
  ['fattening', 'Vỗ béo'],
  ['calf', 'Bê'],
] as const

// Danh sách đàn bò trên điện thoại của Kỹ thuật viên (chỉ xem).
export default function TechnicianHerd() {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  useEffect(() => {
    if (q.trim() === search) return
    const timer = setTimeout(() => { setSearch(q.trim()); setPage(0) }, 300)
    return () => clearTimeout(timer)
  }, [q, search])
  const { data, loading, error, refetch } = useTechnicianHerdQuery({ q: search, filter, page })
  // Keep the existing visibility guard for cattle unavailable in the active herd (e.g. local pending exits).
  // Search and herd-group filtering belong to the API, never to translated stage labels here.
  const rows = (data?.items ?? []).filter(c => c.status === 'ACTIVE' && c.inList !== false)
  const total = data?.counts.ACTIVE ?? 0
  const searching = q.trim() !== search

  return (
    <TechnicianLayout title="Đàn bò" sub={data ? `${total} con đang nuôi` : undefined}>
      <SearchInput aria-label="Tìm bò" placeholder="Tìm mã bò, số tai" value={q} onChange={(e) => setQ(e.target.value)} />
      <div><Seg options={FILTERS} value={filter} onChange={value => { setFilter(value); setPage(0) }} /></div>
      {data && (search || filter !== 'all') && <p className="m-0 text-xs text-muted">Tìm thấy {data.total} con</p>}
      {loading && !data && <LoadingBlock />}
      {error ? <ErrorBlock message={data ? 'Không tải thêm được bò. Danh sách đã tải được giữ nguyên.' : 'Không tải được danh sách đàn bò.'} onRetry={refetch} /> : null}
      {data && !loading && !error && rows.length === 0 && <EmptyBlock title="Không có bò nào khớp" sub="Đổi từ khóa hoặc bộ lọc." />}
      {rows.map((c) => {
        const badge = c.repro ?? c.health
        return (
          <Link key={c.code} to={`/kt/dan-bo/${c.code}`} className="flex items-center gap-3 rounded-lg border border-edge bg-white p-[15px] text-inherit no-underline">
            <span className="flex min-w-0 flex-1 flex-col gap-1 leading-[normal]">
              <span className="text-sm font-semibold text-[#212121]">{c.code}</span>
              <span className="truncate text-[11px] text-muted">{[c.breed, c.sex, c.ageShort, c.barn].filter(Boolean).join(' · ')}</span>
              {badge && <span><Chip tone={badge.tone} icon={chipIcon(badge.label)}>{badge.label}</Chip></span>}
            </span>
            <Icon name="chevron-right" size={18} className="text-muted" />
          </Link>
        )
      })}
      {data && loading && <p role="status" className="m-0 text-xs text-muted">Đang tải thêm bò…</p>}
      {data && data.items.length < data.total && !error && <Button disabled={loading || searching} onClick={() => setPage(value => value + 1)}>Tải thêm</Button>}
    </TechnicianLayout>
  )
}
