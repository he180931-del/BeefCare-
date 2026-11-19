import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useModalParam } from '../../../components/Modal'
import { Badge, Button, Card, EmptyBlock, ErrorBlock, Foot, LoadingBlock, Note, Table, Td, Th } from '../../../components/ui'
import { userFacingError } from '../../../api/userFacingError'
import { useQuery } from '../../../hooks/useApi'
import { vaccinationApi } from '../api/vaccinationApi'
import { fmtDate, fmtDateTime, fmtMonthYear } from '../domain/vaccinationFormat'
import type { CattleVaccination, DoseRow, VaccinationRecord } from '../types'
import CorrectVaccinationModal from './CorrectVaccinationModal'
import DeferModal from './DeferModal'
import { DoseStatusBadge, SOURCE_LABEL, healthCasePath, profilePath, recordPath, useCanWrite, useNotice } from './vaccinationParts'

export default function VaccinationProfileTab({ cattleCode }: { cattleCode: string }) {
  const canWrite = useCanWrite()
  const navigate = useNavigate()
  const [modal] = useModalParam()
  const [params, setParams] = useSearchParams()
  const [notice, setNotice] = useNotice()
  const { data, loading, error, refetch } = useQuery(() => vaccinationApi.getCattleVaccination(cattleCode), [cattleCode])

  if (loading && !data) return <LoadingBlock />
  if (error || !data) return <ErrorBlock message={userFacingError(error, 'Không tải được dữ liệu tiêm phòng.')} onRetry={refetch} />

  const setModal = (name: string | null, key?: string, id?: number) => {
    const next = new URLSearchParams(params)
    next.delete('m'); next.delete('d'); next.delete('r')
    if (name) next.set('m', name)
    if (key && id !== undefined) next.set(key, String(id))
    setParams(next)
  }
  const back = encodeURIComponent(profilePath(cattleCode))
  const goRecord = (doseId?: number) => navigate(`/tiem-phong/ghi-nhan?${doseId ? `doses=${doseId}` : `cattle=${cattleCode}`}&back=${back}`)
  const saved = (message: string) => { setNotice(message); setModal(null); refetch() }
  const deferTarget = modal === 'defer' ? (data.doses.find((d) => String(d.id) === params.get('d')) ?? data.doses[0]) : undefined
  const correctTarget = modal === 'correct' ? (data.records.find((r) => String(r.id) === params.get('r')) ?? data.records.find((r) => r.status === 'VALID')) : undefined

  return (
    <div className="flex flex-col gap-4">
      {notice && <Note tone="ok">{notice}</Note>}
      <Scheduled data={data} canWrite={canWrite} onRecord={goRecord} onDefer={(id) => setModal('defer', 'd', id)} />
      <History data={data} canWrite={canWrite} onCorrect={(id) => setModal('correct', 'r', id)} />
      <Foot>Tab Tiêm phòng trong hồ sơ bò: phần trên là mũi còn phải tiêm theo lịch, phần dưới là lịch sử đã tiêm. "Ngưng thịt đến" chỉ có với mũi tiêm tại trại có thời gian ngưng. Phản ứng hiện mã ca sức khỏe nếu có. Quản lý thấy nút Ghi nhận, Hoãn, Sửa · Hủy; vai trò khác chỉ xem.</Foot>
      {canWrite && deferTarget && <DeferModal key={deferTarget.id} doseId={deferTarget.id} onClose={() => setModal(null)} onSaved={saved} />}
      {canWrite && correctTarget && <CorrectVaccinationModal key={correctTarget.id} record={correctTarget} onClose={() => setModal(null)} onSaved={saved} />}
    </div>
  )
}

