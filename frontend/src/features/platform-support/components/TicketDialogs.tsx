import { useState } from 'react'
import { Link } from 'react-router-dom'
import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { Icon } from '../../../components/Icon'
import { useQuery } from '../../../hooks/useApi'
import { Checkbox, Field, Note, Select, Textarea, inputCls } from '../../../components/ui'
import { supportApi } from '../api/supportApi'
import { ROLE_LABEL, closeConditions, formatStamp, openIrOf } from '../domain/supportRules'
import type { InternalView, TargetRole, Ticket } from '../types'
import { FieldError, useActor, useSubmit } from './common'

const Back = ({ onClick }: { onClick: () => void }) => <ModalButton onClick={onClick}><Icon name="arrow-left" size={16} /> Quay lại</ModalButton>

export function HandOverDialog({ onSubmit, onClose }: { onSubmit: (toCsId: number, reason: string) => Promise<void>; onClose: () => void }) {
  const me = useActor()
  const { data } = useQuery(() => supportApi.listCs(), [])
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
      <ModalFooter className="!px-0 !pb-0"><Back onClick={onClose} /><ModalButton variant="primary" onClick={submit} disabled={busy}>Xác nhận chuyển giao</ModalButton></ModalFooter>
    </Modal>
  )
}

export function CreateInternalDialog({ ticket, initialRole, onSubmit, onViewExisting, onClose }: {
  ticket: Ticket
  initialRole: TargetRole
  onSubmit: (cmd: { targetRole: TargetRole; recipientId: number; question: string; context: Ticket['contextOptions']['PM'] }) => Promise<void>
  onViewExisting: (ir: InternalView) => void
  onClose: () => void
}) {
  const [role, setRole] = useState<TargetRole>(initialRole)
  const { data } = useQuery(() => supportApi.listRecipients(role), [role])
  const [recipient, setRecipient] = useState('')
  const [question, setQuestion] = useState('')
  const [ctx, setCtx] = useState('')
  const [errors, setErrors] = useState<{ recipient?: string; question?: string }>({})
  const { busy, error, run } = useSubmit()
  const existing = openIrOf(ticket, role)
  const stateOk = ticket.status === 'IN_PROGRESS' || ticket.status === 'WAITING_CUSTOMER'
  const submit = () => {
    const next = { recipient: recipient ? undefined : 'Người nhận cụ thể là bắt buộc.', question: question.trim() ? undefined : 'Câu hỏi / lý do là bắt buộc.' }
    setErrors(next)
    if (next.recipient || next.question) return
    const context = ticket.contextOptions[role].filter((c) => String(c.id) === ctx)
    void run(() => onSubmit({ targetRole: role, recipientId: Number(recipient), question: question.trim(), context }))
  }
  return (
    <Modal title={initialRole === 'SA' ? 'Tạo yêu cầu nội bộ cho quản trị hệ thống' : 'Tạo yêu cầu nội bộ'} width={640} onClose={onClose}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Vai trò đích *" id="ir-role">
          <Select id="ir-role" value={role} onChange={(e) => { setRole(e.target.value as TargetRole); setRecipient(''); setCtx('') }}>
            <option value="PM">{ROLE_LABEL.PM}</option>
            <option value="SA">{ROLE_LABEL.SA}</option>
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
      <Field label="Câu hỏi / lý do *" id="ir-q">
        <Textarea id="ir-q" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Kiểm tra Thanh toán BCF7K2Q9 và chứng từ mã chưa khớp" />
        <FieldError>{errors.question}</FieldError>
      </Field>
      <Field label="Ngữ cảnh được chia sẻ" id="ir-ctx">
        <Select id="ir-ctx" value={ctx} onChange={(e) => setCtx(e.target.value)}>
          <option value="">Không chia sẻ liên kết</option>
          {ticket.contextOptions[role].map((c) => <option key={`${c.type}${c.id}`} value={c.id}>{c.label}</option>)}
        </Select>
      </Field>
      <Note tone="info">Chỉ chia sẻ câu hỏi và liên kết miền được phép. Không gửi toàn bộ hội thoại, ghi chú nội bộ hoặc dữ liệu ngân hàng.</Note>
      {existing && <Note tone="info">Mỗi yêu cầu chỉ có một yêu cầu nội bộ đang mở cho mỗi vai trò. Hiện {existing.code} đã mở: cần xử lý yêu cầu hiện có trước khi tạo thêm.</Note>}
      {!stateOk && <Note tone="warn">Chỉ tạo khi yêu cầu đang Đang xử lý / Chờ khách phản hồi. Không thay đổi trạng thái yêu cầu.</Note>}
      {error && <Note tone="err">{error}</Note>}
      <ModalFooter className="!px-0 !pb-0">
        <Back onClick={onClose} />
        {existing
          ? <ModalButton variant="primary" onClick={() => onViewExisting(existing)}>Xem {existing.code} hiện có</ModalButton>
          : <ModalButton variant="primary" onClick={submit} disabled={busy || !stateOk}><Icon name="circle-plus" size={16} /> Tạo yêu cầu {role}</ModalButton>}
      </ModalFooter>
    </Modal>
  )
}

