import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useModalParam } from '../../../shared/hooks/useModalParam'
import { Badge, Button, EmptyBlock, ErrorBlock, LoadingBlock, Metric, Note, Panel, Table, Td, Th, type MetricTone } from '../../../shared/ui'
import { userFacingError } from '../../../shared/api/userFacingError'
import { useCanRecordCare } from '../../authorization'
import { addDays, dayFloat, fmtDate, fmtDateTime, fmtDayMonth, fmtDec, fmtKg } from '../domain/growthFormat'
import { BASIS_LABEL, METHOD_LABEL } from '../domain/growthLabels'
import { adgBasis, adgBasisText, finishingProgress, validWeights, weightAtNextWeighing, type FinishingProgress } from '../domain/growthRules'
import { useGrowthProfile } from '../hooks/useGrowthUseCase'
import type { GrowthProfile, GrowthProjection, GrowthRecord } from '../types'
import GrowthChart, { ChartLegend } from './GrowthChart'
import GrowthCorrectModal from './GrowthCorrectModal'
import GrowthDeleteModal from './GrowthDeleteModal'
import GrowthRecordModal from './GrowthRecordModal'

const HISTORY_ROWS = 5

export default function GrowthProfileTab({ cattleCode }: { cattleCode: string }) {
  const canWrite = useCanRecordCare()
  const [modal, , closeModal] = useModalParam()
  const [params, setParams] = useSearchParams()
  const [notice, setNotice] = useState<string | null>(null)
  const { data, loading, error, refetch } = useGrowthProfile(cattleCode)

  if (loading && !data) return <LoadingBlock />
  if (error || !data) return <ErrorBlock message={userFacingError(error, 'Không tải được dữ liệu tăng trưởng.')} onRetry={refetch} />

  const closeAll = () => {
    const next = new URLSearchParams(params)
    next.delete('m')
    next.delete('r')
    setParams(next)
  }
  /** Mở popup Sửa ('correct') hoặc Xóa ('delete') cho một lần đo; giữ trên URL để mở lại được từ dòng thời gian. */
  const openRecordModal = (kind: 'correct' | 'delete', id: number) => {
    const next = new URLSearchParams(params)
    next.set('m', kind)
    next.set('r', String(id))
    setParams(next)
  }
  const saved = (message: string) => {
    if (params.get('from') === 'timeline') return setParams({ tab: 'timeline' })
    setNotice(message); closeAll(); refetch()
  }
  const recordId = params.get('r')
  const selectedRecord = recordId == null ? undefined : data.records.find((record) => String(record.id) === recordId)
  // With ?r= (e.g. opened from the timeline) only that record opens; never fall back to another one.
  // R-08-10 / MSG-COM-17: bò trên phiếu chết / mất PENDING không ghi mới nhưng vẫn sửa / loại trừ bản ghi cũ.
  const exitPending = data.cattle.status === 'ACTIVE' && data.cattle.exitPending === true
  const correctTarget = modal === 'correct'
    ? (params.get('r') ? data.records.find((r) => String(r.id) === params.get('r')) : data.records.find((r) => r.status === 'VALID'))
    : undefined
  const deleteTarget = modal === 'delete' ? data.records.find((r) => String(r.id) === params.get('r') && r.status === 'VALID') : undefined

  const { projection } = data
  return (
    <div className="@container">
      {/*
        Lưới Bento (docs/BeefCare-Bento-Grid.md §2, Figma Tab 17). Vùng nội dung từ 1.024 px: dự kiến 6 + tiến độ 3 + thẻ 3,
        biểu đồ 8 + thẻ 4. Từ 880 px (laptop 1.280 px có sidebar): dự kiến 5 + tiến độ 3 trên lưới 8 cột.
        Thứ tự DOM là thứ tự đọc trên điện thoại: trạng thái → việc tiếp theo → biểu đồ → chỉ số phụ → lịch sử.
      */}
      <div className="grid grid-cols-4 gap-4 @min-[640px]:grid-cols-8 @min-[1024px]:grid-cols-12 @min-[1024px]:gap-6">
        {notice && <div className="col-span-full"><Note tone="ok">{notice}</Note></div>}
        {exitPending && (
          <div className="col-span-full">
            <Note tone="warn">
              {`Chờ xác nhận chết / mất: ${data.cattle.code} không ghi được lần cân mới cho đến khi Chủ trại xác nhận hoặc bỏ qua phiếu xuất.`}
              {canWrite && ' Vẫn sửa hoặc xóa được các bản ghi cân đã có.'}
            </Note>
          </div>
        )}
        {projection ? <FinishingBlocks profile={data} projection={projection} /> : <WeighingSummary profile={data} />}
        <Panel
          title="Cân nặng theo thời gian"
         
          actions={<ChartLegend />}
          className={`col-span-full ${projection ? '@min-[1024px]:col-span-8' : ''}`}
        >
          <GrowthChart points={data.chart} />
        </Panel>
        {projection && (
          <section aria-label="Thể trạng và số lần đo" className="col-span-full grid min-w-0 grid-cols-2 content-start gap-4 @min-[1024px]:col-span-4 @min-[1024px]:grid-cols-1 @min-[1024px]:gap-6">
            <BcsMetric profile={data} />
            <CountMetric profile={data} />
          </section>
        )}
        {!modal && recordId != null && !selectedRecord && <div className="col-span-full"><Note tone="warn">Không tìm thấy bản ghi tăng trưởng này.</Note></div>}
        <History
          profile={data}
          selectedRecord={!modal ? selectedRecord : undefined}
          canWrite={canWrite}
          onCorrect={(id) => openRecordModal('correct', id)}
          onDelete={(id) => openRecordModal('delete', id)}
        />
      </div>
      {canWrite && !exitPending && modal === 'record' && <GrowthRecordModal cattleCode={cattleCode} onClose={closeModal} onSaved={saved} />}
      {canWrite && correctTarget && <GrowthCorrectModal key={correctTarget.id} record={correctTarget} onClose={closeAll} onSaved={saved} />}
      {canWrite && deleteTarget && <GrowthDeleteModal key={deleteTarget.id} record={deleteTarget} onClose={closeAll} onDeleted={saved} />}
    </div>
  )
}

