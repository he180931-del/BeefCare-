import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { Info } from '../../../components/ui'
import { fmtDate } from '../domain/healthFormat'
import type { PendingExit } from '../types'

/** MSG-FE10-05: hiện sau khi đóng ca Chết hoặc Mất tích. */
export default function DeathNoticeDialog({ voucher, onClose }: { voucher: PendingExit; onClose: () => void }) {
  return (
    <Modal title="Đã tạo phiếu xuất chờ xác nhận" sub={`Ca ${voucher.caseCode} đã đóng với kết quả ${voucher.type === 'DEATH' ? 'Chết' : 'Mất tích'}`} width={560} onClose={onClose}>
      <p className="m-0 text-sm text-ink">Hệ thống đã tạo phiếu xuất "Chết / mất" ở trạng thái chờ cho Chủ trại. {voucher.cattleCode} vẫn ở trạng thái hoạt động cho đến khi Chủ trại xác nhận.</p>
      <Info cols={2} items={[['Bò', voucher.cattleCode], ['Loại phiếu', voucher.type === 'DEATH' ? 'Chết' : 'Khác – Mất tích'], ['Ngày', fmtDate(voucher.date)], ['Người báo', voucher.reportedBy]]} />
      <ModalFooter><ModalButton variant="primary" onClick={onClose}>Đã hiểu</ModalButton></ModalFooter>
    </Modal>
  )
}
