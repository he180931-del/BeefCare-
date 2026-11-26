import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Checkbox, Field, Icon, inputCls, Modal, ModalButton, ModalFooter, Note, Select, Textarea } from '../../../shared/ui'
import { INTERNAL_CANCEL_ON_TICKET_CLOSE_REASON, ROLE_LABEL, closeConditions, defaultInternalRequestRole, formatStamp, internalRequestRoles, openIrOf } from '../domain/supportRules'
import type { InternalView, TargetRole, Ticket } from '../types'
import { FieldError, useActor, useSubmit } from './common'
import { useSupportCs, useSupportRecipients } from '../hooks/usePlatformSupportUseCase'

const Back = ({ onClick }: { onClick: () => void }) => <ModalButton onClick={onClick}><Icon name="arrow-left" size={16} /> Quay lại</ModalButton>

export function HandOverDialog({ onSubmit, onClose }: { onSubmit: (toCsId: number, reason: string) => Promise<void>; onClose: () => void }) {
  const me = useActor()
  const { data } = useSupportCs()
  const options = (data ?? []).filter((c) => c.available && c.id !== me.id)
  const [to, setTo] = useState('')
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<{ to?: string; reason?: string }>({})
  const { busy, error, run } = useSubmit()
  const submit = () => {
    const next = { to: to ? undefined : 'Nhân viên hỗ trợ nhận là bắt buộc.', reason: reason.trim() ? undefined : 'Lý do chuyển giao là bắt buộc.' }
    setErrors(next)
    if (next.to || next.reason) return
    void run(() => onSubmit(Number(to), reason.trim()))
  }
  return (
    <Modal title="Chuyển giao yêu cầu" width={640} onClose={onClose}>
      <Field label="Nhân viên hỗ trợ nhận *" id="ho-to">
        <Select id="ho-to" value={to} onChange={(e) => setTo(e.target.value)}>
          <option value="">Chọn nhân viên hỗ trợ đang khả dụng</option>
          {options.map((c) => <option key={c.id} value={c.id}>{c.name} · đang khả dụng</option>)}
        </Select>
        <FieldError>{errors.to}</FieldError>
      </Field>
      <Field label="Lý do chuyển giao *" id="ho-reason">
        <Textarea id="ho-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Bàn giao ca làm việc" />
        <FieldError>{errors.reason}</FieldError>
      </Field>
      <Note tone="info">Giữ nguyên trạng thái yêu cầu và người nhận của yêu cầu nội bộ; kết quả được chuyển về nhân viên hỗ trợ phụ trách mới.</Note>
      {error && <Note tone="err">{error}</Note>}
      <ModalFooter><Back onClick={onClose} /><ModalButton variant="primary" onClick={submit} disabled={busy}>Xác nhận chuyển giao</ModalButton></ModalFooter>
    </Modal>
  )
}

