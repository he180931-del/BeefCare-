import { useState } from 'react'
import { Icon } from '../../../components/Icon'
import { Badge, Button, Card, Note, Table, Th, Td } from '../../../components/ui'
import { BANK_NAMES, fmtAccount, fmtClock, fmtTimeDate, fmtVnd, termLabel, toMs, versionLabel } from '../domain/subscriptionRules'
import type { Payment } from '../types'
import { Facts, ICON_BTN, PaymentBadge } from './shared'

/** Không tạo VietQR thật: vùng QR là chỗ giữ chỗ ghi rõ là demo. */
export function QrPlaceholder() {
  return (
    <div role="img" aria-label="Mã VietQR minh họa (demo)" className="mx-auto grid aspect-square w-full max-w-[280px] place-items-center rounded-md bg-chip p-4 text-center">
      <div className="flex flex-col items-center gap-1.5">
        <Icon name="qrcode" size={56} className="text-faint" />
        <span className="text-xs text-faint">Mã thanh toán</span>
        <span className="text-[11px] font-semibold text-warn-fg">Mã QR minh họa (demo), không dùng để chuyển khoản</span>
      </div>
    </div>
  )
}

const QR_HIDDEN = 'mx-auto grid aspect-square w-full max-w-[280px] place-items-center rounded-md bg-chip p-4 text-center text-xs text-faint'

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard?.writeText(value) } catch { /* trình duyệt chặn clipboard: vẫn báo đã chọn để người dùng chép tay */ }
    setDone(true)
    setTimeout(() => setDone(false), 1500)
  }
  return (
    <button type="button" aria-label={`Sao chép ${label}`} onClick={copy} className="cursor-pointer whitespace-nowrap border-0 bg-transparent p-0 text-xs font-semibold text-[#454545]">
      {done ? 'Đã chép' : 'Sao chép'}
    </button>
  )
}

const remaining = (p: Payment, now: number) => Math.max(0, toMs(p.expiresAt) - now)

/** Thẻ "Mã thanh toán": QR (ẩn khi hết hạn), bộ đếm ngược và giờ hết hạn. */
export function QrCard({ payment, now }: { payment: Payment; now: number }) {
  const pending = payment.state === 'PENDING'
  return (
    <Card title="Mã thanh toán" actions={<PaymentBadge state={payment.state} />}>
      <div className="flex flex-col gap-4">
        {pending ? <QrPlaceholder /> : <div className={QR_HIDDEN}>{payment.state === 'EXPIRED' ? 'Mã QR không còn hiệu lực' : 'Đã nhận thanh toán'}</div>}
        <Facts cols={2} items={[
          [pending ? 'Còn hiệu lực' : 'Trạng thái', pending ? <span key="c" className="tabular-nums" aria-live="off">{fmtClock(remaining(payment, now))}</span> : <PaymentBadge key="b" state={payment.state} />],
          ['Hết hạn lúc', fmtTimeDate(payment.expiresAt)],
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
  return (
    <Card title="Thông tin chuyển khoản">
      <Table stack={false}>
        <thead><tr><Th>Trường</Th><Th>Giá trị</Th><Th className="w-24"><span className="sr-only">Sao chép</span></Th></tr></thead>
        <tbody>
          {rows(payment).map(([k, v, raw]) => (
            <tr key={k}>
              <Td className="font-medium">{k}</Td>
              <Td>{v}</Td>
              <Td><CopyButton value={raw} label={k.toLowerCase()} /></Td>
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
            <Step name="Đã tạo yêu cầu" time={fmtTimeDate(payment.requestedAt)} badge="done" />
            <Step name="Ngân hàng ghi nhận giao dịch" time={received ? fmtTimeDate(received) : '—'} badge={received ? 'done' : 'waiting'} />
            <Step name="Xác nhận & cấp kỳ dịch vụ" time={confirmed ? fmtTimeDate(confirmed) : '—'} badge={confirmed ? 'done' : 'not-yet'} />
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
export function PhoneTransfer({ payment, now, checking, onCheck, onClose }: { payment: Payment; now: number; checking: boolean; onCheck: () => void; onClose: () => void }) {
  const pending = payment.state === 'PENDING'
  const box = 'rounded-lg border border-edge bg-white p-4'
  return (
    <div className="flex flex-col gap-3">
      <div className={`${box} flex flex-col gap-1.5`}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-base font-bold text-brand">{payment.quoteRef}</span>
          {pending ? <Badge tone="warn" icon="clock">Chờ thanh toán</Badge> : <PaymentBadge state={payment.state} />}
        </div>
        <span className="text-[13px] font-medium text-ink">{termLabel(payment.durationYears)} · bảng giá {versionLabel(payment.priceVersionId)} · {fmtVnd(payment.amountVnd)}</span>
        <span className="text-[11px] text-muted">
          {pending ? `Còn hiệu lực · hết hạn ${fmtTimeDate(payment.expiresAt)} · còn ${fmtClock(remaining(payment, now))}` : `Hết hạn ${fmtTimeDate(payment.expiresAt)}`}
        </span>
      </div>
      <div className={box}>{pending ? <QrPlaceholder /> : <div className={QR_HIDDEN}>Mã QR không còn hiệu lực</div>}</div>
      <div className={`${box} flex flex-col gap-3`}>
        <Facts cols={2} items={[
          ['Ngân hàng', `${payment.bankCode} · ${payment.accountNumber}`],
          ['Chủ tài khoản', payment.accountName],
          ['Số tiền', fmtVnd(payment.amountVnd)],
          ['Nội dung', payment.quoteRef],
        ]} />
        <CopyWide value={payment.quoteRef} />
      </div>
      <Note tone="info">Đóng màn này không hủy yêu cầu. Chỉ chứng từ ngân hàng hợp lệ mới cấp kỳ dịch vụ; không có nút tự đánh dấu đã trả.</Note>
      <div className="grid grid-cols-2 gap-2.5">
        <Button block onClick={onClose}>Đóng</Button>
        <Button block variant="primary" disabled={checking} onClick={onCheck}>{checking ? 'Đang kiểm tra…' : 'Kiểm tra lại'}</Button>
      </div>
    </div>
  )
}

function CopyWide({ value }: { value: string }) {
  const [done, setDone] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard?.writeText(value) } catch { /* bỏ qua, xem CopyButton */ }
    setDone(true)
    setTimeout(() => setDone(false), 1500)
  }
  return <Button size="sm" block className={ICON_BTN} onClick={copy}>{done ? 'Đã chép nội dung chuyển khoản' : 'Sao chép nội dung chuyển khoản'}</Button>
}
