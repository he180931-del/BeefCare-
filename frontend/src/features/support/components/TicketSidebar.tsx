import { useState } from 'react'
import { Badge, Button, Card, Pagination, Table, Td, Th } from '../../../shared/ui'
import { formatDateTime, formatDayTime } from '../domain/format'
import { categoryLabel, HISTORY_EVENTS, shortFarmName } from '../domain/ticketRules'
import type { Ticket } from '../types'
import { TicketStatusBadge } from './TicketStatusBadge'

export function TicketInfoCard({ ticket, onViewResults }: { ticket: Ticket; onViewResults?: () => void }) {
  return (
    <Card variant="panel" title="Thông tin yêu cầu">
      <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-3">
        {[
          ['Trạng thái', <TicketStatusBadge ticket={ticket} />],
          ['Người phụ trách', ticket.assignedCs ?? 'Chưa phân công'],
          ['Danh mục', categoryLabel(ticket.category)],
          ['Trang trại', shortFarmName(ticket.farmName)],
          ['Cập nhật', formatDateTime(ticket.updatedAt)],
        ].map(([k, v]) => (
          <div key={String(k)} className="min-w-0">
            <dt className="mb-[3px] text-[11px] text-label">{k}</dt>
            <dd className="m-0 break-words text-[13px] font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      {ticket.resolutions.length > 0 && <Button size="sm" onClick={onViewResults}>Kết quả giải quyết</Button>}
    </Card>
  )
}

export function StatusHistoryCard({ ticket }: { ticket: Ticket }) {
  const pageSize = 10
  const [page, setPage] = useState(1)
  const pageCount = Math.max(1, Math.ceil(ticket.history.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const rows = ticket.history.slice((safePage - 1) * pageSize, safePage * pageSize)
  return (
    <Card variant="panel" title="Lịch sử trạng thái">
      <div role="region" aria-label="Danh sách lịch sử trạng thái" className="max-h-[360px] overflow-y-auto [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10">
        <Table variant="panel" stack={false}>
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
      </div>
      {pageCount > 1 && <Pagination page={safePage} pageCount={pageCount} onChange={setPage} summary={`Hiển thị ${rows.length} / ${ticket.history.length} sự kiện`} />}
    </Card>
  )
}
