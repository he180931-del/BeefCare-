import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Modal, { ModalButton, ModalFooter } from '../../../components/Modal'
import { Icon } from '../../../components/Icon'
import { Field, Note, inputCls } from '../../../components/ui'
import { platformServiceApi } from '../api/platformServiceApi'
import type { Evidence, PlatformPayment, ReviewDecision, ReviewResult } from '../types'
import { fmtDateTime, fmtMoney, fmtSeconds, fmtShort } from '../domain/dates'
import { blockReason, checkAcceptance, evidenceCode, maskTransaction, PAYMENT_STATE_LABEL } from '../domain/reconciliation'
import { validateReason } from '../domain/servicePeriods'
import { ReadField, ReasonField, useAction } from './common'

export interface DialogCtx {
  ev: Evidence
  cand: PlatformPayment | undefined
  explicit: boolean
  candidates: PlatformPayment[]
  payments: PlatformPayment[]
  requestId: number | null
  reason: string
  setReason: (r: string) => void
  accepted: ReviewResult | null
  setAccepted: (r: ReviewResult) => void
  setChosenId: (id: number) => void
  open: (name: string) => void
  close: () => void
  saved: (message: string) => void
  showEvidence: (id: number | null) => void
}

const TITLE = 'Thanh toán & đối soát'
const evCand = (ev: Evidence, cand?: PlatformPayment) => `${evidenceCode(ev.id)} / ${cand?.code ?? 'chưa chọn ứng viên'}`
const money = (n: number) => `${fmtMoney(n)} VND`

function Dlg({ title, onClose, children, back = 'Quay lại', actions, error }: { title: string; onClose: () => void; children: ReactNode; back?: string; actions?: ReactNode; error?: string | null }) {
  return (
    <Modal title={title} topTitle={TITLE} width={640} onClose={onClose}>
      <div className="grid gap-3">{children}</div>
      {error ? <p role="alert" className="mt-2 text-[12px] text-err-fg">{error}</p> : null}
      <ModalFooter>
        <ModalButton onClick={onClose}><Icon name="arrow-left" size={16} />{back}</ModalButton>
        {actions}
      </ModalFooter>
    </Modal>
  )
}

function DecisionDialog({ c, decision }: { c: DialogCtx; decision: Exclude<ReviewDecision, 'ACCEPT'> }) {
  const hold = decision === 'HOLD'
  const { run, busy, error } = useAction()
  const [fieldError, setFieldError] = useState<string | null>(null)
  async function save() {
    const err = validateReason(c.reason, 'Lý do & bằng chứng', 1000)
    setFieldError(err)
    if (err) return
    const res = await run(() => platformServiceApi.reviewEvidence(c.ev.id, { decision, reason: c.reason, version: c.ev.version }))
    if (res) c.saved(`Đã lưu quyết định ${hold ? 'Tạm giữ' : 'Từ chối'} cho giao dịch ${maskTransaction(c.ev.transactionId)}.`)
  }
  return (
    <Dlg title={`Lưu quyết định ${hold ? 'Tạm giữ' : 'Từ chối'}`} onClose={c.close} error={error}
      actions={<ModalButton variant="primary" disabled={busy} onClick={save}>{hold ? 'Lưu Tạm giữ' : 'Lưu Từ chối'}</ModalButton>}>
      <ReadField id="dec-ev" label={hold ? 'Chứng từ / ứng viên' : 'Chứng từ'} value={hold ? `${evidenceCode(c.ev.id)} / ${c.cand?.code ?? '—'} (chưa phân bổ)` : evidenceCode(c.ev.id)} />
      <ReasonField id="dec-reason" label="Lý do & bằng chứng *" value={c.reason} onChange={c.setReason} error={fieldError} />
      <Note tone="info">{hold ? 'Tạm giữ giữ xem xét chưa giải quyết, không Đã thanh toán, không cấp kỳ và không xác nhận đã hoàn.' : 'Giữ lịch sử không chấp nhận. Từ chối không thực hiện hoàn tiền và không phải bằng chứng đã hoàn.'}</Note>
    </Dlg>
  )
}