const adgValue = (adg: number | undefined) => (adg === undefined ? '—' : `${fmtDec(adg, 2)} kg/ngày`)

/** Giải thích ADG theo các lần cân thật trong kỳ (không ghi cứng "60/90 ngày" khi dữ liệu ngắn hơn). */
const adgSub = (profile: GrowthProfile, adg: number | undefined, windowDays: number) =>
  adgBasisText(adg, adgBasis(validWeights(profile.records), windowDays, profile.today), windowDays)

/** Lần cân tới: đỏ khi đã quá ngày, vàng khi là việc sắp tới (docs/BeefCare-Bento-Grid.md §3); luôn kèm chữ. */
function nextWeighing(profile: GrowthProfile): { tone: MetricTone; status?: string } {
  const { nextWeighingDate, today } = profile
  if (!nextWeighingDate) return { tone: 'default' }
  const late = Math.round(dayFloat(today) - dayFloat(nextWeighingDate))
  return late > 0 ? { tone: 'err', status: `Quá hạn ${late} ngày` } : { tone: 'warn' }
}

const BcsMetric = ({ profile: { latestBcs } }: { profile: GrowthProfile }) => (
  <Metric surface="panel" compact label="BCS gần nhất" value={latestBcs === undefined ? '—' : `${fmtDec(latestBcs)} / 5`} sub={latestBcs === undefined ? 'Chưa có điểm thể trạng' : 'Điểm thể trạng'} />
)

const CountMetric = ({ profile: { count, correctedCount } }: { profile: GrowthProfile }) => (
  <Metric surface="panel" compact label="Số lần đo" value={`${count} lần`} sub={correctedCount ? `${correctedCount} bản ghi đã sửa` : 'Chưa có bản ghi sửa'} />
)