export function CreateInternalDialog({ ticket, initialRole, onSubmit, onViewExisting, onClose }: {
  ticket: Ticket
  initialRole: TargetRole
  onSubmit: (cmd: { targetRole: TargetRole; recipientId: number; requestText: string }) => Promise<void>
  onViewExisting: (ir: InternalView) => void
  onClose: () => void
}) {
  const allowedRoles = internalRequestRoles(ticket.category)
  const initialAllowedRole = allowedRoles.includes(initialRole) ? initialRole : defaultInternalRequestRole(ticket.category)
  const [role, setRole] = useState<TargetRole>(initialAllowedRole)
  const { data } = useSupportRecipients(role)
  const [recipient, setRecipient] = useState('')
  const [requestText, setRequestText] = useState('')
  const [errors, setErrors] = useState<{ recipient?: string; requestText?: string }>({})
  const { busy, error, run } = useSubmit()
  const existing = openIrOf(ticket, role)
  const stateOk = ticket.status === 'IN_PROGRESS' || ticket.status === 'WAITING_CUSTOMER'
  const submit = () => {
    const next = { recipient: recipient ? undefined : 'Người nhận cụ thể là bắt buộc.', requestText: requestText.trim() ? undefined : 'Nội dung yêu cầu là bắt buộc.' }
    setErrors(next)
    if (next.recipient || next.requestText) return
    void run(() => onSubmit({ targetRole: role, recipientId: Number(recipient), requestText: requestText.trim() }))
  }
  return (
    <Modal title="Tạo yêu cầu nội bộ" width={640} onClose={onClose}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Vai trò đích *" id="ir-role">
          <Select id="ir-role" value={role} onChange={(e) => { setRole(e.target.value as TargetRole); setRecipient('') }}>
            {allowedRoles.map((targetRole) => <option key={targetRole} value={targetRole}>{ROLE_LABEL[targetRole]}</option>)}
          </Select>
        </Field>
        <Field label="Người nhận cụ thể *" id="ir-to">
          <Select id="ir-to" value={recipient} onChange={(e) => setRecipient(e.target.value)}>
            <option value="">Chọn người nhận</option>
            {(data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name} · {s.role} đang khả dụng</option>)}
          </Select>
          <FieldError>{errors.recipient}</FieldError>
        </Field>
      </div>
      <Field label="Nội dung yêu cầu *" id="ir-q">
        <Textarea id="ir-q" value={requestText} onChange={(e) => setRequestText(e.target.value)} placeholder="Kiểm tra Thanh toán BCF7K2Q9 và chứng từ mã chưa khớp" />
        <FieldError>{errors.requestText}</FieldError>
      </Field>
      {existing && <Note tone="info">Mỗi yêu cầu chỉ có một yêu cầu nội bộ đang mở cho mỗi vai trò. Hiện {existing.code} đã mở: cần xử lý yêu cầu hiện có trước khi tạo thêm.</Note>}
      {!stateOk && <Note tone="warn">Chỉ tạo khi yêu cầu đang Đang xử lý / Chờ khách phản hồi. Không thay đổi trạng thái yêu cầu.</Note>}
      {error && <Note tone="err">{error}</Note>}
      <ModalFooter>
        <Back onClick={onClose} />
        {existing
          ? <ModalButton variant="primary" onClick={() => onViewExisting(existing)}>Xem {existing.code} hiện có</ModalButton>
          : <ModalButton variant="primary" onClick={submit} disabled={busy || !stateOk}><Icon name="circle-plus" size={16} /> Tạo yêu cầu {role}</ModalButton>}
      </ModalFooter>
    </Modal>
  )
}

export function ReassignDialog({ ir, onSubmit, onClose }: { ir: InternalView; onSubmit: (reason: string) => Promise<void>; onClose: () => void }) {
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<{ reason?: string }>({})
  const { busy, error, run } = useSubmit()
  const submit = () => {
    const next = { reason: reason.trim() ? undefined : 'Lý do là bắt buộc.' }
    setErrors(next)
    if (next.reason) return
    void run(() => onSubmit(reason.trim()))
    }
  return (
    <Modal title={`Đổi người nhận ${ir.code}`} width={640} onClose={onClose}>
      <Field label="Lý do *" id="ra-reason">
        <Textarea id="ra-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Người nhận cũ vắng mặt; cần tiếp tục xác minh" />
        <FieldError>{errors.reason}</FieldError>
      </Field>
      <Note tone="info"><span className="font-semibold text-warn-fg">Đổi người nhận đồng nghĩa hủy yêu cầu nội bộ hiện tại</span></Note>
      {error && <Note tone="err">{error}</Note>}
      <ModalFooter><Back onClick={onClose} /><ModalButton variant="primary" onClick={submit} disabled={busy}>Hủy để đổi người nhận</ModalButton></ModalFooter>
    </Modal>
  )
}

