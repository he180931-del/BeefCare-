import { EmptyBlock, ErrorBlock, LoadingBlock } from '../../../components/ui'
import { userFacingError } from '../../../api/userFacingError'
import { useQuery } from '../../../hooks/useApi'
import { healthApi } from '../api/healthApi'
import { fmtDate, fmtDateTime } from '../domain/healthFormat'
import { CaseStatusBadge, EntryBadge, shortDetails } from './healthUi'

const Meta = ({ label, value }: { label: string; value: string }) => (
  <div className="flex min-w-0 flex-col gap-0.5"><span className="text-[11px] text-faint">{label}</span><span className="text-[13px] font-medium text-ink">{value}</span></div>
)

/** Bản điện thoại chỉ xem: không có nút ghi, hộp thoại hay khung trang; hồ sơ bò của Kỹ thuật viên cung cấp phần khung. */
export default function HealthTechnicianTab({ cattleCode }: { cattleCode: string }) {
  const { data, loading, error, refetch } = useQuery(() => healthApi.getProfile(cattleCode), [cattleCode])
  if (loading && !data) return <LoadingBlock />
  if (error || !data) return <ErrorBlock message={userFacingError(error, 'Không tải được dữ liệu sức khỏe.')} onRetry={refetch} />
  if (data.activeCases.length === 0) return <EmptyBlock title="Chưa có ca sức khỏe đang mở" sub="Bò không có ca đang mở hoặc theo dõi mạn tính." />

  return (
    <div className="flex flex-col gap-3">
      {data.activeCases.map((c) => (
        <section key={c.id} className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 rounded-lg border border-edge bg-white p-3.5">
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
            <div key={r.id} className="flex flex-col gap-1.5 rounded-lg border border-edge bg-white p-3.5">
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
