import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { userFacingError } from '../../../shared/api/userFacingError'
import Layout from '../../../app/layouts/FarmPlatformLayout'
import { Badge, Button, ErrorBlock, Foot, Icon, LoadingBlock, PageHeader } from '../../../shared/ui'
import { useQuery } from '../../../shared/hooks/useQuery'
import { useDemoState } from '../../../demo/demoModules'
import { useSession } from '../../../app/session/sessionContext'
import { farmOverviewApi } from '../api/farmOverviewApi'
import DashboardFilterBar from '../components/DashboardFilterBar'
import { GettingStartedCard, HerdStructureCard, QuickRecordCard } from '../components/DashboardCards'
import { PrimaryMetrics, SecondaryMetrics } from '../components/DashboardMetrics'
import DashboardTodoCard from '../components/DashboardTodoCard'
import { formatDateTime, formatKey } from '../domain/format'
import { HERD_GROUP_LABEL, LIFE_STAGE_LABEL } from '../domain/dashboardRules'
import { viewerRole } from '../domain/viewer'
import type { DashboardFilters, DashboardView, Scenario } from '../types'

const TITLE = 'Tổng quan trang trại'

export default function FarmDashboardPage() {
  const role = viewerRole(useSession()?.role)
  const navigate = useNavigate()
  const scenario: Scenario = useDemoState() === 'new-farm' ? 'new-farm' : 'default'
  const viewer = useMemo(() => ({ role, scenario }), [role, scenario])
  const [filters, setFilters] = useState<DashboardFilters>({ period: '30' })
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const filtersApplied = Boolean(filters.pen || filters.herdGroup || filters.lifeStage)
  const overviewFilters = useMemo<DashboardFilters>(() => ({
    period: filters.period,
    ...(filters.from ? { from: filters.from } : {}),
    ...(filters.to ? { to: filters.to } : {}),
  }), [filters.period, filters.from, filters.to])
  const overviewDash = useQuery(() => farmOverviewApi.getDashboard(overviewFilters, viewer), [overviewFilters, viewer])
  const filteredDash = useQuery<DashboardView | null>(
    () => filtersApplied ? farmOverviewApi.getDashboard(filters, viewer) : Promise.resolve(null),
    [filters, viewer, filtersApplied],
  )
  const started = useQuery(() => farmOverviewApi.getGettingStarted(viewer), [viewer])
  const reminders = useQuery(() => farmOverviewApi.listReminders(role), [role])

  const act = async (run: () => Promise<unknown>) => {
    setBusy(true)
    setActionError('')
    try { await run(); started.refetch() } catch (e) { setActionError(userFacingError(e, 'Không lưu được. Vui lòng thử lại.')) } finally { setBusy(false) }
  }

  if (overviewDash.loading && !overviewDash.data) return <Layout title={TITLE}><LoadingBlock /></Layout>
  if (overviewDash.error || !overviewDash.data) return <Layout title={TITLE}><ErrorBlock message={userFacingError(overviewDash.error, 'Không tính được số liệu.')} onRetry={overviewDash.refetch} /></Layout>

  const overview = overviewDash.data
  const detailView = filtersApplied ? filteredDash.data : overview
  const guide = started.data?.visible ? started.data : null
  const periodLabel = filters.period === 'custom' ? `${formatKey(filters.from ?? '')}–${formatKey(filters.to ?? '')}` : `${filters.period} ngày`
  const activeFilters = [
    periodLabel,
    filters.pen ? `Chuồng ${filters.pen}` : '',
    filters.herdGroup ? `Nhóm đàn ${HERD_GROUP_LABEL[filters.herdGroup]}` : '',
    filters.lifeStage ? `Giai đoạn ${LIFE_STAGE_LABEL[filters.lifeStage]}` : '',
  ].filter(Boolean).join(' · ')
  const serviceTone = overview.serviceStatus === 'Đang hoạt động' ? 'ok' : overview.serviceStatus === 'Chờ thanh toán' ? 'warn' : 'err'

  return (
    <Layout title={TITLE}>
      <div className="flex flex-col gap-4">
        <PageHeader
          title={overview.farmName}
          sub={<>{overview.activeCattle} con đang nuôi · Dịch vụ: <Badge tone={serviceTone}>{`${overview.serviceStatus}${overview.serviceUntil ? ` · đến ${formatKey(overview.serviceUntil)}` : ''}`}</Badge></>}
        >
          <Button className="min-h-12 text-base" onClick={() => navigate('/bao-cao')}>Báo cáo quản lý <Icon name="chevron-right" size={16} /></Button>
        </PageHeader>
        <DashboardTodoCard
          list={reminders.data ?? undefined}
          loading={reminders.loading}
          error={reminders.error}
          onRetry={reminders.refetch}
          attention={overview.attention}
          attentionUnavailable={overview.attentionUnavailable}
        />
        {actionError && <p role="alert" className="m-0 text-base text-err-fg">{actionError}</p>}
        <QuickRecordCard />
        {guide && <GettingStartedCard data={guide} busy={busy} onMark={(step) => act(() => farmOverviewApi.markStepDone(step, viewer))} onDismiss={() => act(() => farmOverviewApi.dismissGettingStarted(viewer))} />}
        <HerdStructureCard data={overview.indicators.m05} />
        <details className="rounded-md border border-edge bg-white">
          <summary className="flex min-h-14 cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-3 text-base font-bold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
            <span>Xem bộ lọc và thống kê chi tiết</span>
            <span className="text-base font-normal text-muted">{activeFilters}</span>
          </summary>
          <div className="flex flex-col gap-4 border-t border-edge p-4">
            <p className="m-0 text-base text-muted">Bộ lọc và kỳ áp dụng cho các chỉ số chi tiết; việc cần làm và cơ cấu đàn phía trên luôn hiển thị theo toàn trại.</p>
            <DashboardFilterBar filters={filters} pens={overview.pens} onChange={setFilters} />
            {filtersApplied && filteredDash.loading
              ? <p role="status" className="m-0 rounded border border-edge bg-page p-3 text-base text-muted">Đang cập nhật chỉ số theo bộ lọc…</p>
              : filtersApplied && (filteredDash.error || !detailView)
                ? <ErrorBlock message={userFacingError(filteredDash.error, 'Không tính được chỉ số theo bộ lọc.')} onRetry={filteredDash.refetch} />
                : detailView && <>
                  <PrimaryMetrics view={detailView} filtersApplied={filtersApplied} />
                  <SecondaryMetrics view={detailView} periodLabel={periodLabel} filtersApplied={filtersApplied} />
                </>}
          </div>
        </details>
        <Foot>
          {`${guide ? 'Các bước Bắt đầu sử dụng được lưu theo trạng thái của trại. ' : ''}Số liệu tính lúc ${formatDateTime(overview.generatedAt, overview.timeZone)} theo múi giờ của trại. Kỳ áp dụng cho mức tăng cân bình quân; các chỉ số còn lại tính đến thời điểm hiện tại.`}
        </Foot>
      </div>
    </Layout>
  )
}
