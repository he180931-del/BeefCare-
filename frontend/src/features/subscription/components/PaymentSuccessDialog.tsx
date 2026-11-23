import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { asRecord, nullableNumber, textValue } from '../../../shared/api/parse'
import { Button, Icon, Modal, ModalFooter, Note } from '../../../shared/ui'
import { fmtDateTime, fmtVnd, termLabel, toMs } from '../domain/subscriptionRules'
import { CopyButton } from './TransferParts'

const SUCCESS_KEY = 'beefcare.subscription.paymentSuccess'

export interface Confirmation {
  paymentRouteId: string
  quoteRef: string
  amountVnd: number | null
  durationYears: number | null
  period: string
  bankPaidAt: string
  confirmedAt: string
  receiptCode: string
}

/** The confirmation is optional: when the browser refuses to keep it, the paid farm still opens without the dialog. */
export function rememberPaymentSuccess(farmId: number, confirmation: Confirmation) {
  try {
    sessionStorage.setItem(SUCCESS_KEY, JSON.stringify({ farmId, ...confirmation }))
  } catch {
    // Entering the farm matters more than showing the confirmation there.
  }
}

function ReceiptRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="m-0 ml-auto min-w-0 max-w-full text-right text-sm font-semibold wrap-anywhere text-ink">{children}</dd>
    </div>
  )
}

export function PaymentSuccessDialog({ confirmation, farmName, detailHref, error, onClose, onRetry }: {
  confirmation: Confirmation
  farmName?: string
  detailHref?: string
  error?: string
  onClose: () => void
  onRetry?: () => void
}) {
  const { quoteRef, amountVnd, durationYears, period, bankPaidAt, confirmedAt, receiptCode } = confirmation
  const servicePeriod = [durationYears ? termLabel(durationYears) : '', period].filter(Boolean).join(' · ')
  const bankTime = toMs(bankPaidAt)
  const hasBankTime = Number.isFinite(bankTime)
  const timestamp = hasBankTime ? bankTime : toMs(confirmedAt)

  return (
    <Modal title="Thanh toán thành công" width={560} onClose={onClose}>
      <div className="flex flex-col items-center gap-2 rounded-xl border border-field bg-ok-bg px-4 py-5 text-center">
        <span aria-hidden="true" className="grid size-12 place-items-center rounded-full bg-white text-ok-fg">
          <Icon name="circle-check" size={30} />
        </span>
        {amountVnd !== null && (
          <div>
            <p className="m-0 text-sm font-medium text-ok-fg">Số tiền đã thanh toán</p>
            <p className="m-0 mt-1 text-4xl font-bold tabular-nums tracking-tight text-ink">{fmtVnd(amountVnd)}</p>
          </div>
        )}
      </div>
      <dl className="m-0 divide-y divide-field rounded-xl border border-field">
        {farmName && <ReceiptRow label="Trang trại">{farmName}</ReceiptRow>}
        {servicePeriod && <ReceiptRow label="Kỳ dịch vụ">{servicePeriod}</ReceiptRow>}
        {Number.isFinite(timestamp) && (
          <ReceiptRow label={hasBankTime ? 'Ngân hàng ghi nhận' : 'BeefCare xác nhận lúc'}>{fmtDateTime(timestamp)}</ReceiptRow>
        )}
        <ReceiptRow label="Phương thức">Chuyển khoản ngân hàng</ReceiptRow>
        <ReceiptRow label="Mã thanh toán">
          <span className="flex flex-wrap items-center justify-end gap-x-2">
            <span className="font-mono tracking-wide select-all">{quoteRef}</span>
            <CopyButton value={quoteRef} label="mã thanh toán" />
          </span>
        </ReceiptRow>
        {receiptCode && <ReceiptRow label="Mã biên lai">{receiptCode}</ReceiptRow>}
      </dl>
      {error && <Note tone="err">{error}</Note>}
      <ModalFooter>
        {detailHref && (
          <Link to={detailHref} className="inline-flex min-h-[46px] items-center rounded-xl px-4 text-sm font-semibold text-brand hover:bg-ok-bg focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-brand">
            Xem chi tiết giao dịch
          </Link>
        )}
        {onRetry && <Button size="lg" onClick={onClose}>Đóng xác nhận</Button>}
        <Button autoFocus size="lg" variant="primary" onClick={onRetry ?? onClose}>{onRetry ? 'Thử vào trại lại' : 'Tiếp tục'}</Button>
      </ModalFooter>
    </Modal>
  )
}

export function PaymentSuccessOnArrival({ farmId, farmName }: { farmId: number | null; farmName?: string }) {
  const [confirmation, setConfirmation] = useState<(Confirmation & { farmId: number }) | null>(null)

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SUCCESS_KEY)
      if (saved === null) return
      sessionStorage.removeItem(SUCCESS_KEY)
      const receipt = asRecord(JSON.parse(saved))
      if (farmId !== null && receipt.farmId === farmId && typeof receipt.quoteRef === 'string') {
        setConfirmation({
          farmId,
          quoteRef: receipt.quoteRef,
          paymentRouteId: textValue(receipt.paymentRouteId),
          amountVnd: nullableNumber(receipt.amountVnd),
          durationYears: nullableNumber(receipt.durationYears),
          period: textValue(receipt.period),
          bankPaidAt: textValue(receipt.bankPaidAt),
          confirmedAt: textValue(receipt.confirmedAt),
          receiptCode: textValue(receipt.receiptCode),
        })
      }
    } catch {
      // The confirmation is optional for a direct visit to the farm dashboard.
    }
  }, [farmId])

  if (confirmation?.farmId !== farmId) return null
  const { paymentRouteId } = confirmation
  const detailHref = paymentRouteId ? `/goi-dich-vu/lich-su/${encodeURIComponent(paymentRouteId)}?farm=${farmId}` : undefined
  return <PaymentSuccessDialog confirmation={confirmation} farmName={farmName} detailHref={detailHref} onClose={() => setConfirmation(null)} />
}