/** Bò không có dự kiến xuất bán (không Vỗ béo hoặc trại chưa đặt cân mục tiêu): một hàng 5 chỉ số trước biểu đồ. */
function WeighingSummary({ profile }: { profile: GrowthProfile }) {
  const { latest, adg90, nextWeighingDate } = profile
  const next = nextWeighing(profile)
  return (
    <section aria-label="Chỉ số tăng trưởng" className="col-span-full grid min-w-0 grid-cols-2 gap-4 @min-[640px]:grid-cols-3 @min-[880px]:grid-cols-5 @min-[1024px]:gap-6">
      <Metric surface="panel" compact label="Cân gần nhất" value={latest ? `${fmtKg(latest.kg)} kg` : '—'} sub={latest ? `${fmtDayMonth(latest.at)} · ${BASIS_LABEL[latest.basis]}` : 'Chưa có lần cân'} />
      <Metric surface="panel" compact label="Tăng cân bình quân (ADG)" value={adgValue(adg90)} sub={adgSub(profile, adg90, 90)} />
      <Metric surface="panel" tone={next.tone} compact label="Lần cân tới" value={nextWeighingDate ? fmtDate(nextWeighingDate) : '—'} sub={next.status ?? (nextWeighingDate ? 'Theo chu kỳ cân của trại' : 'Chưa có lịch cân')} />
      <BcsMetric profile={profile} />
      <CountMetric profile={profile} />
    </section>
  )
}

/** Bò Vỗ béo có cân mục tiêu: dự kiến xuất bán (khối nổi bật), tiến độ chặng vỗ béo, tăng cân và lần cân tới. */
function FinishingBlocks({ profile, projection }: { profile: GrowthProfile; projection: GrowthProjection }) {
  const progress = finishingProgress(profile.records, projection.targetKg)
  const { adg60 } = projection
  const next = nextWeighing(profile)
  const nextKg = progress && weightAtNextWeighing(progress.currentKg, progress.currentAt, profile.nextWeighingDate, adg60)
  return (
    <>
      <Projection projection={projection} adgDays={adgBasis(validWeights(profile.records), 60, profile.today)?.days} />
      <Progress progress={progress} />
      <section aria-label="Tăng cân và lần cân tới" className="col-span-full grid min-w-0 grid-cols-2 gap-4 @min-[640px]:col-span-4 @min-[640px]:grid-cols-1 @min-[880px]:col-span-full @min-[880px]:grid-cols-2 @min-[1024px]:col-span-3 @min-[1024px]:grid-cols-1 @min-[1024px]:gap-6">
        <Metric
          surface="panel"
          tone={adg60 !== undefined && adg60 > 0 ? 'ok' : 'default'}
          compact
          label="Tăng cân bình quân (ADG)"
          value={adgValue(adg60)}
          sub={adg60 === undefined ? adgSub(profile, adg60, 60) : `${adgSub(profile, adg60, 60)} · ≈ ${fmtKg(Math.round(adg60 * 30))} kg/tháng`}
        />
        <Metric
          surface="panel"
          tone={next.tone}
          compact
          label={profile.nextWeighingDate ? `Cân tới · ${fmtDate(profile.nextWeighingDate)}` : 'Lần cân tới'}
          value={nextKg === undefined ? (profile.nextWeighingDate ? '—' : 'Chưa có lịch') : `≈ ${fmtKg(Math.round(nextKg))} kg`}
          // Số "≈ kg" luôn đi kèm chữ "ước tính" (docs/BeefCare-Bento-Grid.md §4), kể cả khi lần cân đã quá hạn.
          sub={[next.status, nextKg === undefined ? 'Chưa đủ dữ liệu ADG để ước tính cân' : 'Ước tính nếu giữ ADG hiện tại'].filter(Boolean).join(' · ')}
        />
      </section>
    </>
  )
}

