import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useModalParam } from '../../../shared/hooks/useModalParam'
import { Badge, Button, EmptyBlock, ErrorBlock, Icon, LoadingBlock, Note, Panel, Table, Td, Th } from '../../../shared/ui'
import { userFacingError } from '../../../shared/api/userFacingError'
import { businessDate } from '../../../shared/lib/date/farmTime'
import { fmtDate, fmtDateTime, fmtMonthYear } from '../domain/vaccinationFormat'
import { cattleVaccinationSummary } from '../domain/vaccinationRules'
import { useCattleVaccination } from '../hooks/useVaccinationUseCase'
import type { CattleVaccination, DoseRow, VaccinationRecord } from '../types'
import CorrectVaccinationModal from './CorrectVaccinationModal'
import DeleteVaccinationModal from './DeleteVaccinationModal'
import { DoseStatusBadge, SOURCE_LABEL, healthCasePath, profilePath, useCanWrite, useNotice } from './vaccinationParts'

export default function VaccinationProfileTab({ cattleCode }: { cattleCode: string }) {
  const canWrite = useCanWrite()
  const navigate = useNavigate()
  const [modal] = useModalParam()
  const [params, setParams] = useSearchParams()
  const [notice, setNotice] = useNotice()
  const { data, loading, error, refetch } = useCattleVaccination(cattleCode)

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
  // With ?r= (e.g. opened from the timeline) only that record opens; never fall back to another one.
  const targetOf = (name: string) => modal === name
    ? (params.get('r') ? data.records.find((r) => String(r.id) === params.get('r')) : data.records.find((r) => r.status === 'VALID'))
    : undefined
  const correctTarget = targetOf('correct')
  const deleteTarget = targetOf('delete')
  const sourceId = modal ? null : params.get('r')
  const sourceRecord = sourceId == null ? undefined : data.records.find((record) => String(record.id) === sourceId)
  if (sourceId != null) return sourceRecord
    ? <History data={{ ...data, records: [sourceRecord] }} title="Bản ghi tiêm phòng" canWrite={false} onCorrect={() => undefined} onDelete={() => undefined} />
    : <Note tone="warn">Không tìm thấy bản ghi tiêm phòng này.</Note>

  return (
    <div className="flex flex-col gap-4">
      {notice && <Note tone="ok">{notice}</Note>}
      <Summary data={data} />
      <Scheduled data={data} canWrite={canWrite} onRecord={goRecord} />
      <History data={data} canWrite={canWrite} onCorrect={(id) => setModal('correct', 'r', id)} onDelete={(id) => setModal('delete', 'r', id)} />
      {canWrite && correctTarget && <CorrectVaccinationModal key={correctTarget.id} record={correctTarget} onClose={() => setModal(null)} onSaved={saved} />}
      {canWrite && deleteTarget && <DeleteVaccinationModal key={deleteTarget.id} record={deleteTarget} onClose={() => setModal(null)} onDeleted={saved} />}
    </div>
  )
}

/** SCR-34 (D78): trả lời ngay "con này tiêm đủ chưa" – chỉ tô đỏ khi còn mũi quá hạn. */
function Summary({ data }: { data: CattleVaccination }) {
  const { scheduled, overdue, done, withdrawalEnd } = cattleVaccinationSummary(data.doses, data.records, businessDate())
  const cells: Array<[string, ReactNode]> = [
    ['Đã tiêm', `${done} mũi`],
    ['Còn theo lịch', `${scheduled} mũi`],
    ['Quá hạn', overdue > 0 ? <Badge tone="err">{overdue} mũi</Badge> : 'Không'],
  ]
  return (
    <Panel tone={overdue > 0 ? 'warn' : 'default'} title={<span className="text-sm font-semibold">Tình trạng tiêm phòng</span>} className="gap-3! p-4!">
      <div className="grid grid-cols-3 gap-3">
        {cells.map(([label, value]) => (
          <div key={label} className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[11px] text-label">{label}</span>
            <span className="text-[13px] font-medium text-ink">{value}</span>
          </div>
        ))}
      </div>
      {withdrawalEnd && (
        <Note tone="warn">
          <span className="flex items-center gap-2">
            <Icon name="alert-triangle" size={16} className="shrink-0" />
            Ngưng sử dụng thịt đến {fmtDate(withdrawalEnd)}
          </span>
        </Note>
      )}
    </Panel>
  )
}

