import { useSearchParams } from 'react-router-dom'
import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../../shared/ui'
import { userFacingError } from '../../../shared/api/userFacingError'
import { fmtDate, fmtDateTime } from '../domain/healthFormat'
import { useHealthProfile } from '../hooks/useHealthProfile'
import { CaseStatusBadge, EntryBadge, shortDetails } from './healthUi'
import HealthTimelineSource from './HealthTimelineSource'

const Meta = ({ label, value }: { label: string; value: string }) => (
  <div className="flex min-w-0 flex-col gap-0.5"><span className="text-[11px] text-[#5b6a60]">{label}</span><span className="text-[13px] font-medium text-ink">{value}</span></div>
)

/** Bản điện thoại chỉ xem: không có nút ghi, hộp thoại hay khung trang; hồ sơ bò của Kỹ thuật viên cung cấp phần khung. */
export default function HealthTechnicianTab({ cattleCode }: { cattleCode: string }) {
  const [params] = useSearchParams()
  const sourceId = params.get('r')
  const caseId = sourceId == null ? null : params.get('case')
  const { data, loading, error, refetch } = useHealthProfile(cattleCode, caseId)
  if (loading && !data) return <LoadingBlock />
  if (error || !data) return <ErrorBlock message={userFacingError(error, 'Không tải được dữ liệu sức khỏe.')} onRetry={refetch} />
  if (sourceId != null) return loading ? <LoadingBlock /> : <HealthTimelineSource profile={data} sourceId={sourceId} type={params.get('type')} caseId={caseId} technician />
  if (data.activeCases.length === 0) return <EmptyBlock title="Chưa có ca sức khỏe đang mở" sub="Bò không có ca đang mở hoặc theo dõi mạn tính." />

  return (
    <div className="flex flex-col gap-3">
      {data.activeCases.map((c) => (
        <section key={c.id} className="flex flex-col gap-3">
          {/* Bento (Figma Tab 17 ④b): ca đang mở là khối đỏ nhạt; ca mạn tính vàng nhạt. */}
          <div className={`flex flex-col gap-3 rounded-2xl border p-4 ${c.status === 'CHRONIC' ? 'border-warn-bg bg-warn-bg' : 'border-err-bg bg-err-bg'}`}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="m-0 text-sm font-semibold text-ink">Ca {c.caseCode} · {c.diagnosis || c.signs}</h3>
              <CaseStatusBadge status={c.status} day={c.day} chronicSince={c.chronicSince} />
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              <Meta label="Mức độ" value={{ MILD: 'Nhẹ', MODERATE: 'Trung bình', SEVERE: 'Nặng' }[c.severity]} />
              <Meta label="Mở lúc" value={fmtDate(c.openedDate)} />
              <Meta label="Số lần điều trị" value={String(c.treatmentCount)} />
              <Meta label="Ngưng thịt đến" value={fmtDate(c.withdrawalEndDate)} />
            </div>
          </div>
          <h4 className="m-0 text-[10px] font-semibold uppercase tracking-wide text-brand">Diễn biến &amp; điều trị</h4>
          {data.timeline.filter((r) => r.caseId === c.id && r.status === 'VALID').map((r) => (
            <div key={r.id} className="flex flex-col gap-1.5 rounded-2xl border border-field bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-muted">{fmtDateTime(r.occurredAt)}</span>
                <EntryBadge row={r} />
              </div>
              <p className="m-0 text-[13px] font-semibold text-ink">{shortDetails(r)}</p>
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
