import { useState } from 'react'
import { Field, Modal, ModalButton, ModalFooter, Textarea } from '../../../shared/ui'
import type { HerdExit } from '../types'
import { VoucherCommandError } from '../../../shared/ui/VoucherCommandError'

// Figma không vẽ modal này: dựng cùng kiểu modal 560 của hệ thống.
export default function RejectModal({ row, onClose, onRejected, error, onReload }: { row: HerdExit; onClose: () => void; onRejected: (reason: string) => void; error?: unknown; onReload: () => Promise<unknown> }) {
  const [rejectReason, setRejectReason] = useState('')
  return (
    <Modal width={560} title="Bác đề xuất xuất đàn" sub={`Phiếu ${row.id} · bò vẫn trong đàn, ca sức khỏe được mở lại`} onClose={onClose}>
      <Field label="Lý do bác *">
        <Textarea className="!leading-[normal] h-14" rows={1} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
      </Field>
      <VoucherCommandError error={error} onReload={onReload} />
      <ModalFooter>
        <ModalButton className="text-ink" onClick={onClose}>Đóng</ModalButton>
        <ModalButton variant="danger" disabled={!rejectReason.trim()} onClick={() => onRejected(rejectReason.trim())}>Bác đề xuất</ModalButton>
      </ModalFooter>
    </Modal>
  )
}
