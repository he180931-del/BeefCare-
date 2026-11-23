import { useRef, useState } from 'react'
import { Field, Info, Modal, ModalButton, ModalFooter, Note, Textarea } from '../../../shared/ui'
import { dmy } from '../../../shared/lib/format'
import { herdEntryError } from '../api/herdEntryError'
import type { EntryCalf } from '../types'

export default function CalfDeathModal({ calf, onConfirm, onClose }: {
  calf: EntryCalf; onConfirm: (reason: string) => Promise<void>; onClose: () => void
}) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const inFlight = useRef(false)
  const valid = reason.trim().length > 0 && reason.trim().length <= 500
  const submit = async () => {
    if (!valid || inFlight.current) return
    inFlight.current = true; setBusy(true); setError(null)
    try { await onConfirm(reason.trim()) }
    catch (failure) { setError(failure) }
    finally { inFlight.current = false; setBusy(false) }
  }
  return <Modal width={600} title="Đánh dấu bê chết trước khi đăng ký" onClose={() => { if (!inFlight.current) onClose() }}>
    <Info items={[[ 'Bê', [calf.name, calf.tag].filter(Boolean).join(' · ') ], ['Mẹ', calf.mother || 'Không rõ'], ['Ngày sinh', dmy(calf.born)]]} />
    <Note tone="warn">Không hoàn tác được. Bê sẽ rời danh sách chờ và không được đăng ký vào đàn.</Note>
    <Field label="Lý do *" id="calf-death-reason">
      <Textarea id="calf-death-reason" aria-label="Lý do" maxLength={500} disabled={busy} value={reason} onChange={event => setReason(event.target.value)} />
    </Field>
    <p className="m-0 text-xs text-muted">Bắt buộc, tối đa 500 ký tự.</p>
    {Boolean(error) && <Note tone="err">{herdEntryError(error)}</Note>}
    <ModalFooter><ModalButton disabled={busy} onClick={onClose}>Hủy</ModalButton><ModalButton variant="danger" disabled={busy || !valid} onClick={() => { void submit() }}>Xác nhận</ModalButton></ModalFooter>
  </Modal>
}