function Projection({ projection, adgDays }: { projection: GrowthProjection; adgDays?: number }) {
  const { state, targetKg, missingKg, adg60, days, projectedDate } = projection
  const projected = state === 'PROJECTED'
  const baseDate = projectedDate && days !== undefined ? addDays(projectedDate, -days) : undefined
  return (
    <Panel
      tone="emphasis"
      title="Dự kiến xuất bán"
      actions={projected && <Badge tone="ok">Ước tính</Badge>}
      className="col-span-full @min-[880px]:col-span-5 @min-[1024px]:col-span-6"
    >
      {projected ? (
        <div>
          <p className="m-0 text-sm text-side-text">{`Đủ ${fmtKg(targetKg)} kg vào khoảng`}</p>
          <p className="m-0 mt-1 text-4xl font-bold tabular-nums @min-[1024px]:text-5xl">{projectedDate ? fmtDate(projectedDate) : 'Chưa có ngày dự kiến'}</p>
          {days !== undefined && (
            <p className="mb-0 mt-3 inline-flex rounded-full bg-white px-3 py-1 text-sm font-semibold text-brand-dark">
              {baseDate ? `${days} ngày sau lần cân ${fmtDayMonth(baseDate)}` : `${days} ngày sau lần cân gần nhất`}
            </p>
          )}
        </div>
      ) : (
        <p className="m-0 text-base font-semibold">
          {state === 'REACHED' ? 'Đã đạt cân xuất bán mục tiêu.' : 'Chưa đủ số lần cân hợp lệ để dự kiến.'}
        </p>
      )}
      <dl className="m-0 mt-auto grid grid-cols-2 gap-3 border-t border-white/25 pt-3 @min-[640px]:grid-cols-3">
        <div><dt className="text-xs text-side-text">Mục tiêu</dt><dd className="m-0 mt-1 font-semibold">{`≥ ${fmtKg(targetKg)} kg`}</dd></div>
        <div><dt className="text-xs text-side-text">Còn thiếu</dt><dd className="m-0 mt-1 font-semibold">{`${fmtKg(missingKg)} kg`}</dd></div>
        <div><dt className="text-xs text-side-text">Tính theo</dt><dd className="m-0 mt-1 font-semibold">{adg60 === undefined ? 'ADG · —' : `ADG ${fmtDec(adg60, 2)} kg/ngày${adgDays === undefined ? '' : ` · ${adgDays} ngày`}`}</dd></div>
      </dl>
    </Panel>
  )
}

