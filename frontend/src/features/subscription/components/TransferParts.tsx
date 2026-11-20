import { useState } from 'react'
import { Badge, Button, Card, Icon, Note, Table, Td, Th } from '../../../shared/ui'
import { subscriptionApi } from '../api/subscriptionApi'
import { BANK_NAMES, fmtAccount, fmtClock, fmtDateTime, fmtVnd, termLabel, toMs, versionLabel } from '../domain/subscriptionRules'
import type { Payment } from '../types'
import { Facts, ICON_BTN, PaymentBadge } from './shared'

/** Không tạo VietQR thật: vùng QR là chỗ giữ chỗ ghi rõ là demo. */
export function QrPlaceholder() {
  return (
    <div role="img" aria-label="Mã VietQR minh họa (demo)" className="mx-auto grid aspect-square w-full max-w-[280px] place-items-center rounded-md bg-chip p-4 text-center">
      <div className="flex flex-col items-center gap-1.5">
        <Icon name="qrcode" size={56} className="text-faint" />
        <span className="text-xs text-muted">Mã thanh toán</span>
        <span className="text-[11px] font-semibold text-warn-fg">Mã QR minh họa (demo), không dùng để chuyển khoản</span>
      </div>
    </div>
  )
}

// text-muted on bg-chip is 5.0:1; the former #8f8f8f was 2.8:1 for the "QR could not load" instruction.
const QR_HIDDEN = 'mx-auto grid aspect-square w-full max-w-[280px] place-items-center rounded-md bg-chip p-4 text-center text-xs text-muted'

/** Reports "copied" only after the clipboard write succeeds; a refused write shows an error instead. */
function useClipboard(value: string) {
  const [done, setDone] = useState(false)
  const [error, setError] = useState(false)
  const copy = async () => {
    setDone(false); setError(false)
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(value)
      setDone(true)
      setTimeout(() => setDone(false), 1500)
    } catch { setError(true) }
  }
  return { done, error, copy }
}

const CopyError = () => <span role="status" className="block text-xs text-err-fg">Không thể sao chép. Vui lòng chép trực tiếp giá trị.</span>

export function CopyButton({ value, label }: { value: string; label: string }) {
  const { done, error, copy } = useClipboard(value)
  return (
    <span><button type="button" aria-label={`Sao chép ${label}`} onClick={copy} className="inline-flex min-h-8 cursor-pointer items-center whitespace-nowrap rounded border-0 bg-transparent px-2 text-xs font-semibold text-[#454545] hover:bg-chip">
      {done ? 'Đã chép' : 'Sao chép'}
    </button>{error && <CopyError />}</span>
  )
}

const remaining = (p: Payment, now: number) => Math.max(0, toMs(p.expiresAt) - now)

/** `phone`: the transfer details are below the QR on phones and beside it on wider screens. */
function QrImage({ url, phone = false }: { url?: string | null; phone?: boolean }) {
  const [failed, setFailed] = useState(false)
  if (subscriptionApi.illustrativeQr) return <QrPlaceholder />
  if (!url || failed) return <div className={QR_HIDDEN}>Không tải được mã QR. Vui lòng dùng thông tin chuyển khoản {phone ? 'bên dưới' : 'bên cạnh'}.</div>
  return <img src={url} alt="Mã VietQR thanh toán" onError={() => setFailed(true)} className="mx-auto aspect-square w-full max-w-[280px] object-contain" />
}

/** Thẻ "Mã thanh toán": QR (ẩn khi hết hạn), bộ đếm ngược và giờ hết hạn. */
export function QrCard({ payment, now }: { payment: Payment; now: number }) {
  const pending = payment.state === 'PENDING' && remaining(payment, now) > 0
  return (
    <Card title="Mã thanh toán" actions={<PaymentBadge state={payment.state} />}>
      <div className="flex flex-col gap-4">
        {pending ? <QrImage key={payment.qrImageUrl} url={payment.qrImageUrl} /> : <div className={QR_HIDDEN}>{payment.state === 'PAID' ? 'Đã nhận thanh toán' : payment.state === 'CANCELLED' ? 'Yêu cầu đã hủy' : 'Mã QR không còn hiệu lực'}</div>}
        <Facts cols={2} items={[
          [pending ? 'Còn hiệu lực' : 'Trạng thái', pending ? <span key="c" className="tabular-nums" aria-live="off">{fmtClock(remaining(payment, now))}</span> : <PaymentBadge key="b" state={payment.state} />],
          ['Hết hạn lúc', fmtDateTime(payment.expiresAt)],
        ]} />
      </div>
    </Card>
  )
}

const rows = (p: Payment): Array<[string, string, string]> => [
  ['Ngân hàng nhận', BANK_NAMES[p.bankCode] ?? p.bankCode, BANK_NAMES[p.bankCode] ?? p.bankCode],
  ['Số tài khoản', fmtAccount(p.accountNumber), p.accountNumber],
  ['Chủ tài khoản', p.accountName, p.accountName],
  ['Số tiền', fmtVnd(p.amountVnd), String(p.amountVnd)],
  ['Nội dung chuyển khoản', p.quoteRef, p.quoteRef],
]