export function ReassignDialog({ ir, onSubmit, onClose }: { ir: InternalView; onSubmit: (recipientId: number, reason: string) => Promise<void>; onClose: () => void }) {
  const { data } = useQuery(() => supportApi.listRecipients(ir.targetRole), [ir.targetRole])
  const [to, setTo] = useState('')
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<{ to?: string; reason?: string }>({})
  const { busy, error, run } = useSubmit()
  const submit = () => {
    const next = { to: to ? undefined : 'Người nhận mới là bắt buộc.', reason: reason.trim() ? undefined : 'Lý do là bắt buộc.' }
    setErrors(next)
    if (next.to || next.reason) return
    void run(() => onSubmit(Number(to), reason.trim()))
  }
  return (
    <Modal title={`Đổi người nhận ${ir.code}`} width={640} onClose={onClose}>
      <Field label="Người nhận mới *" id="ra-to">
        <Select id="ra-to" value={to} onChange={(e) => setTo(e.target.value)}>
          <option value="">Chọn người nhận mới</option>
          {(data ?? []).filter((s) => s.id !== ir.recipientId).map((s) => <option key={s.id} value={s.id}>{s.name} · {s.role} đang khả dụng</option>)}
        </Select>
        <FieldError>{errors.to}</FieldError>
      </Field>
      <Field label="Lý do *" id="ra-reason">
        <Textarea id="ra-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Người nhận cũ vắng mặt; cần tiếp tục xác minh" />
        <FieldError>{errors.reason}</FieldError>
      </Field>
      <Note tone="info">Chỉ nhân viên hỗ trợ được giao mới đổi người nhận yêu cầu nội bộ đang mở. Người nhận cũ mất quyền xem/ghi ngay sau chuyển; giữ lịch sử cũ.</Note>
      {error && <Note tone="err">{error}</Note>}
      <ModalFooter className="!px-0 !pb-0"><Back onClick={onClose} /><ModalButton variant="primary" onClick={submit} disabled={busy}>Chuyển người nhận</ModalButton></ModalFooter>
    </Modal>
  )
}

