import { Badge, ErrorBlock, Info, LoadingBlock } from '../../../components/ui'
import { userFacingError } from '../../../api/userFacingError'
import { useQuery } from '../../../hooks/useApi'
import { growthApi } from '../api/growthApi'
import { fmtDate, fmtDateTime, fmtDec, fmtKg } from '../domain/growthFormat'
import { BASIS_LABEL, METHOD_LABEL } from '../domain/growthLabels'
import GrowthChart from './GrowthChart'

const cardCls = 'flex flex-col gap-2 rounded-lg border border-edge bg-white p-3'
const heading = 'm-0 text-[10px] font-semibold uppercase tracking-wide text-brand'

/** Bản đọc cho điện thoại, hiển thị trong hồ sơ bò của kỹ thuật viên (không có khung riêng). */
export default function GrowthTechnicianTab({ cattleCode }: { cattleCode: string }) {
  const { data, loading, error, refetch } = useQuery(() => growthApi.getProfile(cattleCode), [cattleCode])
  if (loading && !data) return <LoadingBlock />
  if (error || !data) return <ErrorBlock message={userFacingError(error, 'Không tải được dữ liệu tăng trưởng.')} onRetry={refetch} />
  const { latest, adg90, latestBcs, nextWeighingDate } = data
  const history = data.records.filter((r) => r.status === 'VALID').slice(0, 5)
  return (
    <div className="flex flex-col gap-3">
      <div className={cardCls}>
        <Info
          cols={2}
          items={[
            ['Cân gần nhất', latest ? `${fmtKg(latest.kg)} kg · ${BASIS_LABEL[latest.basis]}` : '—'],
            ['ADG 90 ngày', adg90 === undefined ? '—' : `${fmtDec(adg90, 2)} kg/ngày`],
            ['BCS gần nhất', latestBcs === undefined ? '—' : `${fmtDec(latestBcs)} / 5`],
            ['Lần cân tới', nextWeighingDate ? fmtDate(nextWeighingDate) : '—'],
          ]}
        />
      </div>
      <div className={cardCls}>
        <h3 className="m-0 text-[13px] font-semibold">Cân nặng 3 tháng</h3>
        <GrowthChart points={data.chart} height={150} />
        <p className="m-0 text-[10px] text-muted">● cân thực tế   ○ ước tính</p>
      </div>
      <h3 className={heading}>Lịch sử đo</h3>
      {history.length === 0 && <p className="m-0 text-xs text-muted">Chưa có lần đo nào.</p>}
      {history.map((r) => (
        <div key={r.id} className={cardCls}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-muted">{fmtDateTime(r.measuredAt)}</span>
            {r.basis && <Badge tone={r.basis === 'MEASURED' ? 'ok' : 'outline'}>{r.basis === 'MEASURED' ? 'Cân thực tế' : 'Ước tính'}</Badge>}
          </div>
          <div className="text-[13px] font-semibold">
            {[r.weightKg !== undefined && `${fmtKg(r.weightKg)} kg`, r.bcs !== undefined && `BCS ${fmtDec(r.bcs)}`, r.method && METHOD_LABEL[r.method].toLowerCase()].filter(Boolean).join(' · ')}
          </div>
          <div className="text-[10px] text-muted">Ghi bởi {r.measuredByName}</div>
        </div>
      ))}
    </div>
  )
}
