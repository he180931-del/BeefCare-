import { Card } from '../../../components/ui'
import { formatDayTime, initials } from '../domain/format'
import type { Ticket, TicketMessage } from '../types'

function Bubble({ message }: { message: TicketMessage }) {
  const mine = message.authorRole === 'OWNER'
  const who = mine ? `${message.author} (bạn)` : `${message.author} · Bộ phận hỗ trợ`
  return (
    <div className={`rounded-md border border-rule p-3 ${mine ? 'bg-white' : 'bg-page'}`}>
      <div className="mb-1 flex items-center gap-2">
        <span aria-hidden className="grid size-[22px] shrink-0 place-items-center rounded-full bg-chip text-[9px] font-semibold text-brand">
          {initials(message.author)}
        </span>
        <span className="text-xs font-semibold text-ink">
          {who} · {formatDayTime(message.createdAt)}
        </span>
      </div>
      <p className="m-0 whitespace-pre-wrap break-words text-xs text-ink">{message.text}</p>
    </div>
  )
}

/** Chỉ tin nhắn PUBLIC (GBR-81): ticket của Chủ trại không mang ghi chú nội bộ. */
export function ConversationCard({ ticket }: { ticket: Ticket }) {
  return (
    <Card title="Trao đổi">
      <div className="flex flex-col gap-2.5">
        {ticket.messages.map((m) => (
          <Bubble key={m.code} message={m} />
        ))}
      </div>
    </Card>
  )
}