function BlockedDialog({ c }: { c: DialogCtx }) {
  const { run, busy, error } = useAction()
  const reason = c.cand ? blockReason(checkAcceptance(c.ev, c.cand, c.explicit)) : 'Chưa có yêu cầu ứng viên để chấp nhận'
  async function hold() {
    const res = await run(() => platformServiceApi.reviewEvidence(c.ev.id, { decision: 'HOLD', reason: c.reason || reason || 'Tạm giữ để xác minh', version: c.ev.version }))
    if (res) c.saved(`Đã lưu quyết định Tạm giữ cho giao dịch ${maskTransaction(c.ev.transactionId)}.`)
  }
  return (
    <Dlg title="Chưa thể Chấp nhận chứng từ" onClose={c.close} error={error}
      actions={<ModalButton variant="primary" disabled={busy} onClick={hold}>Giữ Tạm giữ để xác minh</ModalButton>}>
      <ReadField id="blk-ev" label="Chứng từ / ứng viên" value={evCand(c.ev, c.cand)} />
      <ReadField id="blk-reason" label="Điều kiện không đạt" value={reason ?? 'Không có'} />
      <Note tone="warn">Các trường hợp khác cũng bị chặn: sai tiền/tài khoản/chiều/thời gian; nguồn đã phân bổ hoặc đã ghi sổ thủ công Thu; đã khóa/hoàn. Không có nút bỏ qua điều kiện.</Note>
      <Note tone="info">Hết hạn trên màn hình không tự làm vô hiệu chứng từ trả tiền đúng trong cửa sổ báo giá.</Note>
    </Dlg>
  )
}

function AcceptDialog({ c }: { c: DialogCtx }) {
  const { run, busy, error } = useAction()
  const [fieldError, setFieldError] = useState<string | null>(null)
  const cand = c.cand
  async function accept() {
    const err = validateReason(c.reason, 'Lý do & bằng chứng', 1000)
    setFieldError(err)
    if (err || !cand) return
    const res = await run(() => platformServiceApi.reviewEvidence(c.ev.id, { decision: 'ACCEPT', paymentId: cand.id, explicitSelection: c.explicit, reason: c.reason, version: c.ev.version }))
    if (res) { c.setAccepted(res); c.open('confirmed') }
  }
  return (
    <Dlg title="Xem lại Chấp nhận — mã đã khớp" onClose={c.close} error={error}
      actions={<ModalButton variant="primary" disabled={busy || !cand} onClick={accept}>Xác nhận Chấp nhận</ModalButton>}>
      <ReadField id="acc-ev" label="Chứng từ nguồn" value={`${evidenceCode(c.ev.id)} · ${c.ev.provider} / ${c.ev.environment} / ${c.ev.accountNamespace}`} />
      <ReadField id="acc-code" label="Mã tham chiếu chính xác" value={cand ? `${cand.code} · ${c.explicit ? 'PM chọn thủ công' : 'duy nhất'}` : '—'} />
      <ReadField id="acc-amt" label="Tiền / người nhận" value={`${money(c.ev.amount)} vào ${c.ev.receivingAccount}`} />
      <div className="grid gap-3 sm:grid-cols-2">
        <ReadField id="acc-bank" label="Ngân hàng / nhận lần đầu" value={`${c.ev.bankPaidAt.slice(0, 16).replace('T', ' ')} / ${c.ev.receivedAt.slice(11, 19)}`} />
        <ReadField id="acc-win" label="Cửa sổ báo giá" value={cand ? `${fmtShort(cand.createdAt)} → ${fmtDateTime(cand.expiresAt)}` : '—'} />
      </div>
      <ReasonField id="acc-reason" label="Lý do & bằng chứng *" value={c.reason} onChange={c.setReason} error={fieldError} />
      <Note tone="info">Chưa phân bổ, chưa ghi thu thủ công, không khóa/hoàn. Khi xác nhận, hệ thống kiểm tra lại toàn bộ điều kiện.</Note>
    </Dlg>
  )
}

function ConfirmedDialog({ c }: { c: DialogCtx }) {
  const r = c.accepted
  return (
    <Dlg title="Đã xác nhận thanh toán" onClose={c.close} back="Về đối soát"
      actions={r?.receiptCode ? <Link to="/nen-tang/bien-nhan" className="inline-flex h-[44px] items-center rounded-xl bg-brand px-4 text-[14px] font-semibold text-white">Mở biên nhận</Link> : null}>
      <ReadField id="cf-pay" label="Thanh toán / phân bổ" value={r?.payment ? `${r.payment.code} · ${PAYMENT_STATE_LABEL[r.payment.state]} · ${evidenceCode(c.ev.id)}` : '—'} />
      <div className="grid gap-3 sm:grid-cols-2">
        <ReadField id="cf-at" label="Xác nhận hệ thống" value={fmtSeconds(r?.confirmedAt)} />
        <ReadField id="cf-period" label="Kỳ mua bất biến" value={r?.period ? `${r.period.start.split('-').reverse().join('/')} → ${r.period.end.split('-').reverse().join('/')}` : '—'} />
      </div>
      <ReadField id="cf-rc" label="Biên nhận" value={r?.receiptCode ?? '—'} />
      <Note tone="info">Chấp nhận một lần; thử lại trả kết quả cũ. Trại đang tạm ngưng vẫn giữ tạm ngưng.</Note>
    </Dlg>
  )
}

