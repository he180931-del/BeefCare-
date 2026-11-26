import { useState, type ReactNode } from 'react'
import { Badge, Button, Icon, Panel } from '../../../shared/ui'
import { caseLabel, fmtDate, fmtDateTime } from '../domain/healthFormat'
import type { HealthCaseCard, HealthTimelineRow } from '../types'
import { CaseStatusBadge, EntryBadge, SeverityBadge } from './healthUi'

/** Số bản ghi diễn biến hiện sẵn khi thẻ mở; phần còn lại xem bằng "Xem thêm". */
const RECENT_ROWS = 3

export type EntryAction = 'correct' | 'void'

/** Một bản ghi diễn biến. Bản ghi đã xóa không truyền vào đây (D73: ẩn như lịch sử cân, tiêm, sinh sản). */
export function TimelineRow({ row, first, canEdit, onEdit }: { row: HealthTimelineRow; first: boolean; canEdit: boolean; onEdit: (row: HealthTimelineRow, action: EntryAction) => void }) {
  const stamp = fmtDateTime(row.occurredAt)
  return (
    <li className="flex gap-3">
      <span className="mt-1.5 flex w-3 shrink-0 justify-center"><span className={`size-2 rounded-full ${first ? 'bg-brand' : 'bg-[#bdbdbd]'}`} /></span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-ink">{fmtDateTime(row.occurredAt)}</span>
          <EntryBadge row={row} />
          {row.corrected && <Badge tone="outline">Đã sửa</Badge>}
        </div>
        <p className="m-0 text-[13px] text-ink">{row.details}</p>
        <p className="m-0 text-[11px] text-muted">Ghi bởi {row.recordedBy}</p>
      </div>
      {/* D73: Sửa / Xóa tách riêng như Cân nặng, Tiêm phòng, Sinh sản; lần ghi mở ca chỉ sửa (R-10-11). */}
      {canEdit && (
        <span className="flex shrink-0 gap-3 self-start text-xs">
          <button type="button" aria-label={`Sửa bản ghi ${stamp}`} className="cursor-pointer font-semibold text-brand" onClick={() => onEdit(row, 'correct')}>Sửa</button>
          {row.type !== 'OPENING' && <button type="button" aria-label={`Xóa bản ghi ${stamp}`} className="cursor-pointer font-semibold text-err-fg" onClick={() => onEdit(row, 'void')}>Xóa</button>}
        </span>
      )}
    </li>
  )
}

/** Một mục tóm tắt trên dòng thông tin của thẻ ca. */
const Fact = ({ label, children }: { label: string; children: ReactNode }) => (
  <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><span className="text-label">{label}</span><span className="font-medium text-ink">{children}</span></span>
)

/**
 * Thẻ một ca đang mở / theo dõi dài hạn (Bento panel). Gọn để nhiều ca không làm trang quá dài: thông tin ca trên một
 * dòng, nút nhỏ, diễn biến chỉ hiện ở thẻ đang mở (mặc định thẻ đầu) và tối đa {@link RECENT_ROWS} bản ghi mới nhất.
 */
export default function CaseCard({ card, rows, canAdd, canEdit, onAction, onEdit, defaultExpanded = true }: {
  card: HealthCaseCard
  rows: HealthTimelineRow[]
  canAdd: boolean
  canEdit: boolean
  onAction: (name: 'treatment' | 'update-case', caseCode: string) => void
  onEdit: (row: HealthTimelineRow, action: EntryAction) => void
  defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [showAll, setShowAll] = useState(false)
  const shown = showAll ? rows : rows.slice(0, RECENT_ROWS)
  return (
    <Panel headingAs="h3" title={`Ca ${card.caseCode} · ${caseLabel(card)}`}
      actions={<div className="flex flex-wrap items-center gap-2">
        {card.suspectedContagious && <Badge tone="err" icon="alert-triangle">Nghi truyền nhiễm</Badge>}
        <CaseStatusBadge status={card.status} day={card.day} chronicSince={card.chronicSince} />
      </div>}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
        <Fact label="Mức độ"><SeverityBadge severity={card.severity} /></Fact>
        <Fact label="Mở lúc">{fmtDateTime(card.openedAt)}</Fact>
        <Fact label="Số lần điều trị">{card.treatmentCount}</Fact>
        <Fact label="Ngưng thịt đến">{fmtDate(card.withdrawalEndDate)}</Fact>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {canAdd && <>
          <Button type="button" size="sm" onClick={() => onAction('treatment', card.caseCode)}><Icon name="pill" size={14} /> Ghi điều trị</Button>
          <Button type="button" size="sm" variant="primary" onClick={() => onAction('update-case', card.caseCode)}><Icon name="edit" size={14} /> Cập nhật ca bệnh</Button>
        </>}
        <Button type="button" variant="link" className="ml-auto text-xs" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Ẩn diễn biến' : `Diễn biến & điều trị (${rows.length})`}
        </Button>
      </div>
      {expanded && (
        <>
          <ul className="m-0 flex list-none flex-col gap-2.5 border-t border-edge p-0 pt-3">
            {shown.map((r, i) => <TimelineRow key={r.id} row={r} first={i === 0} canEdit={canEdit} onEdit={onEdit} />)}
          </ul>
          {rows.length > RECENT_ROWS && (
            <Button type="button" variant="link" className="self-start text-xs" onClick={() => setShowAll((v) => !v)}>
              {showAll ? 'Thu gọn' : `Xem thêm ${rows.length - RECENT_ROWS} bản ghi`}
            </Button>
          )}
        </>
      )}
    </Panel>
  )
}
