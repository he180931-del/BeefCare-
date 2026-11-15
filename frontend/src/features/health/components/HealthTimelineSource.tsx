import { Card, Note } from '../../../components/ui'
import { fmtDate, fmtDateTime, OUTCOME_LABEL } from '../domain/healthFormat'
import type { HealthProfile } from '../types'
import { EntryBadge, Meta } from './healthUi'

export default function HealthTimelineSource({ profile, sourceId, type, caseId, technician = false }: {
  profile: HealthProfile; sourceId: string; type: string | null; caseId: string | null; technician?: boolean
}) {
  if (type === 'HEALTH_CASE_CLOSED') {
    const closed = profile.previousCases.find((item) => String(item.id) === sourceId)
    if (closed) {
      return <Card title={`Đóng ca ${closed.caseCode}`}>
        <Meta label="Ngày đóng">{fmtDate(closed.closedAt)}</Meta>
        <Meta label="Dấu hiệu">{closed.signs}</Meta>
        <Meta label="Kết quả">{closed.outcome ? OUTCOME_LABEL[closed.outcome] : '—'}</Meta>
      </Card>
    }
  }
  const record = profile.timeline.find((item) => String(item.id) === sourceId
    && (caseId == null || String(item.caseId) === caseId)
    && (type === 'TREATMENT' ? item.type === 'TREATMENT' : type === 'HEALTH_OBSERVATION' && item.type !== 'TREATMENT')
    && (!technician || item.status === 'VALID'))
  if (!record) return <Note tone="warn">Không tìm thấy bản ghi sức khỏe này.</Note>
  return <Card title={`Bản ghi sức khỏe · Ca ${record.caseCode}`}>
    <EntryBadge row={record} />
    <p className="m-0 text-sm">{record.details}</p>
    <Meta label="Thời điểm">{fmtDateTime(record.occurredAt)}</Meta>
    <Meta label={record.type === 'TREATMENT' ? 'Người thực hiện' : 'Người quan sát'}>{record.recordedBy || '—'}</Meta>
  </Card>
}