function LockDialog({ c }: { c: DialogCtx }) {
  const [reason, setReason] = useState('')
  const [ref, setRef] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const { run, busy, error } = useAction()
  async function lock() {
    const err = validateReason(reason, 'Lý do khóa')
    setFieldError(err)
    if (err) return
    const res = await run(() => platformServiceApi.lockForReturn(c.ev.id, { reason, reference: ref, version: c.ev.version }))
    if (res) c.saved(`Giao dịch ${maskTransaction(c.ev.transactionId)} đã khóa chờ hoàn tiền và không thể dùng để thanh toán.`)
  }
  return (
    <Dlg title="Khóa nguồn chờ xử lý ngoài hệ thống" onClose={c.close} error={error}
      actions={<ModalButton variant="primary" disabled={busy} onClick={lock}>Xác nhận khóa nguồn</ModalButton>}>
      <ReadField id="lk-ev" label="Chứng từ chưa phân bổ" value={`${evidenceCode(c.ev.id)} · ${c.ev.transactionId}`} />
      <ReasonField id="lk-reason" label="Lý do khóa *" value={reason} onChange={setReason} error={fieldError} />
      <Field label="Tham chiếu trao đổi" id="lk-ref"><input id="lk-ref" className={inputCls} value={ref} onChange={(e) => setRef(e.target.value)} placeholder="EXT-20261018-01" /></Field>
      <Note tone="info">Khóa trước khi thao tác tại ngân hàng. Nguồn đã Chấp nhận không khóa hoàn ở đây. BeefCare chỉ lưu dấu vết, không chuyển tiền.</Note>
    </Dlg>
  )
}

function LockedDialog({ c }: { c: DialogCtx }) {
  const e = c.ev
  return (
    <Dlg title="Nguồn đã khóa chờ xử lý" onClose={c.close} back="Về đối soát"
      actions={
        <>
          {e.returnResult ? null : <ModalButton onClick={() => c.open('unlock')}>Mở khóa chưa thực hiện</ModalButton>}
          <ModalButton variant="primary" disabled={!!e.returnResult} onClick={() => c.open('return')}>Ghi nhận kết quả ngoài hệ thống</ModalButton>
        </>
      }>
      <div className="grid gap-3 sm:grid-cols-2">
        <ReadField id="ld-src" label="Nguồn" value={`${evidenceCode(e.id)} · ${e.lockedForReturn ? 'Đã khóa' : 'Không khóa'} · ${e.paymentId === null ? 'Chưa phân bổ' : 'Đã phân bổ'}`} />
        <ReadField id="ld-by" label="Người khóa / thời điểm" value={e.lockedBy ? `${e.lockedBy} · ${fmtDateTime(e.lockedAt)}` : '—'} />
      </div>
      <ReadField id="ld-reason" label="Lý do" value={[e.lockReason, e.lockReference].filter(Boolean).join(' · ') || '—'} />
      {e.returnResult ? <ReadField id="ld-ret" label="Kết quả hoàn đã xác minh" value={`${e.returnReference} · ${e.returnResult}`} /> : null}
      <Note tone="info">Nguồn đang khóa không được Chấp nhận hoặc ghi thu thủ công. {e.returnResult ? 'Kết quả hoàn đã được ghi nhận.' : 'Chưa có kết quả hoàn được xác minh.'}</Note>
    </Dlg>
  )
}

