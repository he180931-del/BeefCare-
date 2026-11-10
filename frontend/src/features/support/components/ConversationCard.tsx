import { useEffect, useRef, useState } from 'react'
import { Button, Card } from '../../../components/ui'
import { formatDayTime, initials } from '../domain/format'
import type { MessagePage, Ticket, TicketMessage } from '../types'

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
export function ConversationCard({
  ticket,
  onLoadOlder,
}: {
  ticket: Ticket
  onLoadOlder: (beforeId: number) => Promise<MessagePage>
}) {
  const [messages, setMessages] = useState(ticket.messages)
  const [beforeId, setBeforeId] = useState(ticket.messagesBeforeId ?? null)
  const [hasMore, setHasMore] = useState(ticket.messagesHasMore === true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const viewport = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMessages(ticket.messages)
    setBeforeId(ticket.messagesBeforeId ?? null)
    setHasMore(ticket.messagesHasMore === true)
    setError('')
    requestAnimationFrame(() => {
      if (viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight
    })
  }, [ticket.id, ticket.updatedAt, ticket.messages, ticket.messagesBeforeId, ticket.messagesHasMore])

  const loadOlder = async () => {
    if (beforeId == null || loading) return
    setLoading(true)
    setError('')
    const previousHeight = viewport.current?.scrollHeight ?? 0
    try {
      const page = await onLoadOlder(beforeId)
      setMessages((current) => {
        const existing = new Set(current.map((message) => message.id ?? message.code))
        return [...page.items.filter((message) => !existing.has(message.id ?? message.code)), ...current]
      })
      setBeforeId(page.nextBeforeId)
      setHasMore(page.hasMore)
      requestAnimationFrame(() => {
        if (viewport.current) viewport.current.scrollTop += viewport.current.scrollHeight - previousHeight
      })
    } catch {
      setError('Không tải được các trao đổi trước. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card title="Trao đổi">
      {hasMore && beforeId != null && (
        <div className="flex justify-center">
          <Button variant="link" size="sm" disabled={loading} onClick={loadOlder}>
            {loading ? 'Đang tải…' : 'Xem trao đổi trước'}
          </Button>
        </div>
      )}
      {error && <p role="alert" className="m-0 text-xs text-danger">{error}</p>}
      <div ref={viewport} className="max-h-[480px] overflow-y-auto pr-1">
        <div className="flex flex-col gap-2.5">
          {messages.map((m) => (
            <Bubble key={m.id ?? m.code} message={m} />
          ))}
        </div>
      </div>
    </Card>
  )
}
