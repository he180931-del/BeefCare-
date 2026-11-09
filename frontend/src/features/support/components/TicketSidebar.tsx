import { useState } from 'react'
import { Badge, Card, Pagination, Table, Td, Th } from '../../../components/ui'
import { formatDateTime, formatDayTime } from '../domain/format'
import { categoryLabel, HISTORY_EVENTS, PRIORITY_LABELS, shortFarmName } from '../domain/ticketRules'
import type { Ticket } from '../types'
import { TicketStatusBadge } from './TicketStatusBadge'

export function TicketInfoCard({ ticket }: { ticket: Ticket }) {
  return (
    <Card title="Thông tin yêu cầu">
      <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-3">
        {[
          ['Trạng thái', <TicketStatusBadge ticket={ticket} />],
          ['Người phụ trách', ticket.assignedCs ?? 'Chưa phân công'],
          ['Danh mục', categoryLabel(ticket.category)],
          ['Ưu tiên', PRIORITY_LABELS[ticket.priority]],
          ['Trang trại', shortFarmName(ticket.farmName)],
          ['Cập nhật', formatDateTime(ticket.updatedAt)],
        ].map(([k, v]) => (
          <div key={String(k)} className="min-w-0">
            <dt className="mb-[3px] text-[11px] text-faint">{k}</dt>
            <dd className="m-0 break-words text-[13px] font-medium">{v}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}

export function StatusHistoryCard({ ticket }: { ticket: Ticket }) {
  const pageSize = 50
  const [page, setPage] = useState(1)
  const pageCount = Math.max(1, Math.ceil(ticket.history.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const rows = ticket.history.slice((safePage - 1) * pageSize, safePage * pageSize)
  return (
    <Card title="Lịch sử trạng thái">
      <Table stack={false}>
        <thead>
          <tr>
            <Th>Thời điểm</Th>
            <Th>Trạng thái</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={`${e.at}-${e.event}`}>
              <Td className="font-medium">{formatDayTime(e.at)}</Td>
              <Td>
                <Badge tone={HISTORY_EVENTS[e.event].tone}>{HISTORY_EVENTS[e.event].label}</Badge>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {pageCount > 1 && <Pagination page={safePage} pageCount={pageCount} onChange={setPage} summary={`Hiển thị ${rows.length} / ${ticket.history.length} sự kiện`} />}
    </Card>
  )
}