function UnlockDialog({ c }: { c: DialogCtx }) {
  const [reason, setReason] = useState('')
  const [verify, setVerify] = useState('')
  const [errs, setErrs] = useState<[string | null, string | null]>([null, null])
  const { run, busy, error } = useAction()
  async function unlock() {
    const next: [string | null, string | null] = [validateReason(reason, 'Lý do mở khóa'), validateReason(verify, 'Xác minh chưa có khoản trả ra')]
    setErrs(next)
    if (next[0] || next[1]) return
    const res = await run(() => platformServiceApi.unlockReturn(c.ev.id, { reason, verification: verify, version: c.ev.version }))
    if (res) c.saved(`Đã mở khóa nguồn ${evidenceCode(c.ev.id)}; lịch sử được giữ nguyên.`)
  }
  return (
    <Dlg title="Mở khóa khi chưa hoàn" onClose={c.close} error={error}
      actions={<ModalButton variant="primary" disabled={busy} onClick={unlock}>Mở khóa nguồn</ModalButton>}>
      <ReadField id="ul-src" label="Nguồn" value={`${evidenceCode(c.ev.id)} · Đã khóa`} />
      <ReasonField id="ul-reason" label="Lý do mở khóa *" value={reason} onChange={setReason} error={errs[0]} />
      <ReasonField id="ul-verify" label="Xác minh chưa có khoản trả ra *" value={verify} onChange={setVerify} error={errs[1]} />
      <Note tone="info">Chỉ bỏ khóa chưa thực hiện; giữ nguyên lịch sử và kiểm tra lại nguồn/phiên bản. Không mở khóa nguồn đã xác minh hoàn.</Note>
    </Dlg>
  )
}

function ReturnDialog({ c }: { c: DialogCtx }) {
  const [f, setF] = useState({ reference: '', paidOutAt: '', result: '', verifier: '' })
  const [errs, setErrs] = useState<Record<string, string | null>>({})
  const { run, busy, error } = useAction()
  const fields: Array<[keyof typeof f, string]> = [['reference', 'Giao dịch trả ra / reference'], ['paidOutAt', 'Thời điểm trả ra'], ['result', 'Kết quả đã xác minh'], ['verifier', 'Người xác minh / ghi chú']]
  async function save() {
    const next = Object.fromEntries(fields.map(([k, label]) => [k, validateReason(f[k], label)]))
    setErrs(next)
    if (Object.values(next).some(Boolean)) return
    const res = await run(() => platformServiceApi.recordReturn(c.ev.id, { ...f, version: c.ev.version }))
    if (res) c.saved(`Đã ghi nhận kết quả hoàn đã xác minh cho ${evidenceCode(c.ev.id)}.`)
  }
  return (
    <Dlg title="Ghi nhận kết quả hoàn đã xác minh" onClose={c.close} error={error}
      actions={<ModalButton variant="primary" disabled={busy} onClick={save}>Lưu kết quả đã xác minh</ModalButton>}>
      <ReadField id="rt-src" label="Nguồn tiền vào" value={`${evidenceCode(c.ev.id)} · ${c.ev.transactionId}`} />
      {fields.map(([k, label]) => (
        <Field key={k} label={`${label} *`} id={`rt-${k}`}>
          <input id={`rt-${k}`} className={inputCls} type={k === 'paidOutAt' ? 'datetime-local' : 'text'} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
          {errs[k] ? <p role="alert" className="mt-1 text-[12px] text-err-fg">{errs[k]}</p> : null}
        </Field>
      ))}
      <Note tone="info">Đây là ghi nhận việc đã làm ngoài ngân hàng. Không có nút thực hiện hoàn. Nguồn đã hoàn không dùng cho thanh toán hay thu chi vận hành.</Note>
    </Dlg>
  )
}

function RequestDialog({ c }: { c: DialogCtx }) {
  const p = c.payments.find((x) => x.id === c.requestId)
  return (
    <Dlg title="Yêu cầu thanh toán" onClose={c.close} back="Quay lại"
      actions={
        <>
          <ModalButton onClick={() => c.showEvidence(null)}>Chứng từ ngân hàng</ModalButton>
          <ModalButton variant="primary" disabled={!p || p.state === 'PAID'} onClick={() => c.showEvidence(p?.id ?? null)}>Xem chứng từ ứng viên</ModalButton>
        </>
      }>
      <ReadField id="rq-sel" label="Yêu cầu được chọn" value={p ? `${p.code} · ${p.farmName} · ${PAYMENT_STATE_LABEL[p.state]}` : '—'} />
      <ReadField id="rq-price" label="Thời hạn / giá / phiên bản" value={p ? `${p.termYears} năm · ${money(p.amount)} · v${p.priceVersion}` : '—'} />
      <ReadField id="rq-time" label="Tạo / hết hạn" value={p ? `${fmtDateTime(p.createdAt)} → ${fmtDateTime(p.expiresAt)}` : '—'} />
      <ReadField id="rq-recipient" label="Người nhận đã chốt" value={p?.recipient ?? '—'} />
      <Note tone="info">{p?.evidenceId ? `Đã phân bổ cho ${evidenceCode(p.evidenceId)}.` : 'Ứng viên chưa được phân bổ.'} Chỉ xem không xác nhận Thanh toán, không cấp kỳ sử dụng.</Note>
    </Dlg>
  )
}

