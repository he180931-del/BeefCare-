import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { userFacingError } from '../../../api/userFacingError'
import Layout from '../../../components/Layout'
import { Icon } from '../../../components/Icon'
import { Button, Card, DateInput, ErrorBlock, Field, Foot, LoadingBlock, PageHeader, Segmented, Select } from '../../../components/ui'
import { useQuery } from '../../../hooks/useApi'
import { useSession } from '../../authorization'
import { farmOverviewApi } from '../api/farmOverviewApi'
import ReportResult from '../components/ReportResult'
import { HERD_GROUP_LABEL, HERD_GROUP_ORDER, LIFE_STAGES, LIFE_STAGE_LABEL } from '../domain/dashboardRules'
import { REPORT_CATALOGUE, validateReportRequest } from '../domain/reportRules'
import { viewerRole } from '../domain/viewer'
import type { HerdGroup, LifeStage, ReportCode, ReportFilterKey, ReportRequest } from '../types'

const TITLE = 'Báo cáo quản lý'
const BREEDS = ['Zebu đỏ', 'Lai Sind']

export default function ManagementReportPage() {
  const role = viewerRole(useSession()?.role)
  const [params] = useSearchParams()
  const first = REPORT_CATALOGUE.find((c) => c.code === params.get('loai'))?.code ?? 'RPT-05'
  const [draft, setDraft] = useState<ReportRequest>({ reportType: first, dateFrom: '2026-07-01', dateTo: '2026-09-30', pen: '', breed: '', herdGroup: '', lifeStage: '' })
  const [applied, setApplied] = useState<ReportRequest>(draft)
  const [periodError, setPeriodError] = useState('')
  const pens = useQuery(() => farmOverviewApi.listPenOptions(), [])
  const report = useQuery(() => farmOverviewApi.runReport(applied, role), [applied, role])

  const entry = REPORT_CATALOGUE.find((c) => c.code === draft.reportType)!
  const shows = (key: ReportFilterKey) => entry.filters.includes(key)
  const set = (patch: Partial<ReportRequest>) => setDraft((d) => ({ ...d, ...patch }))
  const submit = () => {
    const error = validateReportRequest(draft)
    setPeriodError(error ?? '')
    if (!error) setApplied({ ...draft })
  }

  return (
    <Layout title={TITLE}>
      <div className="flex flex-col gap-4">
        <PageHeader title="Báo cáo quản lý" sub="Chọn loại báo cáo, kỳ và bộ lọc để xem kết quả theo chuồng.">
          <Button onClick={() => window.print()}><Icon name="printer" size={16} /> In / xuất</Button>
        </PageHeader>

        <Card title="Tiêu chí báo cáo">
          <div className="flex flex-col gap-4">
            <Field label="Loại báo cáo *">
              <div className="overflow-x-auto">
                <Segmented value={draft.reportType} onChange={(v) => set({ reportType: v as ReportCode })} options={REPORT_CATALOGUE.map((c) => ({ value: c.code, label: c.label }))} />
              </div>
            </Field>
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Kỳ báo cáo *" hint={periodError ? <span role="alert" className="text-err-fg">{periodError}</span> : undefined}>
                <div className="flex items-center gap-2">
                  <DateInput id="rpt-from" value={draft.dateFrom} onChange={(v) => set({ dateFrom: v })} className="w-[150px]" />
                  <span className="text-muted">–</span>
                  <DateInput id="rpt-to" value={draft.dateTo} onChange={(v) => set({ dateTo: v })} className="w-[150px]" />
                </div>
              </Field>
              {shows('pen') && (
                <Field label="Chuồng" id="rpt-pen">
                  <Select id="rpt-pen" value={draft.pen} onChange={(e) => set({ pen: e.target.value })}>
                    <option value="">Tất cả</option>
                    {(pens.data ?? []).map((p) => <option key={p.code} value={p.code}>{p.code}</option>)}
                  </Select>
                </Field>
              )}
              {shows('breed') && (
                <Field label="Giống" id="rpt-breed">
                  <Select id="rpt-breed" value={draft.breed} onChange={(e) => set({ breed: e.target.value })}>
                    <option value="">Tất cả</option>
                    {BREEDS.map((b) => <option key={b} value={b}>{b}</option>)}
                  </Select>
                </Field>
              )}
              {shows('group') && (
                <Field label="Nhóm đàn" id="rpt-group">
                  <Select id="rpt-group" value={draft.herdGroup} onChange={(e) => set({ herdGroup: e.target.value as HerdGroup | '' })}>
                    <option value="">Tất cả</option>
                    {HERD_GROUP_ORDER.map((g) => <option key={g} value={g}>{HERD_GROUP_LABEL[g]}</option>)}
                  </Select>
                </Field>
              )}
              {shows('stage') && (
                <Field label="Giai đoạn" id="rpt-stage">
                  <Select id="rpt-stage" value={draft.lifeStage} onChange={(e) => set({ lifeStage: e.target.value as LifeStage | '' })}>
                    <option value="">Tất cả</option>
                    {LIFE_STAGES.map((s) => <option key={s} value={s}>{LIFE_STAGE_LABEL[s]}</option>)}
                  </Select>
                </Field>
              )}
              <Button variant="primary" onClick={submit}>Xem báo cáo</Button>
            </div>
          </div>
        </Card>

        {report.loading && !report.data && <LoadingBlock />}
        {Boolean(report.error) && <ErrorBlock message={userFacingError(report.error, 'Không tính được số liệu.')} onRetry={report.refetch} />}
        {report.data && !report.error && <ReportResult report={report.data} />}
        <Foot>Loại báo cáo RPT-01 đến RPT-07; kỳ tối đa 24 tháng theo múi giờ trại. Bộ lọc chỉ hiện khi có nghĩa với loại báo cáo đã chọn.</Foot>
      </div>
    </Layout>
  )
}
