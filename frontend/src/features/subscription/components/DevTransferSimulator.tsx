import { useState } from 'react'
import { userFacingError } from '../../../shared/api/userFacingError'
import { Button, Card, inputCls, Note } from '../../../shared/ui'
import { devTransferApi } from '../api/devTransferApi'
import { fmtVnd } from '../domain/subscriptionRules'
import type { Payment } from '../types'

interface Props {
  farmId: number
  payment: Payment
  /** Đọc lại yêu cầu sau khi gửi để màn hiện ngay trạng thái mới. */
  onSent: () => void
}

/**
 * Chỉ môi trường thử (npm run dev): Owner đóng vai ngân hàng + SePay cho yêu cầu đang chờ.
 * Không phải chức năng của SRS; bản build production không có ô này.
 */
export default function DevTransferSimulator({ farmId, payment, onSent }: Props) {
  const [amount, setAmount] = useState(String(payment.amountVnd))
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ tone: 'ok' | 'warn' | 'err'; text: string } | null>(null)

  async function send() {
    const value = Number(amount.trim())
    if (!amount.trim() || !Number.isSafeInteger(value) || value <= 0) {
      setResult({ tone: 'err', text: 'Số tiền phải là số nguyên dương.' })
      return
    }
    setBusy(true)
    setResult(null)
    try {
      const sent = await devTransferApi.simulateTransfer(farmId, payment, value)
      setResult(sent.duplicate
        ? { tone: 'warn', text: 'Giao dịch này đã được ghi nhận trước đó.' }
        : sent.confirmed
          ? { tone: 'ok', text: `Đã giả lập chuyển ${fmtVnd(value)}. Yêu cầu đã được xác nhận.` }
          : { tone: 'warn', text: `Đã giả lập chuyển ${fmtVnd(value)}. Giao dịch chưa khớp yêu cầu nên vẫn chờ; chứng từ chuyển PM đối soát.` })
      onSent()
    } catch (error) {
      setResult({ tone: 'err', text: userFacingError(error, 'Không gửi được giao dịch giả lập.') })
    } finally {
      setBusy(false)
    }
  }

  return (
    // The Bento card is itself the region "Giả lập chuyển khoản" (its section is labelled by the title).
    <Card variant="panel" title="Giả lập chuyển khoản" sub="Chỉ có khi chạy thử. Đóng vai ngân hàng và SePay báo đã nhận tiền cho yêu cầu này; không chuyển tiền thật.">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex w-[220px] max-w-full flex-col gap-1">
          <label htmlFor="simulated-amount" className="text-xs text-muted">Số tiền giả lập (VND)</label>
          <input id="simulated-amount" className={inputCls} inputMode="numeric" value={amount}
            onChange={(e) => { setAmount(e.target.value); setResult(null) }} />
        </div>
        <Button variant="primary" size="bento" disabled={busy} onClick={() => void send()}>Giả lập chuyển khoản</Button>
      </div>
      <p className="m-0 text-[11px] text-muted">Để nguyên {fmtVnd(payment.amountVnd)} để thanh toán thành công; nhập số khác để thử sai số tiền.</p>
      {result && <Note tone={result.tone}>{result.text}</Note>}
    </Card>
  )
}
