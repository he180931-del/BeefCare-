import { Badge, Button, Card, Info, Note, Radio } from '../../../components/ui'
import type { Evidence, PlatformPayment, ReviewDecision } from '../types'
import { fmtDateTime, fmtMoney, fmtSeconds } from '../domain/dates'
import { evidenceCode, evidenceStatusLabel } from '../domain/reconciliation'
import { ReasonField } from './common'

const DECISIONS: Array<[ReviewDecision, string]> = [['ACCEPT', 'Chấp nhận'], ['HOLD', 'Tạm giữ'], ['REJECT', 'Từ chối']]
const PRIMARY: Record<ReviewDecision, string> = { ACCEPT: 'Kiểm tra và chấp nhận', HOLD: 'Lưu tạm giữ', REJECT: 'Lưu từ chối' }

interface Props {
  ev: Evidence
  cand: PlatformPayment | undefined
  decision: ReviewDecision
  setDecision: (d: ReviewDecision) => void
  reason: string
  setReason: (r: string) => void
  reasonError: string | null
  canAct: boolean
  onPrimary: () => void
  onLock: () => void
  onLocked: () => void
}

/** SCR-62: khung xem xét chứng từ ở bên phải. */
export default function EvidencePanel({ ev, cand, decision, setDecision, reason, setReason, reasonError, canAct, onPrimary, onLock, onLocked }: Props) {
  const resolved = ev.paymentId !== null
  const frozen = resolved || ev.lockedForReturn
  const disabled = !canAct || frozen
  const tone = ev.lockedForReturn ? 'err' : ev.reviewStatus === 'TO_REVIEW' ? 'warn' : ev.reviewStatus === 'REJECTED' ? 'err' : ev.reviewStatus === 'HOLD' ? 'info' : 'ok'
  return (
    <Card title="Xem xét chứng từ" sub="SePay · nguồn đã xác thực, chỉ đọc" actions={<Badge tone={tone}>{evidenceStatusLabel(ev)}</Badge>}>
      <Info cols={2} items={[
        ['Mã giao dịch', ev.transactionId],
        ['Số tiền · chiều', `${fmtMoney(ev.amount)} đ · ${ev.direction === 'IN' ? 'tiền vào' : 'tiền ra'}`],
        ['Tài khoản nhận', `${ev.receivingAccount} ✓`],
        ['Ngân hàng ghi nhận', fmtSeconds(ev.bankPaidAt)],
        ['Nội dung CK', ev.content],
        ['Ứng viên khớp', cand ? `${cand.code} · ${fmtMoney(cand.amount)} · hạn ${fmtDateTime(cand.expiresAt).slice(0, 5)} ${fmtDateTime(cand.expiresAt).slice(6, 11)}` : 'Chưa có ứng viên'],
      ]} />
      <fieldset className="mt-3" disabled={disabled}>
        <legend className="mb-1 text-[12px] font-medium text-ink">Quyết định *</legend>
        <div className="flex gap-4">
          {DECISIONS.map(([value, label]) => (
            <Radio key={value} name="decision" checked={decision === value} onChange={() => setDecision(value)}>{label}</Radio>
          ))}
        </div>
      </fieldset>
      <div className="mt-3">
        <ReasonField id="review-reason" label="Lý do & bằng chứng *" value={reason} onChange={setReason} error={reasonError} placeholder="Nêu lý do và tham chiếu bằng chứng" />
      </div>
      {resolved ? (
        <Note tone="ok">Chứng từ đã được phân bổ cho thanh toán; quyết định không thể thay đổi.</Note>
      ) : ev.lockedForReturn ? (
        <Note tone="warn">Nguồn đã khóa chờ hoàn tiền: không thể Chấp nhận hoặc đổi quyết định.</Note>
      ) : (
        <Note tone="warn">Mã chưa khớp chính xác nên chưa thể Chấp nhận. Chọn ứng viên không bỏ qua kiểm tra mã, số tiền, tài khoản, thời gian hay nguồn đã phân bổ. Tạm giữ và Từ chối không xác nhận hoàn tiền.</Note>
      )}
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {ev.lockedForReturn ? (
          <Button onClick={onLocked}>Xem nguồn đã khóa</Button>
        ) : (
          <Button disabled={!canAct || resolved} onClick={onLock}>Khóa chờ hoàn tiền</Button>
        )}
        <Button variant="primary" disabled={disabled} onClick={onPrimary}>{PRIMARY[decision]}</Button>
      </div>
      <p className="mt-2 text-[11px] text-muted">{evidenceCode(ev.id)} · phiên bản {ev.version}</p>
    </Card>
  )
}
