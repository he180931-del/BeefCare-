import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { userFacingError } from '../../../shared/api/userFacingError'
import Layout from '../../../app/layouts/FarmPlatformLayout'
import { Badge, Button, ErrorBlock, Foot, Icon, LoadingBlock, PageHeader } from '../../../shared/ui'
import { useDemoState } from '../../../demo/demoModules'
import { useSession } from '../../../app/session/sessionContext'
import { useFarmDashboardUseCases } from '../hooks/useFarmOverviewUseCases'
import DashboardFilterBar from '../components/DashboardFilterBar'
import { AttentionCard, GettingStartedCard, HerdStructureCard, QuickRecordCard } from '../components/DashboardCards'
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
  const { overview: overviewDash, filtered: filteredDash, gettingStarted: started, filtersApplied, markStepDone, dismissGettingStarted } = useFarmDashboardUseCases(filters, viewer)

  const act = async (run: () => Promise<unknown>) => {
    setBusy(true)
    setActionError('')
    try { await run(); started.refetch() } catch (e) { setActionError(userFacingError(e, 'Không lưu được. Vui lòng thử lại.')) } finally { setBusy(false) }
  }

  if (overviewDash.loading && !overviewDash.data) return <Layout title={TITLE}><LoadingBlock /></Layout>
  if (overviewDash.error || !overviewDash.data) return <Layout title={TITLE}><ErrorBlock message={userFacingError(overviewDash.error, 'Không tính được số liệu.')} onRetry={overviewDash.refetch} /></Layout>

  const overview = overviewDash.data
  const metricsQuery = filtersApplied ? filteredDash : overviewDash
  // useQuery bật loading trong effect: lần render đầu sau khi chọn bộ lọc, filteredDash vẫn giữ data = null của lần
  // "không lọc" nên phải coi là đang tải, nếu không khối lỗi (role="alert") nháy lên một nhịp.
  const metricsPending = metricsQuery.loading || (filtersApplied && !filteredDash.data && !filteredDash.error)
  const metrics = metricsPending ? null : metricsQuery.data
  const guide = started.data?.visible ? started.data : null
  const periodLabel = filters.period === 'custom' ? `${formatKey(filters.from ?? '')}–${formatKey(filters.to ?? '')}` : `${filters.period} ngày`
  const serviceTone = overview.serviceStatus === 'Đang hoạt động' ? 'ok' : overview.serviceStatus === 'Chờ thanh toán' ? 'warn' : 'err'

  return (
    <Layout title={TITLE}>
      <div className="@container">
        <div className="grid grid-cols-4 gap-4 @min-[640px]:grid-cols-8 @min-[1024px]:grid-cols-12 @min-[1024px]:gap-6 [&>*]:min-w-0">
          <div className="col-span-full">
            <PageHeader
              title={overview.farmName}
              sub={<>{overview.activeCattle} con đang nuôi · Dịch vụ: <Badge tone={serviceTone}>{`${overview.serviceStatus}${overview.serviceUntil ? ` · đến ${formatKey(overview.serviceUntil)}` : ''}`}</Badge></>}
            >
              <Button className="min-h-12 text-base" onClick={() => navigate('/bao-cao')}>Báo cáo quản lý <Icon name="chevron-right" size={16} /></Button>
            </PageHeader>
          </div>
          <section aria-label="Bộ lọc tổng quan" className="col-span-full flex flex-col gap-2 rounded-2xl border border-field bg-white p-4">
            <DashboardFilterBar filters={filters} pens={overview.pens} onChange={setFilters} />
            <p className="m-0 text-xs text-muted">Bộ lọc áp dụng cho các chỉ số tương thích. Cảnh báo và cơ cấu đàn hiển thị theo toàn trại.</p>
          </section>
          {guide && (
            <div className="col-span-full space-y-2">
              {actionError && <p role="alert" className="m-0 text-sm text-err-fg">{actionError}</p>}
      <GettingStartedCard data={guide} busy={busy} onMark={(step) => act(() => markStepDone(step))} onDismiss={() => act(dismissGettingStarted)} />
            </div>
          )}
          {metrics ? (
            <section aria-label="Chỉ số chính" className="col-span-full">
              <PrimaryMetrics view={metrics} filtersApplied={filtersApplied} />
            </section>
          ) : (
            <div className="col-span-full">
              {metricsPending
                ? <p role="status" className="m-0 rounded-lg border border-field bg-white p-3 text-sm text-muted">Đang cập nhật chỉ số theo bộ lọc…</p>
                : <ErrorBlock message={userFacingError(metricsQuery.error, 'Không tính được chỉ số theo bộ lọc.')} onRetry={metricsQuery.refetch} />}
            </div>
          )}
          <div className="col-span-full">
            <QuickRecordCard />
          </div>
          {/* Laptop 1.280 px (vùng nội dung ~950 px, lưới 8 cột) đã chia 5+3; từ 1.024 px vùng nội dung chia 8+4 như Figma Tab 15. */}
          <div className="col-span-full @min-[880px]:col-span-5 @min-[1024px]:col-span-8">
            <AttentionCard rows={overview.attention} />
          </div>
          <div className="col-span-full @min-[880px]:col-span-3 @min-[1024px]:col-span-4">
            <HerdStructureCard data={overview.indicators.m05} />
          </div>
          {metrics && (
            <section aria-label="Chỉ số bổ sung" className="col-span-full">
              <SecondaryMetrics view={metrics} periodLabel={periodLabel} filtersApplied={filtersApplied} />
            </section>
          )}
          <div className="col-span-full">
            <Foot>
              {`Số liệu tính lúc ${formatDateTime((metrics ?? overview).generatedAt, overview.timeZone)} theo múi giờ của trại. Kỳ áp dụng cho mức tăng cân bình quân; các chỉ số còn lại tính đến thời điểm hiện tại.`}
            </Foot>
          </div>
        </div>
      </div>
    </Layout>
  )
}
