// @ts-nocheck
import { useState } from 'react'
import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { Field, Textarea } from '../../../components/ui'

// Figma không vẽ modal này: dựng cùng kiểu modal 560 của hệ thống.
export default function RejectModal({ row, onClose, onRejected }) {
  const [rejectReason, setRejectReason] = useState('')
  return (
    <Modal width={560} title="Bác đề xuất xuất đàn" sub={`Phiếu ${row.id} · bò vẫn ACTIVE, ca sức khỏe giữ nguyên kết quả`} onClose={onClose}>
      <Field label="Lý do bác *">
        <Textarea className="!leading-[normal] h-14" rows={1} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
      </Field>
      <ModalFooter>
        <ModalButton className="text-ink" onClick={onClose}>Đóng</ModalButton>
        <ModalButton variant="danger" disabled={!rejectReason.trim()} onClick={() => onRejected(rejectReason.trim())}>Bác đề xuất</ModalButton>
      </ModalFooter>
    </Modal>
  )
}
// @ts-nocheck
