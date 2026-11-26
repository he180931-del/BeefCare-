import { useSearchParams } from 'react-router-dom'
import { Badge, ErrorBlock, LoadingBlock, Note } from '../../../shared/ui'
import { userFacingError } from '../../../shared/api/userFacingError'
import { fmtDate, fmtDateTime, fmtDec, fmtKg } from '../domain/growthFormat'
import { BASIS_LABEL, METHOD_LABEL } from '../domain/growthLabels'
import { adgBasis, validWeights } from '../domain/growthRules'
import { useGrowthProfile } from '../hooks/useGrowthUseCase'
import GrowthChart from './GrowthChart'

const cardCls = 'flex flex-col gap-2 rounded-2xl border border-field bg-white p-4'
const heading = 'm-0 text-[10px] font-semibold uppercase tracking-wide text-brand'

/** Bản đọc cho điện thoại, hiển thị trong hồ sơ bò của kỹ thuật viên (không có khung riêng). */
export default function GrowthTechnicianTab({ cattleCode }: { cattleCode: string }) {
  const [params] = useSearchParams()
  const { data, loading, error, refetch } = useGrowthProfile(cattleCode)
  if (loading && !data) return <LoadingBlock />
  if (error || !data) return <ErrorBlock message={userFacingError(error, 'Không tải được dữ liệu tăng trưởng.')} onRetry={refetch} />
  const { latest, adg90, latestBcs, nextWeighingDate } = data
  const sourceId = params.get('r')
  const adg90Days = adgBasis(validWeights(data.records), 90, data.today)?.days
  const valid = data.records.filter((r) => r.status === 'VALID')
  const history = sourceId == null ? valid.slice(0, 5) : valid.filter((r) => String(r.id) === sourceId)
  if (sourceId != null && history.length === 0) return <Note tone="warn">Không tìm thấy bản ghi tăng trưởng này.</Note>
  return (
    <div className="flex flex-col gap-3">
      {sourceId == null && <>
      {/* Bento (Figma Tab 17 ④b): tóm tắt tăng trưởng là khối nổi bật xanh đậm của tab trên điện thoại. */}
      <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl border border-brand-dark bg-brand-dark p-4">
        {([
          ['Cân gần nhất', latest ? `${fmtKg(latest.kg)} kg · ${BASIS_LABEL[latest.basis]}` : '—'],
          ['ADG', adg90 === undefined ? '—' : `${fmtDec(adg90, 2)} kg/ngày${adg90Days === undefined ? '' : ` · ${adg90Days} ngày`}`],
          ['BCS gần nhất', latestBcs === undefined ? '—' : `${fmtDec(latestBcs)} / 5`],
          ['Lần cân tới', nextWeighingDate ? fmtDate(nextWeighingDate) : '—'],
        ] as const).map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="mb-[3px] text-[11px] text-side-text">{label}</dt>
            <dd className="m-0 text-[13px] font-semibold text-white">{value}</dd>
          </div>
        ))}
      </dl>
      <div className={cardCls}>
        <h3 className="m-0 text-[13px] font-semibold">Cân nặng 3 tháng</h3>
        <GrowthChart points={data.chart} height={150} />
        <p className="m-0 text-[10px] text-muted">● cân thực tế   ○ ước tính</p>
      </div>
      </>}
      <h3 className={heading}>{sourceId == null ? 'Lịch sử đo' : 'Bản ghi tăng trưởng'}</h3>
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