export function CloseDialog({ ticket, onSubmit, onReload, onClose }: { ticket: Ticket; onSubmit: (reviewed: boolean, note: string) => Promise<void>; onReload: () => void; onClose: () => void }) {
  const cond = closeConditions(ticket)
  const openInternal = ticket.internalRequests.filter((request) => request.status === 'OPEN' || request.status === 'WAITING_CS')
  const [note, setNote] = useState('')
  const [reviewed, setReviewed] = useState(false)
  const [tickError, setTickError] = useState(false)
  const { busy, error, run } = useSubmit()
  if (!cond.resolved.ok || !cond.acknowledged.ok) {
    const unmet = [
      !cond.resolved.ok && 'Yêu cầu chưa ở trạng thái Đã giải quyết',
      !cond.acknowledged.ok && cond.resolved.ok && `Chủ trại chưa xác nhận kết quả phiên bản ${cond.acknowledged.version}`,
    ].filter(Boolean).join(' / ')
    return (
      <Modal title="Chưa đủ điều kiện đóng yêu cầu" width={640} onClose={onClose}>
        <Field label="Điều kiện cần xem lại" id="cl-unmet"><input id="cl-unmet" readOnly className={inputCls} value={unmet} /></Field>
        <Note tone="warn">Không thể đóng khi xác nhận đã cũ, có yêu cầu nội bộ đang mở hoặc yêu cầu vừa mở lại. Tải lại để xem trạng thái và thao tác hiện tại.</Note>
        <ModalFooter><ModalButton variant="primary" onClick={onReload}><Icon name="refresh" size={16} /> Tải lại yêu cầu</ModalButton></ModalFooter>
      </Modal>
    )
  }
  const submit = () => {
    if (!reviewed) return setTickError(true)
    setTickError(false)
    void run(() => onSubmit(true, note.trim()))
  }
  const ok = (text: string) => <li className="flex items-start gap-2 text-xs text-ink"><Icon name="circle-check" size={16} className="mt-px shrink-0 text-brand" /> {text}</li>
  return (
    <Modal title={`Đóng yêu cầu ${ticket.code}`} sub="Sau khi đóng, yêu cầu chỉ đọc. Chủ trại có thể tạo yêu cầu mới nếu cần." width={640} onClose={onClose}>
      <div className="rounded-md bg-page p-3">
        <p className="m-0 mb-2 text-xs font-semibold text-ink">Điều kiện đóng</p>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {ok(`Yêu cầu đã giải quyết (kết quả phiên bản ${cond.resolved.version} – ${formatStamp(cond.resolved.at ?? '')})`)}
          {openInternal.length === 0 ? ok('Không còn yêu cầu nội bộ đang mở') : (
            <li className="flex items-start gap-2 text-xs text-ink"><Icon name="alert-triangle" size={16} className="mt-px shrink-0 text-warn-fg" /> Đang có {openInternal.length} yêu cầu nội bộ đang mở; khi xác nhận đóng ticket, các yêu cầu này sẽ chuyển sang Đã hủy.</li>
          )}
          {ok(`Chủ trại đã bấm Xác nhận cho kết quả phiên bản ${cond.acknowledged.version} · ${formatStamp(cond.acknowledged.at ?? '')}`)}
        </ul>
      </div>
      <Note tone="info">Xác nhận phải là thao tác "Xác nhận" của Chủ trại gắn với kết quả phiên bản {cond.acknowledged.version}; một câu trả lời thông thường không thay thế được.</Note>
      {openInternal.length > 0 && <Note tone="warn">Đóng ticket cũng đồng nghĩa đóng các yêu cầu nội bộ đang mở. Nguyên nhân hủy mặc định: {INTERNAL_CANCEL_ON_TICKET_CLOSE_REASON}</Note>}
      <Field label="Ghi chú đóng (không bắt buộc)" id="cl-note"><input id="cl-note" className={inputCls} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Chủ trại đã xác nhận vấn đề được giải quyết" /></Field>
      <div>
        <Checkbox checked={reviewed} onChange={(e) => setReviewed(e.target.checked)}>Tôi đã xem xác nhận của Chủ trại và đồng ý đóng yêu cầu.</Checkbox>
        <FieldError>{tickError ? 'Hãy tick xác nhận để tiếp tục.' : null}</FieldError>
      </div>
      {error && <Note tone="err">{error}</Note>}
      <ModalFooter><ModalButton onClick={onClose}>Hủy</ModalButton><ModalButton variant="primary" onClick={submit} disabled={busy}>{openInternal.length > 0 ? 'OK, đóng ticket và hủy yêu cầu nội bộ' : 'Đóng yêu cầu'}</ModalButton></ModalFooter>
    </Modal>
  )
}

export function ClosedDialog({ ticket, onClose }: { ticket: Ticket; onClose: () => void }) {
  const last = ticket.history?.[ticket.history.length - 1]
  const res = ticket.resolutions[ticket.resolutions.length - 1]
  return (
    <Modal title={`Yêu cầu ${ticket.code} đã đóng`} width={640} onClose={onClose}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Trạng thái" id="cd-s"><input id="cd-s" readOnly className={inputCls} value="Đã đóng · Chỉ đọc" /></Field>
        <Field label="Người đóng / thời điểm" id="cd-w"><input id="cd-w" readOnly className={inputCls} value={`${last?.actor} · ${formatStamp(last?.at ?? '', true)}`} /></Field>
      </div>
      <Field label="Kết quả / xác nhận đã xem" id="cd-r"><input id="cd-r" readOnly className={inputCls} value={res ? `kết quả v${res.version} · Xác nhận-${ticket.id}-v${res.version}` : '—'} /></Field>
      <Note tone="info">Không còn khung soạn hoặc thao tác thay đổi. Lịch sử công khai, trạng thái, IR và việc đóng được giữ theo quyền.</Note>
      <ModalFooter><Link to="/nen-tang/ho-tro" className="inline-flex"><ModalButton variant="primary"><Icon name="arrow-left" size={16} /> Về hàng đợi</ModalButton></Link></ModalFooter>
    </Modal>
  )
}
