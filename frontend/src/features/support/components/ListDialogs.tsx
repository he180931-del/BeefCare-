import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { Info } from '../../../components/ui'
import { Icon } from '../../../components/Icon'
import { categoryLabel, plainStatus, PRIORITY_LABELS } from '../domain/ticketRules'
import type { Ticket } from '../types'

/** MSG-FE20-01: ticket đã gửi, trạng thái mới nhận. */
export function SubmittedDialog({ ticket, onList, onView, onClose }: { ticket: Ticket; onList: () => void; onView: () => void; onClose: () => void }) {
  return (
    <Modal title={`Đã gửi yêu cầu ${ticket.code}`} width={560} onClose={onClose}>
      <p className="m-0 mb-3 text-[13px] text-ink">
        Yêu cầu {ticket.code} đã được gửi. Bộ phận hỗ trợ sẽ trả lời ngay trong yêu cầu.
      </p>
      <Info
        cols={2}
        items={[
          ['Trạng thái', plainStatus(ticket).label.toUpperCase()],
          ['Ưu tiên', PRIORITY_LABELS[ticket.priority]],
          ['Danh mục', categoryLabel(ticket.category)],
          ['Phạm vi', ticket.farmName ?? 'Vấn đề tài khoản (không gắn trại)'],
        ]}
      />
      <ModalFooter>
        <ModalButton onClick={onList}>Danh sách yêu cầu</ModalButton>
        <ModalButton variant="primary" onClick={onView}>
          Xem yêu cầu
        </ModalButton>
      </ModalFooter>
    </Modal>
  )
}

export function LoadErrorDialog({ message, onRetry, onClose }: { message: string; onRetry: () => void; onClose: () => void }) {
  return (
    <Modal title="Chưa tải được dữ liệu" width={560} onClose={onClose}>
      <p className="m-0 text-[13px] text-ink">{message}</p>
      <ModalFooter>
        <ModalButton variant="primary" onClick={onRetry}>
          <Icon name="refresh" size={16} /> Thử lại
        </ModalButton>
      </ModalFooter>
    </Modal>
  )
}