function Scheduled({ data, canWrite, onRecord }: { data: CattleVaccination; canWrite: boolean; onRecord: (id: number) => void }) {
  return (
    // Bento (Figma Tab 17 ②b): mũi còn phải tiêm là việc tiếp theo của tab, nền xanh nhạt khi có mũi.
    <Panel tone={data.doses.length ? 'ok' : 'default'} title={<span className="text-sm font-semibold">Mũi tiêm theo lịch</span>} className="gap-3! p-4!">
      {data.doses.length === 0 ? (
        <EmptyBlock title="Không còn mũi nào cần tiêm"  />
      ) : (
        <Table>
          <thead><tr><Th>Lịch</Th><Th>Mũi</Th><Th>Ngày dự kiến</Th><Th>Trạng thái</Th>{canWrite && <Th>Thao tác</Th>}</tr></thead>
          <tbody>
            {data.doses.map((d: DoseRow) => (
              <tr key={d.id}>
                <Td className="font-medium">{d.scheduleName}</Td>
                <Td>{d.kind === 'BOOSTER' ? 'Nhắc lại' : `${d.doseNo} / ${d.doseCount}`}</Td>
                <Td>{fmtDate(d.dueDate)}</Td>
                <Td><DoseStatusBadge row={d} /></Td>
                {canWrite && <Td><Button variant="link" onClick={() => onRecord(d.id)}>Ghi nhận</Button></Td>}
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Panel>
  )
}

interface RowActions { canWrite: boolean; onCorrect: (id: number) => void; onDelete: (id: number) => void }

function History({ data, title = 'Lịch sử tiêm', canWrite, onCorrect, onDelete }: { data: CattleVaccination; title?: string } & RowActions) {
  const [dir, setDir] = useState<'desc' | 'asc'>('desc')
  const rows = data.records.filter((r) => r.status !== 'VOIDED').sort((a, b) => (a.administeredAt < b.administeredAt ? 1 : -1) * (dir === 'desc' ? 1 : -1))
  return (
    <Panel title={<span className="text-sm font-semibold">{title}</span>} className="gap-3! p-4!">
      {rows.length === 0 ? (
        <EmptyBlock title="Chưa có mũi tiêm nào"  />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th><button type="button" className="font-semibold" onClick={() => setDir(dir === 'desc' ? 'asc' : 'desc')}>Thời điểm {dir === 'desc' ? '↓' : '↑'}</button></Th>
              <Th>Vắc-xin · mũi</Th><Th>Liều</Th><Th>Ngưng thịt đến</Th><Th>Nguồn</Th><Th>Người tiêm</Th><Th>Phản ứng</Th>{canWrite && <Th>Thao tác</Th>}
            </tr>
          </thead>
          <tbody>{rows.map((r) => <HistoryRow key={r.id} r={r} canWrite={canWrite} onCorrect={onCorrect} onDelete={onDelete} />)}</tbody>
        </Table>
      )}
    </Panel>
  )
}

function HistoryRow({ r, canWrite, onCorrect, onDelete }: { r: VaccinationRecord } & RowActions) {
  const unknown = r.source === 'HISTORICAL'
  return (
    <tr>
      <Td className="font-medium">{r.precision === 'MONTH' ? fmtMonthYear(r.administeredAt) : fmtDateTime(r.administeredAt)}</Td>
      <Td>{[r.vaccineLabel, r.doseText].filter(Boolean).join(' · ')}{r.corrected && <Badge tone="info">Đã sửa</Badge>}</Td>
      <Td>{r.dose ?? (unknown ? 'Không rõ' : '—')}</Td>
      <Td>{r.withdrawalEndDate ? fmtDate(r.withdrawalEndDate) : '—'}</Td>
      <Td>{SOURCE_LABEL[r.source]}</Td>
      <Td>{r.vaccinator ?? (unknown ? 'Không rõ' : '—')}</Td>
      <Td>{r.reactionCaseCode ? <Link to={healthCasePath(r.reactionCaseCode)} className="font-semibold text-brand no-underline hover:underline">{r.reactionCaseCode}{r.reactionNote ? ` · ${r.reactionNote}` : ''}</Link> : '—'}</Td>
      {canWrite && (
        <Td>
          <span className="inline-flex gap-3">
            <Button variant="link" onClick={() => onCorrect(r.id)}>Sửa</Button>
            <Button variant="link" className="text-err-fg" onClick={() => onDelete(r.id)}>Xóa</Button>
          </span>
        </Td>
      )}
    </tr>
  )
}
