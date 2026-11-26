import { useState } from 'react'
import { Button, Icon, Note, Pagination, Table, Td, Th } from '../../../shared/ui'
import { formatDateTime } from '../domain/format'
import { latestResolution } from '../domain/ticketRules'
import type { Ticket } from '../types'

interface Props {
  ticket: Ticket
  busy: boolean
  onConfirm: () => void
  onReopen: () => void
}

/** Bảng chi tiết toàn bộ phiên kết quả + hành động cho phiên mới nhất (UC-FE20-04, UC-FE20-05). */
export function ResolutionCard({ ticket, busy, onConfirm, onReopen }: Props) {
  const [page, setPage] = useState(1)
  const latest = latestResolution(ticket)
  if (!latest) return null
  const resolved = ticket.status === 'RESOLVED'
  const reopened = ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED'
  const rows = [...ticket.resolutions].sort((a, b) => b.version - a.version)
  const pageSize = 10
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const visibleRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize)
  return (
    <section aria-labelledby="resolution-table-title" className={resolved ? 'rounded-lg bg-[#eef4ef] p-4' : ''}>
      <h2 id="resolution-table-title" className="m-0 text-base font-semibold text-ink">Các phiên kết quả</h2>
      <div className="flex flex-col gap-3">
        <div role="region" aria-label="Danh sách kết quả giải quyết" className="max-h-[420px] overflow-y-auto [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10">
          <Table variant="panel" stack={false} bordered={false}>
            <thead><tr><Th>Phiên bản</Th><Th>Thời gian</Th><Th>Người xử lý</Th><Th>Kết quả</Th><Th>Chi tiết</Th><Th>Xác nhận</Th><Th>Ghi chú xác nhận</Th></tr></thead>
            <tbody>
              {visibleRows.map((resolution) => (
                <tr key={resolution.id}>
                  <Td className="whitespace-nowrap border-b-0">{resolution.version}</Td>
                  <Td className="whitespace-nowrap border-b-0">{formatDateTime(resolution.resolvedAt)}</Td>
                  <Td className="whitespace-nowrap border-b-0">{resolution.resolvedBy}</Td>
                  <Td className="border-b-0">{resolution.version === latest.version && resolved ? 'Đã giải quyết' : `Kết quả phiên bản ${resolution.version}`}</Td>
                  <Td className="whitespace-pre-wrap break-words border-b-0">{resolution.content}</Td>
                  <Td className="border-b-0">{resolution.acknowledged ? `Đã xác nhận${resolution.acknowledgedAt ? ` · ${formatDateTime(resolution.acknowledgedAt)}` : ''}` : 'Chưa xác nhận'}</Td>
                  <Td className="whitespace-pre-wrap break-words border-b-0">{resolution.acknowledgmentComment ?? '—'}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
        {pageCount > 1 && <Pagination page={safePage} pageCount={pageCount} onChange={setPage} summary={`Hiển thị ${visibleRows.length} / ${rows.length} kết quả`} />}
        {resolved && latest.acknowledged && (
          <Note tone="ok">Bạn đã xác nhận kết quả này lúc {formatDateTime(latest.acknowledgedAt ?? ticket.updatedAt)}. Bộ phận hỗ trợ sẽ xem xác nhận trước khi đóng yêu cầu.</Note>
        )}
        {resolved && !latest.acknowledged && <Note tone="grey">Xác nhận không tự đóng yêu cầu; bộ phận hỗ trợ sẽ xem xác nhận của bạn trước khi đóng.</Note>}
        {reopened && <Note tone="warn">Yêu cầu đã được mở lại; xác nhận cho kết quả phiên bản {latest.version} không còn hiệu lực.</Note>}
        {ticket.status === 'CLOSED' && latest.acknowledged && <Note tone="grey">Yêu cầu đã đóng với kết quả phiên bản {latest.version} mà bạn đã xác nhận.</Note>}
        <div className="flex flex-wrap gap-2 [&>button]:w-full @min-[440px]:[&>button]:w-auto">
          {resolved && (
            <Button variant="onDark" size="bento" onClick={onReopen} disabled={busy}>
              <Icon name="refresh" size={16} /> Mở lại kèm lý do
            </Button>
          )}
          {resolved && !latest.acknowledged && (
            <Button variant="onDarkPrimary" size="bento" onClick={onConfirm} disabled={busy}>
              Xác nhận đã giải quyết
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}
