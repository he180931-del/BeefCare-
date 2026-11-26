import { useState } from 'react'
import { Button, Card, Icon, inputCls, Note } from '../../../shared/ui'
import { canReply } from '../domain/ticketRules'
import { validateReply } from '../validation/ticketValidation'
import type { Ticket } from '../types'
import { FieldError } from './FieldError'
import type { ActionResult } from '../hooks/useTicketActions'

/** Phản hồi công khai (UC-FE20-03). Phiếu đã đóng chỉ đọc (MSG-FE20-06). */
export function ReplyCard({ ticket, onSend, embedded = false }: { ticket: Ticket; onSend: (content: string) => Promise<ActionResult>; embedded?: boolean }) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [files, setFiles] = useState<File[]>([])
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

  const composer = (
    <div className="flex flex-col gap-3">
        {closed && <Note tone="grey">Yêu cầu này đã đóng và chỉ đọc. Hãy tạo yêu cầu mới nếu bạn cần hỗ trợ thêm.</Note>}
        <div className="flex items-center gap-3">
          <input
            id="tk-reply"
            aria-label="Phản hồi công khai"
            className={inputCls}
            disabled={closed}
            placeholder="Viết phản hồi công khai…"
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setError(null)
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void submit() } }}
          />
          <label htmlFor="reply-attachment" className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-field bg-white px-3 py-2 text-xs font-semibold text-ink ${closed ? 'pointer-events-none opacity-45' : ''}`}><Icon name="upload" size={14} /> Đính kèm tệp
            <input id="reply-attachment" aria-label="Đính kèm tệp" type="file" accept="application/pdf,image/jpeg,image/png" multiple disabled={closed} className="sr-only" onChange={(event) => setFiles(Array.from(event.target.files ?? []))} />
          </label>
          <Button variant="primary" size="bento" onClick={submit} disabled={closed || sending}><Icon name="send" size={16} /> Gửi</Button>
        </div>
        <FieldError>{error}</FieldError>
        {files.length > 0 && <ul aria-label="Tệp đính kèm đã chọn" className="m-0 flex list-none flex-col gap-1 p-0 text-xs text-muted">{files.map((file) => <li key={`${file.name}${file.lastModified}`} className="flex items-center gap-1.5"><Icon name="upload" size={14} />{file.name}</li>)}</ul>}
        {sent && <Note tone="ok">Phản hồi của bạn đã được gửi.</Note>}
    </div>
  )

  return embedded ? composer : <Card variant="panel" title="Phản hồi">{composer}</Card>
}
