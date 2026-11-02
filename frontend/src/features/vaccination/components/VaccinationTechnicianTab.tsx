import { Badge, ErrorBlock, LoadingBlock } from '../../../components/ui'
import { userFacingError } from '../../../api/userFacingError'
import { useQuery } from '../../../hooks/useApi'
import { vaccinationApi } from '../api/vaccinationApi'
import { fmtDate, fmtDateTime, fmtMonthYear } from '../domain/vaccinationFormat'
import { DoseStatusBadge } from './vaccinationParts'

const cardCls = 'flex flex-col gap-2 rounded-lg border border-edge bg-white p-3'
const heading = 'm-0 text-[10px] font-semibold uppercase tracking-wide text-brand'

/** Bản đọc cho điện thoại, hiển thị trong hồ sơ bò của kỹ thuật viên (không có khung riêng). */
export default function VaccinationTechnicianTab({ cattleCode }: { cattleCode: string }) {
  const { data, loading, error, refetch } = useQuery(() => vaccinationApi.getCattleVaccination(cattleCode), [cattleCode])
  if (loading && !data) return <LoadingBlock />
  if (error || !data) return <ErrorBlock message={userFacingError(error, 'Không tải được dữ liệu tiêm phòng.')} onRetry={refetch} />
  const records = data.records.filter((r) => r.status === 'VALID')
  return (
    <div className="flex flex-col gap-3">
      <h3 className={heading}>Mũi tiêm theo lịch</h3>
      {data.doses.length === 0 && <p className="m-0 text-xs text-muted">Không còn mũi nào cần tiêm.</p>}
      {data.doses.map((d) => (
        <div key={d.id} className={cardCls}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-muted">Hạn {fmtDate(d.effectiveDate)}</span>
            <DoseStatusBadge row={d} />
          </div>
          <div className="text-[13px] font-semibold">{d.kind === 'BOOSTER' ? `${d.scheduleShort} · nhắc lại` : `${d.scheduleName} · ${d.doseText}`}</div>
        </div>
      ))}
      <h3 className={heading}>Lịch sử tiêm</h3>
      {records.length === 0 && <p className="m-0 text-xs text-muted">Chưa có mũi tiêm nào.</p>}
      {records.map((r) => (
        <div key={r.id} className={cardCls}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-muted">{r.precision === 'MONTH' ? fmtMonthYear(r.administeredAt) : fmtDateTime(r.administeredAt)}</span>
            <Badge tone={r.source === 'ON_FARM' ? 'ok' : 'outline'}>{r.source === 'ON_FARM' ? 'Tại trại' : 'Nhập lịch sử'}</Badge>
          </div>
          <div className="text-[13px] font-semibold">{[r.vaccineLabel, r.doseText, r.batchNo ? `lô ${r.batchNo}` : 'lô không rõ', r.dose].filter(Boolean).join(' · ')}</div>
          {r.vaccinator && <div className="text-[10px] text-muted">Tiêm bởi {r.vaccinator}</div>}
        </div>
      ))}
    </div>
  )
}