export function CloseDialog({ ticket, onSubmit, onReload, onClose }: { ticket: Ticket; onSubmit: (reviewed: boolean, note: string) => Promise<void>; onReload: () => void; onClose: () => void }) {
  const cond = closeConditions(ticket)
  const [note, setNote] = useState('')
  const [reviewed, setReviewed] = useState(false)
  const [tickError, setTickError] = useState(false)
  const { busy, error, run } = useSubmit()
  if (!cond.all) {
    const unmet = [
      !cond.resolved.ok && 'Yêu cầu chưa ở trạng thái Đã giải quyết',
      !cond.noOpenIr.ok && `Yêu cầu nội bộ ${cond.noOpenIr.code} vẫn đang mở`,
      !cond.acknowledged.ok && cond.resolved.ok && `Chủ trại chưa xác nhận kết quả phiên bản ${cond.acknowledged.version}`,
    ].filter(Boolean).join(' / ')
    return (
      <Modal title="Chưa đủ điều kiện đóng yêu cầu" width={640} onClose={onClose}>
        <Field label="Điều kiện cần xem lại" id="cl-unmet"><input id="cl-unmet" readOnly className={inputCls} value={unmet} /></Field>
        <Note tone="warn">Không thể đóng khi xác nhận đã cũ, có yêu cầu nội bộ đang mở hoặc yêu cầu vừa mở lại. Tải lại để xem trạng thái và thao tác hiện tại.</Note>
        <ModalFooter className="!px-0 !pb-0"><ModalButton variant="primary" onClick={onReload}><Icon name="refresh" size={16} /> Tải lại yêu cầu</ModalButton></ModalFooter>
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
          {ok('Không còn yêu cầu nội bộ đang mở')}
          {ok(`Chủ trại đã bấm Xác nhận cho kết quả phiên bản ${cond.acknowledged.version} · ${formatStamp(cond.acknowledged.at ?? '')}`)}
        </ul>
      </div>
      <Note tone="info">Xác nhận phải là thao tác "Xác nhận" của Chủ trại gắn với kết quả phiên bản {cond.acknowledged.version}; một câu trả lời thông thường không thay thế được.</Note>
      <Field label="Ghi chú đóng (không bắt buộc)" id="cl-note"><input id="cl-note" className={inputCls} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Chủ trại đã xác nhận vấn đề được giải quyết" /></Field>
      <div>
        <Checkbox checked={reviewed} onChange={(e) => setReviewed(e.target.checked)}>Tôi đã xem xác nhận của Chủ trại và đồng ý đóng yêu cầu.</Checkbox>
        <FieldError>{tickError ? 'Hãy tick xác nhận để tiếp tục.' : null}</FieldError>
      </div>
      {error && <Note tone="err">{error}</Note>}
      <ModalFooter className="!px-0 !pb-0"><ModalButton onClick={onClose}>Hủy</ModalButton><ModalButton variant="primary" onClick={submit} disabled={busy}>Đóng yêu cầu</ModalButton></ModalFooter>
    </Modal>
  )
}

export function ClosedDialog({ ticket, onClose }: { ticket: Ticket; onClose: () => void }) {
  const last = ticket.history[ticket.history.length - 1]
  const res = ticket.resolutions[ticket.resolutions.length - 1]
  return (
    <Modal title={`Yêu cầu ${ticket.code} đã đóng`} width={640} onClose={onClose}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Trạng thái" id="cd-s"><input id="cd-s" readOnly className={inputCls} value="Đã đóng · Chỉ đọc" /></Field>
        <Field label="Người đóng / thời điểm" id="cd-w"><input id="cd-w" readOnly className={inputCls} value={`${last?.actor} · ${formatStamp(last?.at ?? '', true)}`} /></Field>
      </div>
      <Field label="Kết quả / xác nhận đã xem" id="cd-r"><input id="cd-r" readOnly className={inputCls} value={res ? `kết quả v${res.version} · Xác nhận-${ticket.id}-v${res.version}` : '—'} /></Field>
      <Note tone="info">Không còn khung soạn hoặc thao tác thay đổi. Lịch sử công khai, trạng thái, IR và việc đóng được giữ theo quyền.</Note>
      <ModalFooter className="!px-0 !pb-0"><Link to="/nen-tang/ho-tro" className="inline-flex"><ModalButton variant="primary"><Icon name="arrow-left" size={16} /> Về hàng đợi</ModalButton></Link></ModalFooter>
    </Modal>
  )
}