function PickDialog({ c }: { c: DialogCtx }) {
  const [code, setCode] = useState('')
  const typed = code.trim().toUpperCase()
  const found = typed ? c.candidates.find((p) => p.code.toUpperCase() === typed) : undefined
  return (
    <Dlg title="Chọn yêu cầu để xem xét" onClose={c.close}
      actions={<ModalButton variant="primary" disabled={!found} onClick={() => { if (found) { c.setChosenId(found.id); c.close() } }}>Dùng ứng viên để kiểm tra</ModalButton>}>
      <Field label="Tra cứu mã chính xác" id="pk-code"><input id="pk-code" className={inputCls} value={code} onChange={(e) => setCode(e.target.value)} placeholder="BCF7K2Q9" /></Field>
      <ReadField id="pk-cand" label="Ứng viên" value={found ? `${found.code} · ${found.farmName} · ${found.termYears} năm · ${money(found.amount)}` : typed ? 'Không có ứng viên được phép với mã này' : '—'} />
      <ReadField id="pk-win" label="Cửa sổ báo giá" value={found ? `${fmtShort(found.createdAt)} – ${fmtDateTime(found.expiresAt)}` : '—'} />
      <Note tone="info">Picker chỉ trả ứng viên được phép. Việc chọn không sửa số tiền/mã/người nhận và không bỏ qua kiểm tra chấp nhận.</Note>
    </Dlg>
  )
}

function HistoryDialog({ c }: { c: DialogCtx }) {
  const e = c.ev
  const last = e.history[e.history.length - 1]
  return (
    <Dlg title={`Lịch sử chứng từ ${evidenceCode(e.id)}`} onClose={c.close}>
      <ReadField id="hs-src" label="Nguồn đã xác thực (chỉ đọc)" value={`${e.provider} · ${e.environment} · ${e.accountNamespace} · ${e.transactionId}`} />
      <div className="grid gap-3 sm:grid-cols-2">
        <ReadField id="hs-paid" label="Ngân hàng trả tiền" value={fmtSeconds(e.bankPaidAt)} />
        <ReadField id="hs-recv" label="Hệ thống nhận lần đầu" value={fmtSeconds(e.receivedAt)} />
      </div>
      <ReadField id="hs-del" label="Delivery / xử lý" value={e.deliveries} />
      <ReadField id="hs-alloc" label="Phân bổ / xác nhận" value={e.paymentId === null ? 'Chưa phân bổ · Chưa xác nhận' : `Đã phân bổ · ${c.payments.find((p) => p.id === e.paymentId)?.code ?? ''}`} />
      <ReadField id="hs-last" label="Review gần nhất" value={last ? `${last.text.split(':')[0]} · ${last.by} · ${fmtDateTime(last.at)}` : 'Chưa có quyết định'} />
      <Note tone="info">{e.reviewReason ? `Lý do: ${e.reviewReason}. ` : ''}Lần giao lặp giữ cùng chứng từ; lịch sử quyết định không bị ghi đè.</Note>
    </Dlg>
  )
}

export default function ReconcileDialogs({ m, c }: { m: string | null; c: DialogCtx }) {
  switch (m) {
    case 'hold': return <DecisionDialog c={c} decision="HOLD" />
    case 'reject': return <DecisionDialog c={c} decision="REJECT" />
    case 'blocked': return <BlockedDialog c={c} />
    case 'accept': return <AcceptDialog c={c} />
    case 'confirmed': return <ConfirmedDialog c={c} />
    case 'lock': return <LockDialog c={c} />
    case 'locked': return <LockedDialog c={c} />
    case 'unlock': return <UnlockDialog c={c} />
    case 'return': return <ReturnDialog c={c} />
    case 'request': return <RequestDialog c={c} />
    case 'pick': return <PickDialog c={c} />
    case 'history': return <HistoryDialog c={c} />
    default: return null
  }
}
