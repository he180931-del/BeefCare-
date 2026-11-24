import { addCalendarDays, businessDate } from '../../../shared/lib/date/farmTime'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { userFacingError } from '../../../shared/api/userFacingError'
import Layout from '../../../app/layouts/FarmPlatformLayout'
import { Badge, Button, DateInput, ErrorBlock, Field, Foot, Icon, LoadingBlock, PageHeader, Panel, Select } from '../../../shared/ui'
import { useSession } from '../../../app/session/sessionContext'
import { useManagementReportUseCases } from '../hooks/useFarmOverviewUseCases'
import ReportResult from '../components/ReportResult'
import { HERD_GROUP_LABEL, HERD_GROUP_ORDER, LIFE_STAGES, LIFE_STAGE_LABEL } from '../domain/dashboardRules'
import { REPORT_CATALOGUE } from '../domain/reportRules'
import { validateReportRequest } from '../validation/reportValidation'
import { viewerRole } from '../domain/viewer'
import type { HerdGroup, LifeStage, ReportCode, ReportFilterKey, ReportRequest } from '../types'
import '../styles/managementReportPrint.css'

const TITLE = 'Báo cáo quản lý'

function recentReportPeriod() {
  const to = businessDate()
  return { dateFrom: addCalendarDays(to, -29), dateTo: to }
}

function filterSummary(request: ReportRequest, filters: ReportFilterKey[]) {
  return [
    filters.includes('pen') && request.pen ? `Chuồng ${request.pen}` : '',
    filters.includes('breed') && request.breed ? `Giống ${request.breed}` : '',
    filters.includes('group') && request.herdGroup ? HERD_GROUP_LABEL[request.herdGroup] : '',
    filters.includes('stage') && request.lifeStage ? LIFE_STAGE_LABEL[request.lifeStage] : '',
  ].filter(Boolean)
}

const FILTER_LABEL: Record<ReportFilterKey, string> = { pen: 'chuồng', breed: 'giống', group: 'nhóm đàn', stage: 'giai đoạn' }

