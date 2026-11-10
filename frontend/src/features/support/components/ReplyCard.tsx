import { useState } from 'react'
import { Button, Card, Note, Textarea } from '../../../components/ui'
import { Icon } from '../../../components/Icon'
import { canReply, REPLY_MAX, validateReply } from '../domain/ticketRules'
import type { Ticket } from '../types'
import { FieldError } from './FieldError'
import type { ActionResult } from './useTicketActions'

/** Phản hồi công khai (UC-FE20-03). Phiếu đã đóng chỉ đọc (MSG-FE20-06). */
export function ReplyCard({ ticket, onSend }: { ticket: Ticket; onSend: (content: string) => Promise<ActionResult> }) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const closed = !canReply(ticket)

  const submit = async () => {
    setSent(false)
    const invalid = validateReply(text)
    if (invalid) return setError(invalid)
    setSending(true)
    const result = await onSend(text.trim())
    setSending(false)
    if (result.ok) {
      setText('')
      setError(null)
      setSent(true)
    } else setError(result.message)
  }

  return (
    <Card title="Phản hồi">
      <div className="flex flex-col gap-3">
        {closed && <Note tone="grey">Yêu cầu hỗ trợ này đã đóng và chỉ đọc. Hãy tạo yêu cầu mới nếu bạn cần hỗ trợ thêm.</Note>}
        <div>
          <Textarea
            id="tk-reply"
            aria-label="Phản hồi công khai"
            rows={3}
            disabled={closed}
            placeholder="Viết phản hồi công khai…"
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setError(null)
            }}
          />
          <FieldError>{error}</FieldError>
          <p className="m-0 mt-1 text-right text-[11px] text-faint">
            {text.length.toLocaleString('vi-VN')}/{REPLY_MAX.toLocaleString('vi-VN')}
          </p>
        </div>
        {sent && <Note tone="ok">Phản hồi của bạn đã được gửi.</Note>}
        <div className="flex sm:justify-end [&>button]:w-full sm:[&>button]:w-auto">
          <Button variant="primary" onClick={submit} disabled={closed || sending}>
            <Icon name="send" size={16} /> Gửi
          </Button>
        </div>
      </div>
    </Card>
  )
}