export function TransferInfoCard({ payment }: { payment: Payment }) {
  // D38: a cancelled request's details stay readable for reference, but nothing invites copying them into a transfer.
  const copyable = payment.state !== 'CANCELLED'
  return (
    <Card title="Thông tin chuyển khoản">
      <Table stack={false}>
        <thead><tr><Th>Trường</Th><Th>Giá trị</Th><Th className="w-24"><span className="sr-only">Sao chép</span></Th></tr></thead>
        <tbody>
          {rows(payment).map(([k, v, raw]) => (
            <tr key={k}>
              <Td className="font-medium">{k}</Td>
              <Td>{v}</Td>
              <Td>{copyable && <CopyButton value={raw} label={k.toLowerCase()} />}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  )
}

function Step({ name, time, badge }: { name: string; time: string; badge: 'done' | 'waiting' | 'not-yet' }) {
  return (
    <tr>
      <Td className="font-medium">{name}</Td>
      <Td>{time}</Td>
      <Td>{badge === 'done' ? <Badge tone="ok">Xong</Badge> : <Badge tone="outline">{badge === 'waiting' ? 'Đang chờ' : 'Chưa'}</Badge>}</Td>
    </tr>
  )
}

export function ProgressCard({ payment, checking, onCheck, onHistory }: { payment: Payment; checking: boolean; onCheck: () => void; onHistory: () => void }) {
  const received = payment.receivedAt
  const confirmed = payment.confirmedAt
  return (
    <Card title="Tiến trình">
      <div className="flex flex-col gap-4">
        <Table stack={false}>
          <thead><tr><Th>Bước</Th><Th>Thời điểm</Th><Th>Trạng thái</Th></tr></thead>
          <tbody>
            <Step name="Đã tạo yêu cầu" time={fmtDateTime(payment.requestedAt)} badge="done" />
            {/* Only an open request is still waiting for the bank; a cancelled one shows "Chưa" (D38). */}
            <Step name="Ngân hàng ghi nhận giao dịch" time={received ? fmtDateTime(received) : '—'} badge={received ? 'done' : payment.state === 'CANCELLED' ? 'not-yet' : 'waiting'} />
            <Step name="Xác nhận & cấp kỳ dịch vụ" time={confirmed ? fmtDateTime(confirmed) : '—'} badge={confirmed ? 'done' : 'not-yet'} />
            {payment.cancelledAt && <Step name="Đã hủy yêu cầu" time={fmtDateTime(payment.cancelledAt)} badge="done" />}
          </tbody>
        </Table>
        <div className="flex flex-wrap gap-2.5">
          <Button disabled={checking} onClick={onCheck}>{checking ? 'Đang kiểm tra…' : 'Kiểm tra lại'}</Button>
          <Button onClick={onHistory}>Xem lịch sử</Button>
        </div>
      </div>
    </Card>
  )
}

/** Bố cục điện thoại 390: thẻ yêu cầu, mã QR, thông tin ngắn, ghi chú, hai nút (frame 2638:4108). */
export function PhoneTransfer({ payment, now, checking, onCheck, onClose, onCancel }: { payment: Payment; now: number; checking: boolean; onCheck: () => void; onClose: () => void; onCancel?: () => void }) {
  const pending = payment.state === 'PENDING'
  const box = 'rounded-lg border border-edge bg-white p-4'
  return (
    <div className="flex flex-col gap-3">
      <div className={`${box} flex flex-col gap-1.5`}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-base font-bold text-brand">{payment.quoteRef}</span>
          <PaymentBadge state={payment.state} icon={pending ? 'clock' : undefined} />
        </div>
        <span className="text-[13px] font-medium text-ink">{termLabel(payment.durationYears)} · bảng giá {versionLabel(payment.priceVersionId)} · {fmtVnd(payment.amountVnd)}</span>
        <span className="text-[11px] text-muted">
          {pending ? `Còn hiệu lực · hết hạn ${fmtDateTime(payment.expiresAt)} · còn ${fmtClock(remaining(payment, now))}` : payment.cancelledAt ? `Đã hủy ${fmtDateTime(payment.cancelledAt)}` : `Hết hạn ${fmtDateTime(payment.expiresAt)}`}
        </span>
      </div>
      <div className={box}>{pending && remaining(payment, now) > 0 ? <QrImage key={payment.qrImageUrl} url={payment.qrImageUrl} phone /> :<div className={QR_HIDDEN}>{payment.state === 'CANCELLED' ? 'Yêu cầu đã hủy' : 'Mã QR không còn hiệu lực'}</div>}</div>
      <div className={`${box} flex flex-col gap-3`}>
        <Facts cols={2} items={[
          ['Ngân hàng', `${payment.bankCode} · ${payment.accountNumber}`],
          ['Chủ tài khoản', payment.accountName],
          ['Số tiền', fmtVnd(payment.amountVnd)],
          ['Nội dung', payment.quoteRef],
        ]} />
        {payment.state !== 'CANCELLED' && <CopyWide value={payment.quoteRef} />}
      </div>
      {payment.state !== 'CANCELLED' && <Note tone="info">Đóng màn này không hủy yêu cầu. Chỉ chứng từ ngân hàng hợp lệ mới cấp kỳ dịch vụ; không có nút tự đánh dấu đã trả.</Note>}
      <div className="grid grid-cols-2 gap-2.5">
        <Button block onClick={onClose}>Đóng</Button>
        <Button block variant="primary" disabled={checking} onClick={onCheck}>{checking ? 'Đang kiểm tra…' : 'Kiểm tra lại'}</Button>
      </div>
      {onCancel && <Button block variant="link" onClick={onCancel}>Hủy yêu cầu</Button>}
    </div>
  )
}

/** Phone layout (frame 2638:4108): full-width button for the transfer content. */
function CopyWide({ value }: { value: string }) {
  const { done, error, copy } = useClipboard(value)
  return (
    <div className="flex flex-col gap-1">
      <Button size="sm" block className={ICON_BTN} onClick={copy}>{done ? 'Đã chép nội dung chuyển khoản' : 'Sao chép nội dung chuyển khoản'}</Button>
      {error && <CopyError />}
    </div>
  )
}
