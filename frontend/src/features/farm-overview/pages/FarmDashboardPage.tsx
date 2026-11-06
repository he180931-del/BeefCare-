import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { userFacingError } from '../../../api/userFacingError'
import Layout from '../../../components/Layout'
import { Icon } from '../../../components/Icon'
import { Badge, Button, ErrorBlock, Foot, LoadingBlock, PageHeader } from '../../../components/ui'
import { useQuery } from '../../../hooks/useApi'
import { useDemoState } from '../../../hooks/useDemoState'
import { useSession } from '../../authorization'
import { farmOverviewApi } from '../api/farmOverviewApi'
import DashboardFilterBar from '../components/DashboardFilterBar'
import { AttentionCard, GettingStartedCard, HerdStructureCard } from '../components/DashboardCards'
import { PrimaryMetrics, SecondaryMetrics } from '../components/DashboardMetrics'
import { formatDateTime, formatKey } from '../domain/format'
import { viewerRole } from '../domain/viewer'
import type { DashboardFilters, Scenario } from '../types'

const TITLE = 'Tổng quan trang trại'

export default function FarmDashboardPage() {
  const role = viewerRole(useSession()?.role)
  const navigate = useNavigate()
  const scenario: Scenario = useDemoState() === 'new-farm' ? 'new-farm' : 'default'
  const viewer = useMemo(() => ({ role, scenario }), [role, scenario])
  const [filters, setFilters] = useState<DashboardFilters>({ period: '30' })
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const dash = useQuery(() => farmOverviewApi.getDashboard(filters, viewer), [filters, viewer])
  const started = useQuery(() => farmOverviewApi.getGettingStarted(viewer), [viewer])

  const act = async (run: () => Promise<unknown>) => {
    setBusy(true)
    setActionError('')
    try { await run(); started.refetch() } catch (e) { setActionError(userFacingError(e, 'Không lưu được. Vui lòng thử lại.')) } finally { setBusy(false) }
  }

  if (dash.loading && !dash.data) return <Layout title={TITLE}><LoadingBlock /></Layout>
  if (dash.error || !dash.data) return <Layout title={TITLE}><ErrorBlock message={userFacingError(dash.error, 'Không tính được số liệu.')} onRetry={dash.refetch} /></Layout>

  const view = dash.data
  const guide = started.data?.visible ? started.data : null
  const periodLabel = filters.period === 'custom' ? `${formatKey(filters.from ?? '')}–${formatKey(filters.to ?? '')}` : `${filters.period} ngày`

  return (
    <Layout title={TITLE}>
      <div className="flex flex-col gap-4">
        <PageHeader
          title={view.farmName}
          sub={<>{view.activeCattle} con đang nuôi · Dịch vụ: <Badge tone="ok">{`${view.serviceStatus} · đến ${formatKey(view.serviceUntil)}`}</Badge></>}
        >
          <Button onClick={() => navigate('/bao-cao')}>Báo cáo quản lý <Icon name="chevron-right" size={14} /></Button>
        </PageHeader>
        <DashboardFilterBar filters={filters} pens={view.pens} onChange={setFilters} />
        <PrimaryMetrics view={view} />
        {actionError && <p role="alert" className="m-0 text-xs text-err-fg">{actionError}</p>}
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
          {guide
            ? <GettingStartedCard data={guide} busy={busy} onMark={(step) => act(() => farmOverviewApi.markStepDone(step, viewer))} onDismiss={() => act(() => farmOverviewApi.dismissGettingStarted(viewer))} />
            : <AttentionCard rows={view.attention} />}
          <HerdStructureCard data={view.indicators.m05} />
        </div>
        <SecondaryMetrics view={view} periodLabel={periodLabel} />
        <Foot>
          {guide
            ? 'Trại mới: khung "Bắt đầu sử dụng" thay cho "Cần chú ý hôm nay" đến khi xong các bước hoặc chọn "Ẩn hướng dẫn". Danh mục khởi tạo theo Bảng III-6.'
            : `Số liệu tính lúc ${formatDateTime(view.generatedAt)} theo múi giờ của trại. Kỳ chỉ áp dụng cho M06; các chỉ số khác tính đến thời điểm hiện tại.`}
        </Foot>
      </div>
    </Layout>
  )
}