export default function ManagementReportPage() {
  const session = useSession()
  const role = viewerRole(session?.role)
  const [params] = useSearchParams()
  const first = REPORT_CATALOGUE.find((c) => c.code === params.get('loai'))?.code ?? 'RPT-05'
  const [draft, setDraft] = useState<ReportRequest>(() => ({ reportType: first, ...recentReportPeriod(), pen: '', breed: '', herdGroup: '', lifeStage: '' }))
  const [applied, setApplied] = useState<ReportRequest>(draft)
  const [periodError, setPeriodError] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const { pens, breeds, report } = useManagementReportUseCases(applied, role)

  const entry = REPORT_CATALOGUE.find((c) => c.code === draft.reportType)!
  const appliedEntry = REPORT_CATALOGUE.find((c) => c.code === applied.reportType)!
  const shows = (key: ReportFilterKey) => entry.filters.includes(key)
  const set = (patch: Partial<ReportRequest>) => setDraft((d) => ({ ...d, ...patch }))
  const changeReportType = (reportType: ReportCode) => {
    const next = REPORT_CATALOGUE.find((item) => item.code === reportType)!
    setDraft((current) => ({
      ...current,
      reportType,
      pen: next.filters.includes('pen') ? current.pen : '',
      breed: next.filters.includes('breed') ? current.breed : '',
      herdGroup: next.filters.includes('group') ? current.herdGroup : '',
      lifeStage: next.filters.includes('stage') ? current.lifeStage : '',
    }))
  }
  const submit = () => {
    const error = validateReportRequest(draft)
    setPeriodError(error ?? '')
    if (!error) setApplied({ ...draft })
  }
  const printReport = () => {
    if (!report.data || report.error) return
    window.print()
  }

  return (
    <Layout title={TITLE}>
      <div className="@container flex min-w-0 flex-col gap-4">
        <div className="management-report-screen">
          <PageHeader title="Báo cáo quản lý" sub="Chọn loại báo cáo, kỳ và bộ lọc để xem kết quả theo chuồng.">
            <Button className="report-print-action" disabled={!report.data || Boolean(report.error)} onClick={printReport}><Icon name="printer" size={16} /> In / xuất</Button>
          </PageHeader>

          <Panel title="Tiêu chí báo cáo" sub="Chỉ các tiêu chí dưới đây được gửi khi bạn bấm Xem báo cáo.">
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 @min-[760px]:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_auto] @min-[1024px]:items-end">
              <Field label="Loại báo cáo *" id="rpt-type">
                <Select id="rpt-type" value={draft.reportType} onChange={(e) => changeReportType(e.target.value as ReportCode)}>
                  {REPORT_CATALOGUE.map((item) => <option key={item.code} value={item.code}>{item.title}</option>)}
                </Select>
              </Field>
              <Field label="Kỳ báo cáo · từ – đến *" hint={periodError ? <span role="alert" className="text-err-fg">{periodError}</span> : undefined}>
                <div className="flex items-center gap-2">
                  <DateInput id="rpt-from" label="Từ ngày" value={draft.dateFrom} onChange={(v) => set({ dateFrom: v })} className="min-w-0 flex-1" />
                  <span className="text-muted">–</span>
                  <DateInput id="rpt-to" label="Đến ngày" value={draft.dateTo} onChange={(v) => set({ dateTo: v })} className="min-w-0 flex-1" />
                </div>
              </Field>
              <Button variant="primary" className="min-h-11" onClick={submit}>Xem báo cáo</Button>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-field pt-3">
              <Button variant="link" size="sm" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((open) => !open)}>{filtersOpen ? 'Ẩn bộ lọc thêm' : 'Bộ lọc thêm'}</Button>
              <span className="text-xs text-muted">Báo cáo này hỗ trợ: {entry.filters.length ? entry.filters.map((key) => FILTER_LABEL[key]).join(', ') : 'không có bộ lọc thêm'}.</span>
            </div>

            {filtersOpen && <div className="grid gap-3 rounded-xl border border-field bg-page p-3 @min-[640px]:grid-cols-2 @min-[1024px]:grid-cols-4">
              {shows('pen') && <Field label="Chuồng" id="rpt-pen">
                <Select id="rpt-pen" value={draft.pen} disabled={pens.loading} onChange={(e) => set({ pen: e.target.value })}>
                  <option value="">Tất cả</option>
                  {pens.loading && <option disabled>Đang tải…</option>}
                  {(pens.data ?? []).map((p) => <option key={p.code} value={p.code}>{p.code}</option>)}
                </Select>
              </Field>}
              {shows('breed') && <Field label="Giống" id="rpt-breed">
                <Select id="rpt-breed" value={draft.breed} disabled={breeds.loading} onChange={(e) => set({ breed: e.target.value })}>
                  <option value="">Tất cả</option>
                  {breeds.loading && <option disabled>Đang tải…</option>}
                  {(breeds.data ?? []).map((b) => <option key={b.code} value={b.name}>{b.name}</option>)}
                </Select>
              </Field>}
              {shows('group') && <Field label="Nhóm đàn" id="rpt-group">
                <Select id="rpt-group" value={draft.herdGroup} onChange={(e) => set({ herdGroup: e.target.value as HerdGroup | '' })}>
                  <option value="">Tất cả</option>
                  {HERD_GROUP_ORDER.map((g) => <option key={g} value={g}>{HERD_GROUP_LABEL[g]}</option>)}
                </Select>
              </Field>}
              {shows('stage') && <Field label="Giai đoạn" id="rpt-stage">
                <Select id="rpt-stage" value={draft.lifeStage} onChange={(e) => set({ lifeStage: e.target.value as LifeStage | '' })}>
                  <option value="">Tất cả</option>
                  {LIFE_STAGES.map((s) => <option key={s} value={s}>{LIFE_STAGE_LABEL[s]}</option>)}
                </Select>
              </Field>}
            </div>}

            {(shows('pen') && Boolean(pens.error)) && <p role="alert" className="m-0 text-xs text-err-fg">{userFacingError(pens.error, 'Không tải được danh sách chuồng.')} <Button variant="link" size="sm" onClick={() => void pens.refetch()}>Tải lại</Button></p>}
            {(shows('breed') && Boolean(breeds.error)) && <p role="alert" className="m-0 text-xs text-err-fg">{userFacingError(breeds.error, 'Không tải được danh sách giống.')} <Button variant="link" size="sm" onClick={() => void breeds.refetch()}>Tải lại</Button></p>}

            <div className="flex flex-wrap items-center gap-2 border-t border-field pt-3 text-xs" aria-live="polite">
              <span className="font-semibold text-ink">Đang áp dụng:</span>
              <Badge>{appliedEntry.title}</Badge>
              <span>{applied.dateFrom} – {applied.dateTo}</span>
              {filterSummary(applied, appliedEntry.filters).map((filter) => <Badge key={filter}>{filter}</Badge>)}
              {filterSummary(applied, appliedEntry.filters).length === 0 && <span className="text-muted">Toàn bộ phạm vi phù hợp</span>}
              {JSON.stringify(draft) !== JSON.stringify(applied) && <span className="text-warn-fg">Tiêu chí đang soạn chưa áp dụng.</span>}
            </div>
          </div>
          </Panel>

          {report.loading && !report.data && <LoadingBlock />}
          {Boolean(report.error) && <ErrorBlock message={userFacingError(report.error, 'Không tính được số liệu.')} onRetry={report.refetch} />}
          <Foot>Bảy loại báo cáo; kỳ tối đa 24 tháng theo múi giờ trại. Bộ lọc chỉ gửi khi có nghĩa với loại báo cáo đã chọn.</Foot>
        </div>
        {report.data && !report.error && <ReportResult report={report.data} farmName={session?.farmName} appliedFilters={filterSummary(applied, appliedEntry.filters)} />}
      </div>
    </Layout>
  )
}
