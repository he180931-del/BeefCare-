import { useState } from 'react'
import { Field, Modal, ModalButton, ModalFooter, Note, NoticeDialog, Textarea } from '../../../shared/ui'
import { statusToast } from '../domain/healthMessages'
import { fmtDate, OUTCOME_LABEL } from '../domain/healthFormat'
import { useHealthCaseCommands } from '../hooks/useHealthCaseCommands'
import type { HealthCaseCard } from '../types'
import { hint, useDialogSave } from './healthUi'

/**
 * Popup "Mở lại ca" (D58) cho ca đã đóng Khỏi / Chết / Mất tích: lý do bắt buộc, ca về Đang mở. Ca Chết / Mất tích thì phiếu
 * xuất chờ Chủ trại xác nhận bị bác cùng lúc. Lỗi nhập liệu hiện dưới ô, lỗi điều kiện hiện popup.
 */
export default function ReopenCaseDialog({ card, cattleCode, onClose, onSaved }: { card: HealthCaseCard; cattleCode: string; onClose: () => void; onSaved: (message: string) => void }) {
  const { reopenCase } = useHealthCaseCommands()
  const [reason, setReason] = useState('')
  const form = useDialogSave()
  const lost = card.outcome === 'DIED' || card.outcome === 'MISSING'

  const save = () => form.run(async () => {
    onSaved(statusToast(await reopenCase(card.id, { expectedVersion: card.version, reason })))
  })

  return (
    <Modal title="Mở lại ca" sub={`Ca ${card.caseCode} · ${cattleCode} · đóng ${fmtDate(card.closedAt?.slice(0, 10) ?? '')} · ${card.outcome ? OUTCOME_LABEL[card.outcome] : ''}`} width={560} onClose={onClose}>
      {lost && <Note tone="warn">Phiếu xuất "Chết / mất" đang chờ xác nhận của {cattleCode} sẽ bị bác; bò tiếp tục ở trong đàn.</Note>}
      <Field label="Lý do mở lại *" id="rc-reason" hint={hint(form.errors.reason, 'Tối đa 500 ký tự')}>
        <Textarea id="rc-reason" rows={2} maxLength={500} value={reason} onChange={(e) => { setReason(e.target.value); form.clearError('reason') }} />
      </Field>
      {form.formError && <NoticeDialog message={form.formError} onClose={form.clearFormError} />}
      <ModalFooter>
        <ModalButton onClick={onClose}>Hủy</ModalButton>
        <ModalButton variant="primary" onClick={save} disabled={form.saving}>Mở lại ca</ModalButton>
      </ModalFooter>
    </Modal>
  )
}
