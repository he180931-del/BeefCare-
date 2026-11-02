import { useState } from 'react'
import { Link } from 'react-router-dom'
import TechnicianLayout from '../../../components/TechnicianLayout'
import { ErrorBlock, LoadingBlock, EmptyBlock, SearchInput } from '../../../components/ui'
import { Icon } from '../../../components/Icon'
import { listCowsPage } from '../api/cattleApi'
import { useQuery } from '../../../hooks/useApi'
import { Chip, Seg, chipIcon } from './parts'
import type { CowSeed } from '../../../data/cowsData'

const FILTERS = [
  ['all', 'Tất cả'],
  ['cow', 'Bò cái'],
  ['fattening', 'Vỗ béo'],
  ['calf', 'Bê'],
] as const

const matches = (c: CowSeed, filter: string): boolean =>
  filter === 'all' || (filter === 'cow' && c.sex === 'Cái') || (filter === 'fattening' && c.stage === 'Vỗ béo') || (filter === 'calf' && c.stage === 'Bê')

// Danh sách đàn bò trên điện thoại của Kỹ thuật viên (chỉ xem).
export default function TechnicianHerd() {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const { data, loading, error, refetch } = useQuery(() => listCowsPage({ herdStatus: 'ACTIVE', size: 100 }), [])
  const needle = q.trim().toLowerCase()
  const rows = (data?.items ?? []).filter((c) => c.status === 'ACTIVE' && c.inList !== false && matches(c, filter) && (!needle || [c.code, c.tag, c.name].some((v) => v && v.toLowerCase().includes(needle))))
  const total = data ? data.counts.ACTIVE ?? data.items.filter((c) => c.status === 'ACTIVE' && c.inList !== false).length : 0

  return (
    <TechnicianLayout title="Đàn bò" sub={data ? `${total} con đang nuôi` : undefined}>
      <SearchInput aria-label="Tìm bò" placeholder="Tìm mã bò, số tai" value={q} onChange={(e) => setQ(e.target.value)} />
      <div><Seg options={FILTERS} value={filter} onChange={setFilter} /></div>
      {loading && !data && <LoadingBlock />}
      {error ? <ErrorBlock message="Không tải được danh sách đàn bò." onRetry={refetch} /> : null}
      {data && rows.length === 0 && <EmptyBlock title="Không có bò nào khớp" sub="Đổi từ khóa hoặc bộ lọc." />}
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
    </TechnicianLayout>
  )
}
