import { useState } from 'react'
import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { Field, inputCls, Note, Textarea } from '../../../components/ui'
import { Icon } from '../../../components/Icon'
import { plainStatus, REASON_MAX, validateReason, latestResolution } from '../domain/ticketRules'
import type { ResolutionView, Ticket } from '../types'
import { FieldError } from './FieldError'
import type { ActionResult } from './useTicketActions'

const ReadOnly = ({ id, label, value }: { id: string; label: string; value: string }) => (
  <Field label={label} id={id}>
    <input id={id} readOnly className={`${inputCls} bg-page text-muted`} value={value} />
  </Field>
)

/** UC-FE20-05: mở lại phiếu đã giải quyết, lý do bắt buộc (tối đa 1.000 ký tự). */
export function ReopenDialog({ ticket, resolution, onSubmit, onClose }: { ticket: Ticket; resolution: ResolutionView; onSubmit: (reason: string) => Promise<ActionResult>; onClose: () => void }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const submit = async () => {
    const invalid = validateReason(reason)
    if (invalid) return setError(invalid)
    setSending(true)
    const result = await onSubmit(reason.trim())
    setSending(false)
    if (!result.ok) setError(result.message)
  }
  return (
    <Modal title={`Mở lại ticket ${ticket.code}`} sub={`Kết quả phiên bản ${resolution.version}`} width={640} onClose={onClose}>
      <div className="flex flex-col gap-3.5">
        <ReadOnly id="reopen-current" label="Ticket / kết quả hiện tại" value={`${ticket.code} · ${plainStatus(ticket).label} · kết quả v${resolution.version}`} />
        <Field label="Lý do mở lại *" id="reopen-reason" hint={`Tối đa ${REASON_MAX.toLocaleString('vi-VN')} ký tự`}>
          <Textarea
            id="reopen-reason"
            rows={3}
            placeholder="Nhập lý do mở lại ticket…"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value)
              setError(null)
            }}
          />
          <FieldError>{error}</FieldError>
        </Field>
        <Note tone="warn">Lý do là bắt buộc. Mở lại đưa ticket về Đang mở, giữ CS phụ trách và lịch sử; xác nhận cho kết quả v{resolution.version} không còn hiệu lực.</Note>
      </div>
      <ModalFooter>
        <ModalButton onClick={onClose}>
          <Icon name="arrow-left" size={16} /> Quay lại
        </ModalButton>
        <ModalButton variant="primary" onClick={submit} disabled={sending}>
          Xác nhận mở lại
        </ModalButton>
      </ModalFooter>
    </Modal>
  )
}

/** MSG-FE20-04: đã mở lại, lý do được giữ trong lịch sử. */
export function ReopenedDialog({ ticket, onViewPrevious, onClose }: { ticket: Ticket; onViewPrevious: (version: number) => void; onClose: () => void }) {
  const reopen = [...ticket.history].reverse().find((e) => e.event === 'REOPENED')
  if (!reopen) return null
  const latest = latestResolution(ticket)
  const state = plainStatus(ticket).label
  return (
    <Modal title={`Ticket ${ticket.code} đã mở lại`} width={640} onClose={onClose}>
      <div className="flex flex-col gap-3.5">
        <ReadOnly id="reopened-status" label="Trạng thái" value={`${state} · ${ticket.assignedCs ? `${ticket.assignedCs} tiếp tục phụ trách` : 'quay lại hàng chờ của bộ phận hỗ trợ'}`} />
        <ReadOnly id="reopened-reason" label="Lý do đã lưu" value={reopen.reason ?? ''} />
        <Note tone="info">
          {latest ? `Kết quả v${latest.version} và trao đổi công khai` : 'Trao đổi công khai'} được giữ trong lịch sử. Xác nhận cũ đã mất hiệu lực; CS tiếp tục xử lý ticket {state}.
        </Note>
      </div>
      {latest && (
        <ModalFooter>
          <ModalButton onClick={() => onViewPrevious(latest.version)}>Xem kết quả trước</ModalButton>
        </ModalFooter>
      )}
    </Modal>
  )
}

/** Xem lại một phiên bản kết quả cũ: chỉ đọc, không dùng để xác nhận hay đóng. */
export function ResolutionVersionDialog({ ticket, version, onClose }: { ticket: Ticket; version: number; onClose: () => void }) {
  const resolution = ticket.resolutions.find((r) => r.version === version)
  if (!resolution) return null
  const latest = latestResolution(ticket)
  const superseded = !!latest && version < latest.version
  const open = ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED'
  return (
    <Modal title={`Lịch sử kết quả v${version} · ${ticket.code}`} width={640} onClose={onClose}>
      <div className="flex flex-col gap-3.5">
        <ReadOnly id="version-status" label="Trạng thái" value={`${plainStatus(ticket).label} · Kết quả v${version} được lưu trong lịch sử`} />
        <Field label="Kết quả công khai" id="version-content" hint={`${resolution.resolvedBy} · ${resolution.resolvedAt.slice(8, 10)}/${resolution.resolvedAt.slice(5, 7)}/${resolution.resolvedAt.slice(0, 4)}`}>
          <Textarea id="version-content" readOnly rows={3} className="bg-page text-muted" value={resolution.content} />
        </Field>
        <Note tone="warn">
          {superseded
            ? `Kết quả v${version} đã được thay bằng phiên bản ${latest!.version}. Chỉ đọc; không thể xác nhận hoặc đóng ticket bằng phiên bản cũ.`
            : open
              ? `Ticket đã được Chủ trại mở lại. Kết quả v${version} chỉ đọc; không thể xác nhận hoặc đóng ticket bằng xác nhận cũ.`
              : `Kết quả v${version} chỉ đọc.`}
        </Note>
      </div>
      <ModalFooter>
        <ModalButton onClick={onClose}>
          <Icon name="arrow-left" size={16} /> {open ? 'Về ticket đang mở' : 'Về ticket'}
        </ModalButton>
      </ModalFooter>
    </Modal>
  )
}