/** Vòng tiến độ chặng vỗ béo; số % và câu giải thích là chữ, vòng chỉ để nhìn nhanh. */
function Progress({ progress }: { progress?: FinishingProgress }) {
  const radius = 44
  const circumference = 2 * Math.PI * radius
  return (
    <Panel title="Tiến độ vỗ béo" className="col-span-full @min-[640px]:col-span-4 @min-[880px]:col-span-3">
      {progress ? (
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="relative grid size-28 place-items-center">
            <svg viewBox="0 0 100 100" aria-hidden="true" className="absolute inset-0 size-full -rotate-90">
              <circle cx="50" cy="50" r={radius} fill="none" stroke="#e5f3e9" strokeWidth="8" />
              <circle cx="50" cy="50" r={radius} fill="none" stroke="#08734e" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(progress.percent / 100) * circumference} ${circumference}`} />
            </svg>
            <p className="relative m-0 leading-tight"><span className="block text-2xl font-bold tabular-nums">{`${progress.percent}%`}</span><span className="text-[11px] text-muted">chặng vỗ béo</span></p>
          </div>
          <p className="m-0 text-lg font-bold tabular-nums">{`${fmtKg(progress.currentKg)} / ${fmtKg(progress.targetKg)} kg`}</p>
          <p className="m-0 text-xs text-muted">{`Cân ${fmtDayMonth(progress.currentAt)} · ${BASIS_LABEL[progress.currentBasis]}`}</p>
          <p className="m-0 rounded-full bg-ok-bg px-3 py-1 text-xs font-semibold text-ok-fg">
            {progress.gainedKg >= 0
              ? `Đã tăng ${fmtKg(progress.gainedKg)} / ${fmtKg(progress.plannedKg)} kg từ ${fmtDayMonth(progress.since)}`
              : `Giảm ${fmtKg(-progress.gainedKg)} kg so với ${fmtDayMonth(progress.since)}`}
          </p>
        </div>
      ) : <p className="m-0 text-sm text-muted">Chưa có lần cân hợp lệ để tính tiến độ.</p>}
    </Panel>
  )
}

interface RowActions { canWrite: boolean; onCorrect: (id: number) => void; onDelete: (id: number) => void }

function History({ profile, selectedRecord, canWrite, onCorrect, onDelete }: RowActions & { profile: GrowthProfile; selectedRecord?: GrowthRecord }) {
  const [dir, setDir] = useState<'desc' | 'asc'>('desc')
  const [all, setAll] = useState(false)
  // Lần đo đã xóa (EXCLUDED) không hiện trong lịch sử đo; chỉ còn xem được khi mở đúng bản ghi đó từ dòng thời gian.
  const visible = profile.records.filter((r) => r.status === 'VALID')
  const rows = selectedRecord ? [selectedRecord] : [...visible].sort((a, b) => (a.measuredAt < b.measuredAt ? 1 : -1) * (dir === 'desc' ? 1 : -1))
  const shown = all ? rows : rows.slice(0, HISTORY_ROWS)
  return (
    <Panel
      title={selectedRecord ? 'Bản ghi tăng trưởng đã chọn' : 'Lịch sử đo'}
      sub={selectedRecord
        ? 'ADG (mức tăng cân bình quân mỗi ngày) tính từ lần cân hợp lệ trước đó.'
        : 'Mới nhất ở trên · nhấn tiêu đề cột Thời điểm đo để đổi thứ tự. ADG (mức tăng cân bình quân mỗi ngày) của từng dòng tính từ lần cân hợp lệ trước đó.'}
      className="col-span-full"
    >
      {rows.length === 0 ? (
        <EmptyBlock title="Chưa có lần đo nào"  />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th aria-sort={dir === 'desc' ? 'descending' : 'ascending'}><button type="button" className="cursor-pointer rounded font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" onClick={() => setDir(dir === 'desc' ? 'asc' : 'desc')}>Thời điểm đo {dir === 'desc' ? '↓' : '↑'}</button></Th>
              <Th>Cân nặng</Th><Th>Phương pháp · cơ sở</Th><Th>BCS</Th><Th>ADG (kg/ngày)</Th><Th>Người đo</Th><Th>Trạng thái</Th>{canWrite && <Th>Thao tác</Th>}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => <HistoryRow key={r.id} r={r} adg={profile.rowAdg[r.id]} canWrite={canWrite} onCorrect={onCorrect} onDelete={onDelete} />)}
          </tbody>
        </Table>
      )}
      {rows.length > HISTORY_ROWS && (
        <div><Button variant="link" onClick={() => setAll(!all)}>{all ? 'Thu gọn' : `Xem tất cả ${rows.length} bản ghi →`}</Button></div>
      )}
    </Panel>
  )
}

function HistoryRow({ r, adg, canWrite, onCorrect, onDelete }: RowActions & { r: GrowthRecord; adg?: number }) {
  const excluded = r.status !== 'VALID'
  const method = r.method ? `${METHOD_LABEL[r.method]} · ${r.basis ? BASIS_LABEL[r.basis] : ''}` : '—'
  return (
    <tr className={excluded ? 'text-faint' : undefined}>
      <Td className="font-medium">{fmtDateTime(r.measuredAt)}</Td>
      <Td>{r.weightKg === undefined ? '—' : `${fmtKg(r.weightKg)} kg`}</Td>
      <Td>
        {method}
        {r.method === 'TAPE' && r.heartGirthCm !== undefined && r.bodyLengthCm !== undefined && <span className="block text-[11px] text-muted">{`VN ${r.heartGirthCm} × DTC ${r.bodyLengthCm} cm`}</span>}
      </Td>
      <Td>{r.bcs === undefined ? '—' : fmtDec(r.bcs)}</Td>
      <Td>{excluded || adg === undefined ? '—' : fmtDec(adg, 2)}</Td>
      <Td>{r.measuredByName}</Td>
      <Td>
        {r.status === 'EXCLUDED' ? <Badge tone="outline">Đã xóa</Badge> : r.corrected ? <Badge tone="info">Hợp lệ · Đã sửa</Badge> : <Badge tone="ok" icon="circle-check">Hợp lệ</Badge>}
      </Td>
      {canWrite && (
        <Td>
          {excluded ? '—' : (
            <span className="inline-flex gap-3">
              <Button variant="link" onClick={() => onCorrect(r.id)}>Sửa</Button>
              <Button variant="link" className="text-err-fg" onClick={() => onDelete(r.id)}>Xóa</Button>
            </span>
          )}
        </Td>
      )}
    </tr>
  )
}
