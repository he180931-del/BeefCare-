import { Button, Card, Note } from '../../../components/ui'
import { Icon } from '../../../components/Icon'
import { formatDateTime } from '../domain/format'
import { latestResolution } from '../domain/ticketRules'
import type { Ticket } from '../types'

interface Props {
  ticket: Ticket
  busy: boolean
  onConfirm: () => void
  onReopen: () => void
  onViewVersion: (version: number) => void
}

/** Kết quả giải quyết mới nhất + xác nhận / mở lại (UC-FE20-04, UC-FE20-05). Các phiên bản cũ chỉ đọc. */
export function ResolutionCard({ ticket, busy, onConfirm, onReopen, onViewVersion }: Props) {
  const latest = latestResolution(ticket)
  if (!latest) return null
  const resolved = ticket.status === 'RESOLVED'
  const reopened = ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED'
  const older = ticket.resolutions.filter((r) => r.version < latest.version).sort((a, b) => b.version - a.version)
  return (
    <Card title={`Kết quả giải quyết · phiên bản ${latest.version}`}>
      <div className="flex flex-col gap-3">
        <p className="m-0 text-xs text-muted">
          {latest.resolvedBy} · {formatDateTime(latest.resolvedAt)}
        </p>
        <p className="m-0 whitespace-pre-wrap break-words text-[13px] text-ink">{latest.content}</p>
        {resolved && latest.acknowledged && (
          <Note tone="ok">Bạn đã xác nhận kết quả này lúc {formatDateTime(latest.acknowledgedAt ?? ticket.updatedAt)}. Bộ phận hỗ trợ sẽ xem xác nhận trước khi đóng yêu cầu.</Note>
        )}
        {resolved && !latest.acknowledged && <Note tone="grey">Xác nhận không tự đóng yêu cầu; bộ phận hỗ trợ sẽ xem xác nhận của bạn trước khi đóng.</Note>}
        {reopened && <Note tone="warn">Yêu cầu đã được mở lại; xác nhận cho kết quả phiên bản {latest.version} không còn hiệu lực.</Note>}
        {ticket.status === 'CLOSED' && latest.acknowledged && <Note tone="grey">Yêu cầu đã đóng với kết quả phiên bản {latest.version} mà bạn đã xác nhận.</Note>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap [&>button]:w-full sm:[&>button]:w-auto">
          {resolved && (
            <Button onClick={onReopen} disabled={busy}>
              <Icon name="refresh" size={16} /> Mở lại kèm lý do
            </Button>
          )}
          {resolved && !latest.acknowledged && (
            <Button variant="primary" onClick={onConfirm} disabled={busy}>
              Xác nhận đã giải quyết
            </Button>
          )}
          {!resolved && <Button onClick={() => onViewVersion(latest.version)}>Xem kết quả phiên bản {latest.version}</Button>}
        </div>
        {older.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {older.map((r) => (
              <Button key={r.version} variant="link" size="sm" onClick={() => onViewVersion(r.version)}>
                Xem kết quả phiên bản {r.version}
              </Button>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}
