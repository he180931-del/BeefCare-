import type { ReactNode } from 'react'
import { Badge, Button, Card } from '../../../components/ui'
import { Icon } from '../../../components/Icon'
import { fmtDate, fmtDateTime } from '../domain/healthFormat'
import type { HealthCaseCard, HealthTimelineRow } from '../types'
import { CaseStatusBadge, EntryBadge, SeverityBadge } from './healthUi'

const Meta = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex min-w-0 flex-col gap-0.5">
    <span className="text-[11px] text-faint">{label}</span>
    <span className="text-[13px] font-medium text-ink">{children}</span>
  </div>
)

function TimelineRow({ row, first, canEdit, onEdit }: { row: HealthTimelineRow; first: boolean; canEdit: boolean; onEdit: (row: HealthTimelineRow) => void }) {
  const voided = row.status === 'VOIDED'
  return (
    <li className={`flex gap-3 ${voided ? 'opacity-60' : ''}`}>
      <span className="mt-1.5 flex w-3 shrink-0 justify-center"><span className={`size-2.5 rounded-full ${first && !voided ? 'bg-brand' : 'bg-[#bdbdbd]'}`} /></span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-ink">{fmtDateTime(row.occurredAt)}</span>
          <EntryBadge row={row} />
          {row.corrected && <Badge tone="outline">Đã sửa</Badge>}
          {voided && <Badge tone="err">Đã hủy</Badge>}
        </div>
        <p className={`m-0 text-[13px] text-ink ${voided ? 'line-through' : ''}`}>{row.details}</p>
        <p className="m-0 text-[11px] text-muted">Ghi bởi {row.recordedBy}</p>
      </div>
      {canEdit && !voided && (
        <Button type="button" variant="link" onClick={() => onEdit(row)} aria-label={`${row.type === 'OPENING' ? 'Sửa' : 'Sửa · Hủy'} bản ghi ${fmtDateTime(row.occurredAt)}`} className="shrink-0 self-start text-xs">
          {row.type === 'OPENING' ? 'Sửa' : 'Sửa · Hủy'}
        </Button>
      )}
    </li>
  )
}

export default function CaseCard({ card, rows, canAdd, canEdit, onAction, onEdit }: {
  card: HealthCaseCard
  rows: HealthTimelineRow[]
  canAdd: boolean
  canEdit: boolean
  onAction: (name: 'follow-up' | 'treatment' | 'update-status', caseCode: string) => void
  onEdit: (row: HealthTimelineRow) => void
}) {
  return (
    <Card
      title={`Ca ${card.caseCode} · ${card.signs}`}
      sub={card.status === 'OPEN' ? 'Ca đang mở' : 'Ca theo dõi mạn tính'}
      actions={<>
        {card.suspectedContagious && <Badge tone="err" icon="alert-triangle">Nghi truyền nhiễm</Badge>}
        <CaseStatusBadge status={card.status} day={card.day} chronicSince={card.chronicSince} />
      </>}
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Meta label="Mức độ"><SeverityBadge severity={card.severity} /></Meta>
        <Meta label="Mở lúc">{fmtDateTime(card.openedAt)}</Meta>
        <Meta label="Số lần điều trị">{card.treatmentCount}</Meta>
        <Meta label="Ngưng thịt đến">{fmtDate(card.withdrawalEndDate)}</Meta>
      </div>
      {canAdd && (
        <div className="flex flex-wrap justify-end gap-2.5">
          <Button type="button" onClick={() => onAction('follow-up', card.caseCode)}><Icon name="eye" size={16} /> Ghi theo dõi</Button>
          <Button type="button" onClick={() => onAction('treatment', card.caseCode)}><Icon name="pill" size={16} /> Ghi điều trị</Button>
          <Button type="button" variant="primary" onClick={() => onAction('update-status', card.caseCode)}><Icon name="edit" size={16} /> Cập nhật trạng thái</Button>
        </div>
      )}
      <h4 className="m-0 text-[13px] font-semibold text-ink">Diễn biến &amp; điều trị</h4>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {rows.map((r, i) => <TimelineRow key={r.id} row={r} first={i === 0} canEdit={canEdit} onEdit={onEdit} />)}
      </ul>
    </Card>
  )
}
