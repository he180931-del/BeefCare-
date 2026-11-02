import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TechnicianLayout from '../../../components/TechnicianLayout'
import { Icon } from '../../../components/Icon'
import { Badge, EmptyBlock, ErrorBlock, Foot, LoadingBlock, Segmented } from '../../../components/ui'
import { userFacingError } from '../../../api/userFacingError'
import { useQuery } from '../../../hooks/useApi'
import { reproductionApi } from '../api/reproductionApi'
import { filterWorklist, tabCounts, technicianRowInfo, type WorklistTab } from '../domain/reproductionRules'

const TABS: Array<{ value: WorklistTab; label: string }> = [
  { value: 'IN_ESTRUS', label: 'Động dục' },
  { value: 'BRED', label: 'Đã phối – chờ khám thai' },
  { value: 'PREGNANT', label: 'Mang thai' },
]

export default function TechnicianReproductionPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<WorklistTab>('IN_ESTRUS')
  const [query, setQuery] = useState('')
  const { data, loading, error, refetch } = useQuery(() => reproductionApi.listWorklist(), [])
  const rows = useMemo(() => data ?? [], [data])
  const counts = useMemo(() => tabCounts(rows), [rows])
  const shown = useMemo(() => filterWorklist(rows, { status: tab, query }), [rows, tab, query])

  return (
    <TechnicianLayout title="Sinh sản" sub="Trại bò Yên Bài – Ba Vì">
      <div className="flex flex-col gap-3">
        <input aria-label="Tìm bò" className="h-11 w-full rounded-xl border border-field bg-white px-3 text-sm" placeholder="Tìm mã bò, số tai" value={query} onChange={(event) => setQuery(event.target.value)} />
        <div className="overflow-x-auto">
          <Segmented value={tab} onChange={(value) => setTab(value as WorklistTab)} options={TABS.map((item) => ({ value: item.value, label: `${item.label} (${counts[item.value]})` }))} />
        </div>
        {loading && !data ? <LoadingBlock /> : error ? <ErrorBlock message={userFacingError(error, 'Không tải được danh sách sinh sản.')} onRetry={refetch} /> : shown.length === 0 ? <EmptyBlock title="Không có bò nào" sub="Đổi tab hoặc từ khóa tìm kiếm." /> : shown.map((row) => {
          const info = technicianRowInfo(row)
          return (
            <button key={row.cattleCode} type="button" onClick={() => navigate(`/kt/dan-bo/${encodeURIComponent(row.cattleCode)}?tab=repro`)} className="flex w-full items-center gap-2 rounded-lg border border-edge bg-white p-3 text-left">
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-sm font-semibold text-ink">{row.cattleCode}</span>
                <span className="text-[11px] text-muted">{info.subtitle}</span>
                <span><Badge tone={info.badge.tone}>{info.badge.label}</Badge></span>
              </span>
              <Icon name="chevron-right" size={18} className="text-muted" />
            </button>
          )
        })}
        <Foot>Kỹ thuật viên chỉ xem; báo Quản lý để ghi nhận.</Foot>
      </div>
    </TechnicianLayout>
  )
}
