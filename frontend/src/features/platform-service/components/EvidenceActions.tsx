import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, DateInput, Field, Info, Note, Radio, Textarea, inputCls } from '../../../components/ui'
import {
  BLOCK_TEXT, DECISION_TEXT, REASON_MAX, isStale, platformReconciliationApi as api, reconciliationError,
  type CommandResult, type Decision,
} from '../api/platformReconciliationApi'
import type { CandidateRead, EvidenceDetail } from '../api/platformPaymentReadApi'
import { fmtDate, fmtSeconds, fmtVnd, vnDateOf, vnNow } from '../domain/dates'

const PRIMARY: Record<Decision, string> = { ACCEPT: 'Kiểm tra và chấp nhận', HOLD: 'Lưu tạm giữ', REJECT: 'Lưu từ chối' }
/** Match results that mean no request carries the transfer's code: ACCEPT needs an explicitly chosen candidate (GBR-72). */
const NO_EXACT_CODE = new Set(['NO_REQUEST', 'CODE_MISMATCH'])

/** Unsaved input kept across a MSG-COM-05 reload so the PM does not retype it. */
export interface ActionDraft {
  decision: Decision | null; candidate: number | null; reason: string; locking: boolean; lockReason: string; unlockReason: string
  returned: { reference: string; returnDate: string; result: string }
}

interface Props {
  detail: EvidenceDetail
  candidates: CandidateRead[]
  draft?: ActionDraft | null
  paymentHref: (paymentId: number) => string
  /** Success message (MSG-FE19-10 / MSG-FE19-16 / return texts); the page reloads the evidence, list and counts. */
  onDone: (message: string) => void
  /** MSG-COM-05: the evidence changed meanwhile; the page reloads (keeping the draft) before the PM tries again. */
  onStale: (message: string, draft: ActionDraft) => void
}

/** Required mark kept out of the accessible name; each control is named by its own aria-label. */
const req = (label: string) => <>{label} <span aria-hidden="true">*</span></>

function required(value: string, label: string, max: number) {
  const text = value.trim()
  if (!text) return { error: `Vui lòng nhập ${label}.`, text }
  if (text.length > max) return { error: `${label[0].toUpperCase()}${label.slice(1)} tối đa ${max.toLocaleString('vi-VN')} ký tự.`, text }
  return { error: null, text }
}

