import { useState } from 'react'
import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { Badge, DateInput, Field, KV, Note, Textarea } from '../../../components/ui'
import { userFacingError } from '../../../api/userFacingError'
import { todayIso, validateAvailability } from '../domain/penRules'
import type { Pen, PenStatus } from '../../../types'

const ErrorText = ({ children }: { children: string }) => <span className="text-[11px] text-err-fg">{children}</span>
const statusBadge = (status: PenStatus) => (status === 'ACTIVE' ? <Badge tone="ok" className="!border-0">Đang hoạt động</Badge> : <Badge>Ngừng hoạt động</Badge>)

/**
 * Stop / Resume Pen popup (UC-FE04-04). The new status is always the opposite of the current one (field 3); the
 * effective date defaults to today and cannot be in the future; cattle in the pen stay where they are (R-04-04).
 */
export default function DisableModal({ barn, onConfirm, onClose, saving = false, saveError, today = todayIso() }: { barn: Pen; onConfirm: (status: PenStatus, note: { date: string; reason: string }) => void | Promise<void>; onClose: () => void; saving?: boolean; saveError?: unknown; today?: string }) {
  const isInactive = barn.status === 'INACTIVE'
  const nextStatus: PenStatus = isInactive ? 'ACTIVE' : 'INACTIVE'
  const [date, setDate] = useState(today)
  const [reason, setReason] = useState('')
  const [tried, setTried] = useState(false)
  const errors = validateAvailability(date, reason, today)
  const canConfirm = !errors.date && !errors.reason && !saving

  const confirm = () => {
    setTried(true)
    if (errors.date || errors.reason) return
    void onConfirm(nextStatus, { date, reason: reason.trim() })
  }

  return (
    <Modal
      width={560}
      title={`${isInactive ? 'Dùng lại chuồng' : 'Ngưng sử dụng chuồng'} – ${barn.code}`}
      sub={`${barn.name} · ${barn.count} con đang ở`}
      topTitle="Ngưng / dùng lại chuồng"
      onClose={onClose}
    >
      <div className="grid grid-cols-3 gap-4">
        <KV k="Chuồng">{barn.count} / {barn.capacity} con</KV>
        <KV k="Trạng thái hiện tại">{statusBadge(barn.status)}</KV>
        <KV k="Trạng thái mới">{statusBadge(nextStatus)}</KV>
      </div>

      <Field label="Ngày hiệu lực *">
        <DateInput value={date} onChange={setDate} />
        {(tried || date > today) && errors.date && <ErrorText>{errors.date}</ErrorText>}
      </Field>
      <Field label="Lý do *">
        <Textarea rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} className="h-[64px]" placeholder="Tối đa 500 ký tự" />
        {tried && errors.reason && <ErrorText>{errors.reason}</ErrorText>}
      </Field>

      <Note tone="warn">
        {nextStatus === 'INACTIVE'
          ? 'Chuồng ngưng sử dụng không nhận bò mới; bò đang ở vẫn giữ nguyên cho đến khi chuyển đi.'
          : 'Chuồng dùng lại sẽ nhận bò mới theo tiêu chí nhận bò hiện hành.'}
      </Note>

      <ModalFooter>
        <div className="mr-auto min-w-0 flex-1" role="status" aria-live="polite">
          {Boolean(saveError) && <span className="text-sm text-err-fg">{userFacingError(saveError, 'Không đổi được trạng thái chuồng. Vui lòng thử lại.')}</span>}
        </div>
        <ModalButton className="text-ink" onClick={onClose} disabled={saving}>Hủy</ModalButton>
        <ModalButton variant="primary" disabled={!canConfirm} onClick={confirm}>
          {saving ? 'Đang lưu…' : 'Xác nhận'}
        </ModalButton>
      </ModalFooter>
    </Modal>
  )
}
