import type { ReactNode } from 'react'
import Modal, { ModalButton, ModalFooter } from './Modal'

/**
 * Popup báo một thao tác không thực hiện được vì **điều kiện nghiệp vụ** (bò đang chờ xác nhận chết / mất, lịch đã khóa,
 * dữ liệu vừa bị người khác thay đổi…). Lỗi nhập dữ liệu sai vẫn hiện chữ đỏ dưới đúng ô, không dùng popup này.
 */
export default function NoticeDialog({ title = 'Không thực hiện được', message, onClose }: { title?: string; message: ReactNode; onClose: () => void }) {
  return (
    <Modal title={title} width={560} onClose={onClose}>
      <div role="alert" className="m-0 text-sm leading-relaxed text-ink">{message}</div>
      <ModalFooter>
        <ModalButton variant="primary" onClick={onClose}>Đã hiểu</ModalButton>
      </ModalFooter>
    </Modal>
  )
}
