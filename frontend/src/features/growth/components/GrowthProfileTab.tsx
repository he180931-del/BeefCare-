import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useModalParam } from '../../../components/Modal'
import { Badge, Button, Card, EmptyBlock, ErrorBlock, Foot, Info, LoadingBlock, Metric, Note, Table, Td, Th } from '../../../components/ui'
import { userFacingError } from '../../../api/userFacingError'
import { useQuery } from '../../../hooks/useApi'
import { useSession } from '../../authorization'
import { growthApi } from '../api/growthApi'
import { fmtDate, fmtDateTime, fmtDayMonth, fmtDec, fmtKg } from '../domain/growthFormat'
import { BASIS_LABEL, METHOD_LABEL } from '../domain/growthLabels'
import type { GrowthProfile, GrowthRecord } from '../types'
import GrowthChart, { ChartLegend } from './GrowthChart'
import GrowthCorrectModal from './GrowthCorrectModal'
import GrowthRecordModal from './GrowthRecordModal'

const HISTORY_ROWS = 5

export default function GrowthProfileTab({ cattleCode }: { cattleCode: string }) {
  const canWrite = (useSession()?.role ?? 'MANAGER') === 'MANAGER'
  const [modal, , closeModal] = useModalParam()
  const [params, setParams] = useSearchParams()
  const [notice, setNotice] = useState<string | null>(null)
  const { data, loading, error, refetch } = useQuery(() => growthApi.getProfile(cattleCode), [cattleCode])

  if (loading && !data) return <LoadingBlock />
  if (error || !data) return <ErrorBlock message={userFacingError(error, 'Không tải được dữ liệu tăng trưởng.')} onRetry={refetch} />

  const closeAll = () => {
    const next = new URLSearchParams(params)
    next.delete('m')
    next.delete('r')
    setParams(next)
  }
  const openCorrect = (id: number) => {
    const next = new URLSearchParams(params)
    next.set('m', 'correct')
    next.set('r', String(id))
    setParams(next)
  }
  const saved = (message: string) => { setNotice(message); closeAll(); refetch() }
  const correctTarget = modal === 'correct' ? (data.records.find((r) => String(r.id) === params.get('r')) ?? data.records.find((r) => r.status === 'VALID')) : undefined

  return (
    <div className="flex flex-col gap-4">
      {notice && <Note tone="ok">{notice}</Note>}
      <Summary profile={data} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,720fr)_minmax(0,376fr)]">
        <Card title="Cân nặng theo thời gian" sub="Chỉ vẽ bản ghi hợp lệ" actions={<ChartLegend />}>
          <GrowthChart points={data.chart} />
        </Card>
        {data.projection && <Projection profile={data} />}
      </div>
      <History profile={data} canWrite={canWrite} onCorrect={openCorrect} />
      <Foot>Tab Tăng trưởng & BCS trong hồ sơ bò. Quản lý thấy nút Ghi nhận và cột Thao tác; Chủ trại và Kỹ thuật viên chỉ xem. ADG mỗi dòng tính từ lần cân hợp lệ trước đó; dòng đã loại trừ in xám và không tính. Dự kiến xuất bán chỉ hiện với bò Vỗ béo có mục tiêu cân xuất.</Foot>
      {canWrite && modal === 'record' && <GrowthRecordModal cattleCode={cattleCode} onClose={closeModal} onSaved={saved} />}
      {canWrite && correctTarget && <GrowthCorrectModal key={correctTarget.id} record={correctTarget} onClose={closeAll} onSaved={saved} />}
    </div>
  )
}

function Summary({ profile }: { profile: GrowthProfile }) {
  const { latest, adg90, latestBcs, count, correctedCount, nextWeighingDate } = profile
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
      <Metric compact label="Cân gần nhất" value={latest ? `${fmtKg(latest.kg)} kg` : '—'} sub={latest ? `${fmtDayMonth(latest.at)} · ${BASIS_LABEL[latest.basis]}` : 'Chưa có lần cân'} />
      <Metric compact label="ADG 90 ngày" value={adg90 === undefined ? '—' : fmtDec(adg90, 2)} sub={adg90 === undefined ? 'Chưa đủ 2 lần cân hợp lệ' : 'kg/ngày'} />
      <Metric compact label="BCS gần nhất" value={latestBcs === undefined ? '—' : `${fmtDec(latestBcs)} / 5`} sub="thang trại v1" />
      <Metric compact label="Số lần đo" value={count} sub={correctedCount ? `${correctedCount} bản ghi đã sửa` : 'Chưa có bản ghi sửa'} />
      <Metric compact label="Lần cân tới" value={nextWeighingDate ? fmtDate(nextWeighingDate) : '—'} sub="chu kỳ 30 ngày" />
    </div>
  )
}