/** SCR-62 #9–13 (UC-FE19-06, D19): decision with candidate and reason, lock for return, record return or unlock. */
export default function EvidenceActions({ detail, candidates, draft, paymentHref, onDone, onStale }: Props) {
  const r = detail.summary
  const transaction = detail.transactionId
  const exact = detail.quoteRef ? candidates.find((c) => c.quoteRef.toUpperCase() === detail.quoteRef!.toUpperCase()) : undefined
  // A kept candidate is reused only if it is still eligible after the reload.
  const keptCandidate = draft?.candidate != null && candidates.some((c) => c.paymentId === draft.candidate) ? draft.candidate : null
  const [decision, setDecision] = useState<Decision | null>(draft?.decision ?? null)
  const [candidate, setCandidateState] = useState<number | null>(keptCandidate ?? exact?.paymentId ?? null)
  const [reason, setReasonState] = useState(draft?.reason ?? '')
  const [locking, setLocking] = useState(draft?.locking ?? false)
  const [lockReason, setLockReasonState] = useState(draft?.lockReason ?? '')
  const [unlockReason, setUnlockReasonState] = useState(draft?.unlockReason ?? '')
  const [returned, setReturnedState] = useState(draft?.returned ?? { reference: '', returnDate: '', result: '' })
  const [error, setError] = useState<string | null>(null)
  // Correcting an input clears the previous inline error.
  const setCandidate = (value: number | null) => { setCandidateState(value); setError(null) }
  const setReason = (value: string) => { setReasonState(value); setError(null) }
  const setLockReason = (value: string) => { setLockReasonState(value); setError(null) }
  const setUnlockReason = (value: string) => { setUnlockReasonState(value); setError(null) }
  const setReturned = (update: (v: ActionDraft['returned']) => ActionDraft['returned']) => { setReturnedState(update); setError(null) }
  const [busy, setBusy] = useState(false)
  const keys = useRef(new Map<string, string>())

  const allocated = r.paymentId !== null || r.reviewStatus === 'ACCEPTED'
  const locked = r.reviewStatus === 'LOCKED'
  const outgoing = r.direction === 'OUT'
  const recorded = detail.returnReference !== null

  /** GBR-88: the same command with the same data keeps its key, so a retry after a lost response replays the first result. */
  async function send(action: string, body: unknown, call: (key: string) => Promise<CommandResult>, success: string, decisionForError?: Decision) {
    const signature = JSON.stringify([action, r.id, body])
    const key = keys.current.get(signature) ?? crypto.randomUUID()
    keys.current.set(signature, key)
    setBusy(true)
    setError(null)
    try {
      await call(key)
      onDone(success)
    } catch (failure) {
      if (isStale(failure)) onStale(reconciliationError(failure), { decision, candidate, reason, locking, lockReason, unlockReason, returned })
      else setError(reconciliationError(failure, decisionForError))
    } finally {
      setBusy(false)
    }
  }

  function submitDecision() {
    if (!decision) return setError('Vui lòng chọn quyết định.')
    if (decision === 'ACCEPT' && candidate === null && NO_EXACT_CODE.has(r.matchResult)) {
      return setError(`Không thể chấp nhận chứng từ này: ${BLOCK_TEXT.NO_CANDIDATE}.`)
    }
    const checked = required(reason, 'lý do và tham chiếu chứng từ', REASON_MAX)
    if (checked.error) return setError(checked.error)
    const body = { decision, paymentId: decision === 'ACCEPT' ? candidate : null, reason: checked.text, version: r.version }
    void send('review', body, (key) => api.review(r.id, body, key), `Đã lưu quyết định ${DECISION_TEXT[decision]} cho giao dịch ${transaction}.`, decision)
  }

  function submitLock() {
    const checked = required(lockReason, 'lý do khóa hoàn trả', REASON_MAX)
    if (checked.error) return setError(checked.error)
    const body = { reason: checked.text, version: r.version }
    // MSG-FE19-16
    void send('lock', body, (key) => api.lock(r.id, body, key), `Giao dịch ${transaction} đã khóa để hoàn trả và không thể dùng cho thanh toán nào.`)
  }

  function submitReturn() {
    const reference = required(returned.reference, 'mã giao dịch chiều ra', 255)
    if (reference.error) return setError(reference.error)
    if (!returned.returnDate) return setError('Vui lòng nhập ngày hoàn trả.')
    if (returned.returnDate > vnNow().slice(0, 10)) return setError('Ngày hoàn trả không được ở tương lai.')
    if (returned.returnDate < vnDateOf(r.bankPaidAt)) return setError('Ngày hoàn trả không được trước ngày ngân hàng nhận tiền.')
    const result = required(returned.result, 'kết quả hoàn trả', 500)
    if (result.error) return setError(result.error)
    const body = { reference: reference.text, returnDate: returned.returnDate, result: result.text, version: r.version }
    void send('record', body, (key) => api.recordReturn(r.id, body, key), `Đã ghi hoàn trả cho giao dịch ${transaction}.`)
  }

  function submitUnlock() {
    const checked = required(unlockReason, 'lý do mở khóa', REASON_MAX)
    if (checked.error) return setError(checked.error)
    const body = { reason: checked.text, version: r.version }
    void send('unlock', body, (key) => api.unlock(r.id, body, key), `Đã mở khóa giao dịch ${transaction}. Chứng từ quay lại danh sách cần xem.`)
  }

  const decisions: Decision[] = outgoing ? ['HOLD', 'REJECT'] : ['ACCEPT', 'HOLD', 'REJECT']
  return <section aria-label="Xử lý chứng từ" className="mt-4">
    <Card title="Xử lý chứng từ" sub="Mọi quyết định cần lý do và được lưu vào lịch sử chứng từ.">
      {allocated ? <Note tone="ok">Chứng từ đã được phân bổ cho thanh toán; không thể đổi quyết định.</Note>
        : locked ? <>
          {recorded ? <>
            <Note tone="info">Đã ghi hoàn trả: không thể mở khóa hay dùng giao dịch này cho thanh toán.</Note>
            <div className="mt-3"><Info cols={2} items={[
              ['Mã giao dịch chiều ra', detail.returnReference], ['Ngày hoàn trả', fmtDate(detail.returnDate)], ['Kết quả hoàn trả', detail.returnResult ?? '—'],
            ]} /></div>
          </> : <>
            <Note tone="warn">Chứng từ đang khóa hoàn trả: không thể chấp nhận hay đổi quyết định. Ghi hoàn trả khi đã trả tiền, hoặc mở khóa nếu không cần trả.</Note>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label={req("Mã giao dịch chiều ra")} id="return-reference">
                <input id="return-reference" className={inputCls} maxLength={255} aria-label="Mã giao dịch chiều ra" value={returned.reference}
                  onChange={(e) => setReturned((v) => ({ ...v, reference: e.target.value }))} />
              </Field>
              <Field label={req("Ngày hoàn trả")} id="return-date">
                <DateInput id="return-date" label="Ngày hoàn trả" value={returned.returnDate} onChange={(returnDate) => setReturned((v) => ({ ...v, returnDate }))} />
              </Field>
            </div>
            <div className="mt-3"><Field label={req("Kết quả hoàn trả")} id="return-result">
              <Textarea id="return-result" aria-label="Kết quả hoàn trả" maxLength={500} value={returned.result} onChange={(e) => setReturned((v) => ({ ...v, result: e.target.value }))} />
            </Field></div>
            <div className="mt-3 flex justify-end"><Button variant="primary" disabled={busy} onClick={submitReturn}>Ghi hoàn trả</Button></div>
            <div className="mt-4 border-t border-edge pt-3">
              <Field label={req("Lý do mở khóa")} id="unlock-reason">
                <Textarea id="unlock-reason" aria-label="Lý do mở khóa" value={unlockReason} onChange={(e) => setUnlockReason(e.target.value)} />
              </Field>
              <div className="mt-3 flex justify-end"><Button disabled={busy} onClick={submitUnlock}>Mở khóa</Button></div>
            </div>
          </>}
        </> : <>
          {outgoing && <Note tone="grey">Giao dịch chuyển ra không thể chấp nhận cho thanh toán hay khóa hoàn trả.</Note>}
          <fieldset className="mt-2">
            <legend className="mb-1 text-[12px] font-medium text-ink">Quyết định *</legend>
            <div className="flex flex-wrap gap-4">
              {decisions.map((value) => <Radio key={value} name={`decision-${r.id}`} checked={decision === value} onChange={() => { setDecision(value); setError(null) }}>{DECISION_TEXT[value]}</Radio>)}
            </div>
          </fieldset>
          {!outgoing && <fieldset className="mt-3">
            {/* SCR-62 #9: the single candidate list; the choice is used only when the decision is ACCEPT. */}
            <legend className="mb-1 text-[12px] font-medium text-ink">Yêu cầu ứng viên {NO_EXACT_CODE.has(r.matchResult) ? '* (bắt buộc khi Chấp nhận)' : '(dùng khi Chấp nhận)'}</legend>
            {candidates.length === 0 ? <p className="text-sm text-muted">Không có yêu cầu ứng viên đủ điều kiện.</p>
              : <div className="flex flex-col gap-2">{candidates.map((c) => <div key={c.paymentId} className="flex flex-wrap items-center justify-between gap-2">
                <Radio name={`candidate-${r.id}`} checked={candidate === c.paymentId} onChange={() => setCandidate(c.paymentId)}>
                  {`${c.quoteRef} · ${c.farmName} · ${fmtVnd(c.amount)} · ${c.termYears} năm · hạn ${fmtSeconds(c.expiresAt)}`}
                </Radio>
                <Link className="text-[12px] font-semibold text-brand underline" aria-label={`Xem yêu cầu ${c.quoteRef}`} to={paymentHref(c.paymentId)}>Xem yêu cầu</Link>
              </div>)}</div>}
          </fieldset>}
          <div className="mt-3"><Field label={req("Lý do và tham chiếu chứng từ")} id={`reason-${r.id}`}>
            <Textarea id={`reason-${r.id}`} rows={3} aria-label="Lý do và tham chiếu chứng từ" value={reason} placeholder="Nêu lý do và tham chiếu chứng từ (tối đa 1.000 ký tự)"
              onChange={(e) => setReason(e.target.value)} />
          </Field></div>
          <p className="mt-1 text-[11px] text-muted">{reason.trim().length}/{REASON_MAX.toLocaleString('vi-VN')}</p>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            {!outgoing && !locking && <Button disabled={busy} onClick={() => { setLocking(true); setError(null) }}>Khóa hoàn trả</Button>}
            <Button variant="primary" disabled={busy} onClick={submitDecision}>{decision ? PRIMARY[decision] : 'Lưu quyết định'}</Button>
          </div>
          {locking && <div className="mt-4 border-t border-edge pt-3">
            <Field label={req("Lý do khóa hoàn trả")} id={`lock-${r.id}`}>
              <Textarea id={`lock-${r.id}`} aria-label="Lý do khóa hoàn trả" value={lockReason} onChange={(e) => setLockReason(e.target.value)} />
            </Field>
            <p className="mt-1 text-[11px] text-muted">Tiền cần trả lại ngoài BeefCare: sau khi khóa, giao dịch không bao giờ được dùng cho thanh toán.</p>
            <div className="mt-3 flex justify-end gap-2">
              <Button disabled={busy} onClick={() => { setLocking(false); setError(null) }}>Hủy</Button>
              <Button variant="primary" disabled={busy} onClick={submitLock}>Xác nhận khóa</Button>
            </div>
          </div>}
        </>}
      {error && <p role="alert" className="mt-3 text-[12px] text-err-fg">{error}</p>}
    </Card>
  </section>
}
