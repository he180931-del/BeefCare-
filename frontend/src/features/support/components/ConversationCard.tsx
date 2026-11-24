import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button, Card } from '../../../shared/ui'
import { initials } from '../domain/format'
import type { MessagePage, Ticket, TicketMessage } from '../types'

const messageKey = (message: TicketMessage) => message.id == null
  ? `${message.code}:${message.authorRole}:${message.author}:${message.createdAt}:${message.text}`
  : `id:${message.id}`

const uniqueMessages = (items: TicketMessage[]) => {
  const seen = new Set<string>()
  return items.filter((message) => {
    const key = messageKey(message)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function Bubble({ message }: { message: TicketMessage }) {
  const mine = message.authorRole === 'OWNER'
  const who = mine ? `${message.author} (bạn)` : `${message.author} · Bộ phận hỗ trợ`
  const avatar = <span aria-hidden className="grid size-[22px] shrink-0 place-items-center rounded-full bg-chip text-[9px] font-semibold text-brand">{initials(message.author)}</span>
  return (
    <div data-message-side={mine ? 'owner' : 'cs'} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[88%] items-start gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
        {avatar}
        <div className={`min-w-0 ${mine ? 'text-right' : ''}`}>
          <p className="mb-0.5 text-[10px] font-medium leading-4 text-muted">{who}</p>
          <div className={`rounded-lg border p-3 ${mine ? 'border-[#bedbc6] bg-[#e8f4ec]' : 'border-rule bg-page'}`}>
            <p className={`m-0 whitespace-pre-wrap break-words text-xs text-ink ${mine ? 'text-right' : ''}`}>{message.text}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Chỉ tin nhắn PUBLIC (GBR-81): ticket của Chủ trại không mang ghi chú nội bộ. */
export function ConversationCard({
  ticket,
  onLoadOlder,
  composer,
}: {
  ticket: Ticket
  onLoadOlder: (beforeId: number) => Promise<MessagePage>
  composer?: ReactNode
}) {
  const [messages, setMessages] = useState(() => uniqueMessages(ticket.messages))
  const [beforeId, setBeforeId] = useState(ticket.messagesBeforeId ?? null)
  const [hasMore, setHasMore] = useState(ticket.messagesHasMore === true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const viewport = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMessages(uniqueMessages(ticket.messages))
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
        return uniqueMessages([...page.items, ...current])
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
    <Card variant="panel" title="Trao đổi">
      {hasMore && beforeId != null && (
        <div className="flex justify-center">
          <Button variant="link" size="sm" disabled={loading} onClick={loadOlder}>
            {loading ? 'Đang tải…' : 'Xem trao đổi trước'}
          </Button>
        </div>
      )}
      {error && <p role="alert" className="m-0 text-xs text-danger">{error}</p>}
      <div ref={viewport} data-testid="owner-chat-viewport" className="h-[480px] overflow-y-auto pr-1">
        <div className="flex flex-col gap-2.5">
          {messages.map((m) => (
            <Bubble key={messageKey(m)} message={m} />
          ))}
        </div>
      </div>
      {composer && <div className="border-t border-rule pt-3">{composer}</div>}
    </Card>
  )
}
