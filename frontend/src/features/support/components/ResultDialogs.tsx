import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { Info, Note } from '../../../components/ui'
import { Icon } from '../../../components/Icon'
import { formatDateTime } from '../domain/format'
import { plainStatus } from '../domain/ticketRules'
import type { ResolutionView, Ticket } from '../types'

const lastAcknowledged = (t: Ticket): ResolutionView | undefined => [...t.resolutions].filter((r) => r.acknowledged).sort((a, b) => b.version - a.version)[0]

/** MSG-FE20-03: đã ghi nhận xác nhận kết quả. Phiếu vẫn ở Đã giải quyết cho tới khi CS đóng (GBR-80). */
export function ConfirmedDialog({ ticket, onReopen, onBack, onClose }: { ticket: Ticket; onReopen: () => void; onBack: () => void; onClose: () => void }) {
  const ack = lastAcknowledged(ticket)
  if (!ack) return null
  const message = [...ticket.messages].reverse().find((m) => m.kind === 'ACKNOWLEDGMENT')
  return (
    <Modal title="Bạn đã xác nhận kết quả" sub={ticket.code} width={560} onClose={onClose}>
      <p className="m-0 mb-3 text-[13px] text-ink">Cảm ơn bạn. Xác nhận kết quả phiên bản {ack.version} của bạn đã được ghi nhận.</p>
      <Info
        cols={2}
        items={[
          ['Trạng thái', plainStatus(ticket).label.toUpperCase()],
          ['Áp dụng cho', `Kết quả phiên bản ${ack.version}`],
          ['Xác nhận bởi', ticket.requester],
          ['Thời điểm', formatDateTime(ack.acknowledgedAt ?? ticket.updatedAt)],
          ...(message ? [['Mã tin nhắn', message.code]] : []),
        ]}
      />
      <div className="mt-3">
        <Note tone="info">Giữ Đã giải quyết; nhân viên hỗ trợ sẽ xem xác nhận trước khi đóng.</Note>
      </div>
      <ModalFooter>
        {ticket.status === 'RESOLVED' && (
          <ModalButton onClick={onReopen}>
            <Icon name="refresh" size={16} /> Mở lại kèm lý do
          </ModalButton>
        )}
        <ModalButton variant="primary" onClick={onBack}>
          <Icon name="arrow-left" size={16} /> Về yêu cầu
        </ModalButton>
      </ModalFooter>
    </Modal>
  )
}

/** MSG-FE20-06: ticket đã đóng, chỉ đọc. */
export function ClosedDialog({ ticket, onList, onNew, onClose }: { ticket: Ticket; onList: () => void; onNew: () => void; onClose: () => void }) {
  const closure = [...ticket.history].reverse().find((e) => e.event === 'CLOSED')
  if (!closure) return null
  const ack = lastAcknowledged(ticket)
  return (
    <Modal title={`Yêu cầu ${ticket.code} đã đóng`} width={560} onClose={onClose}>
      <p className="m-0 mb-3 text-[13px] text-ink">Yêu cầu này đã đóng và chỉ đọc. Hãy tạo yêu cầu mới nếu bạn cần hỗ trợ thêm.</p>
      <Info
        cols={2}
        items={[
          ['Trạng thái', 'ĐÃ ĐÓNG'],
          ['Kết quả đã xác nhận', ack ? `Phiên bản ${ack.version}` : 'Chưa có'],
          ['Người đóng', closure.actor],
          ['Thời điểm', formatDateTime(closure.at)],
        ]}
      />
      <ModalFooter>
        <ModalButton onClick={onList}>Danh sách yêu cầu</ModalButton>
        <ModalButton variant="primary" onClick={onNew}>
          <Icon name="circle-plus" size={16} /> Tạo yêu cầu mới
        </ModalButton>
      </ModalFooter>
    </Modal>
  )
}

/** MSG-FE20-05: CS vừa ghi kết quả mới hơn phiên bản đang xem. */
export function ResultChangedDialog({ ticket, onReload, onClose }: { ticket: Ticket; onReload: () => void; onClose: () => void }) {
  return (
    <Modal title="Kết quả đã thay đổi" sub={ticket.code} width={560} onClose={onClose}>
      <p className="m-0 text-[13px] text-ink">Yêu cầu vừa có kết quả mới hơn phiên bản bạn đang xem.</p>
      <ModalFooter>
        <ModalButton variant="primary" onClick={onReload}>
          <Icon name="refresh" size={16} /> Tải lại yêu cầu
        </ModalButton>
      </ModalFooter>
    </Modal>
  )
}