function Projection({ profile }: { profile: GrowthProfile }) {
  const p = profile.projection!
  const info: Array<[string, string]> = [
    ['Mục tiêu', `≥ ${fmtKg(p.targetKg)} kg`],
    ['Còn thiếu', `${fmtKg(p.missingKg)} kg`],
    ['ADG 60 ngày', p.adg60 === undefined ? '—' : `${fmtDec(p.adg60, 2)} kg/ngày`],
    ['Dự kiến đạt', p.projectedDate ? fmtDate(p.projectedDate) : '—'],
  ]
  return (
    <Card title="Dự kiến xuất bán">
      <Info cols={2} items={info} />
      <Note tone={p.state === 'REACHED' ? 'ok' : 'info'}>
        {p.state === 'PROJECTED' && `Dự kiến đạt ${fmtKg(p.targetKg)} kg sau ${p.days} ngày nếu giữ ADG hiện tại.`}
        {p.state === 'REACHED' && 'Đã đạt cân xuất bán mục tiêu.'}
        {p.state === 'INSUFFICIENT' && 'Chưa đủ số lần cân hợp lệ để dự kiến.'}
      </Note>
    </Card>
  )
}

function History({ profile, canWrite, onCorrect }: { profile: GrowthProfile; canWrite: boolean; onCorrect: (id: number) => void }) {
  const [dir, setDir] = useState<'desc' | 'asc'>('desc')
  const [all, setAll] = useState(false)
  const rows = [...profile.records].sort((a, b) => (a.measuredAt < b.measuredAt ? 1 : -1) * (dir === 'desc' ? 1 : -1))
  const shown = all ? rows : rows.slice(0, HISTORY_ROWS)
  return (
    <Card title="Lịch sử đo" sub="Mới nhất ở trên · nhấn tiêu đề cột để sắp xếp">
      {rows.length === 0 ? (
        <EmptyBlock title="Chưa có lần đo nào" sub="Các lần cân và chấm BCS sẽ hiện ở đây." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th><button type="button" className="font-semibold" onClick={() => setDir(dir === 'desc' ? 'asc' : 'desc')}>Thời điểm đo {dir === 'desc' ? '↓' : '↑'}</button></Th>
              <Th>Cân nặng</Th><Th>Phương pháp · cơ sở</Th><Th>BCS</Th><Th>ADG</Th><Th>Người đo</Th><Th>Trạng thái</Th>{canWrite && <Th>Thao tác</Th>}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => <HistoryRow key={r.id} r={r} adg={profile.rowAdg[r.id]} canWrite={canWrite} onCorrect={onCorrect} />)}
          </tbody>
        </Table>
      )}
      {rows.length > HISTORY_ROWS && (
        <div><Button variant="link" onClick={() => setAll(!all)}>{all ? 'Thu gọn' : `Xem tất cả ${rows.length} bản ghi →`}</Button></div>
      )}
    </Card>
  )
}

function HistoryRow({ r, adg, canWrite, onCorrect }: { r: GrowthRecord; adg?: number; canWrite: boolean; onCorrect: (id: number) => void }) {
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
        {r.status === 'EXCLUDED' ? <Badge tone="outline">Đã loại trừ</Badge> : r.corrected ? <Badge tone="info">Hợp lệ · Đã sửa</Badge> : <Badge tone="ok" icon="circle-check">Hợp lệ</Badge>}
      </Td>
      {canWrite && <Td>{excluded ? '—' : <Button variant="link" onClick={() => onCorrect(r.id)}>Sửa · Loại trừ</Button>}</Td>}
    </tr>
  )
}
