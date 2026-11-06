import { Badge } from '../../../components/ui'
import { listStatus, plainStatus } from '../domain/ticketRules'
import type { Ticket } from '../types'

/** `list`: phiếu đã giải quyết nhưng chưa được xác nhận hiện "Chờ bạn xác nhận". */
export function TicketStatusBadge({ ticket, variant = 'detail' }: { ticket: Ticket; variant?: 'list' | 'detail' }) {
  const view = variant === 'list' ? listStatus(ticket) : plainStatus(ticket)
  return <Badge tone={view.tone}>{view.label}</Badge>
}