function Scheduled({ data, canWrite, onRecord, onDefer }: { data: CattleVaccination; canWrite: boolean; onRecord: (id: number) => void; onDefer: (id: number) => void }) {
  return (
    <Card title="Mũi tiêm theo lịch" sub="Các mũi chưa tiêm của bò này">
      {data.doses.length === 0 ? (
        <EmptyBlock title="Không còn mũi nào cần tiêm" sub="Bò này không có mũi chưa tiêm trong các lịch đang chạy." />
      ) : (
        <Table>
          <thead><tr><Th>Lịch</Th><Th>Mũi</Th><Th>Ngày dự kiến</Th><Th>Trạng thái</Th>{canWrite && <Th>Thao tác</Th>}</tr></thead>
          <tbody>
            {data.doses.map((d: DoseRow) => (
              <tr key={d.id}>
                <Td className="font-medium">{d.scheduleName}</Td>
                <Td>{d.kind === 'BOOSTER' ? 'Nhắc lại' : `${d.doseNo} / ${d.doseCount}`}</Td>
                <Td>{fmtDate(d.effectiveDate)}</Td>
                <Td><DoseStatusBadge row={d} /></Td>
                {canWrite && <Td><Button variant="link" onClick={() => onRecord(d.id)}>Ghi nhận</Button> · <Button variant="link" onClick={() => onDefer(d.id)}>Hoãn</Button></Td>}
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  )
}

function History({ data, canWrite, onCorrect }: { data: CattleVaccination; canWrite: boolean; onCorrect: (id: number) => void }) {
  const [dir, setDir] = useState<'desc' | 'asc'>('desc')
  const rows = [...data.records].sort((a, b) => (a.administeredAt < b.administeredAt ? 1 : -1) * (dir === 'desc' ? 1 : -1))
  return (
    <Card title="Lịch sử tiêm" sub="Mới nhất ở trên · dòng đã hủy in xám">
      {rows.length === 0 ? (
        <EmptyBlock title="Chưa có mũi tiêm nào" sub="Các mũi đã tiêm và lịch sử nhập từ người bán sẽ hiện ở đây." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th><button type="button" className="font-semibold" onClick={() => setDir(dir === 'desc' ? 'asc' : 'desc')}>Thời điểm {dir === 'desc' ? '↓' : '↑'}</button></Th>
              <Th>Vắc-xin · mũi</Th><Th>Lô · liều</Th><Th>Ngưng thịt đến</Th><Th>Nguồn</Th><Th>Người tiêm</Th><Th>Phản ứng</Th>{canWrite && <Th>Thao tác</Th>}
            </tr>
          </thead>
          <tbody>{rows.map((r) => <HistoryRow key={r.id} r={r} canWrite={canWrite} onCorrect={onCorrect} />)}</tbody>
        </Table>
      )}
    </Card>
  )
}

function HistoryRow({ r, canWrite, onCorrect }: { r: VaccinationRecord; canWrite: boolean; onCorrect: (id: number) => void }) {
  const voided = r.status === 'VOIDED'
  const unknown = r.source === 'HISTORICAL'
  return (
    <tr className={voided ? 'text-faint' : undefined}>
      <Td className="font-medium">{r.precision === 'MONTH' ? fmtMonthYear(r.administeredAt) : fmtDateTime(r.administeredAt)}</Td>
      <Td>{[r.vaccineLabel, r.doseText].filter(Boolean).join(' · ')}{voided && ' (đã hủy)'}{r.corrected && !voided && <Badge tone="info">Đã sửa</Badge>}</Td>
      <Td>{r.batchNo || r.dose ? [r.batchNo, r.dose].filter(Boolean).join(' · ') : unknown ? 'Không rõ' : '—'}</Td>
      <Td>{r.withdrawalEndDate ? fmtDate(r.withdrawalEndDate) : '—'}</Td>
      <Td>{SOURCE_LABEL[r.source]}</Td>
      <Td>{r.vaccinator ?? (unknown ? 'Không rõ' : '—')}</Td>
      <Td>{r.reactionCaseCode ? <Link to={healthCasePath(r.reactionCaseCode)} className="font-semibold text-brand no-underline hover:underline">{r.reactionCaseCode}{r.reactionNote ? ` · ${r.reactionNote}` : ''}</Link> : '—'}</Td>
      {canWrite && <Td>{voided ? '—' : <Button variant="link" onClick={() => onCorrect(r.id)}>Sửa · Hủy</Button>}</Td>}
    </tr>
  )
}
