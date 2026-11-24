import { DEFAULT_FARM_TIME_ZONE, parseBusinessTime } from '../../../shared/lib/date/farmTime'
import { formatDate, formatKg, formatNumber, formatVnd } from '../domain/feedLabels'
import type { FeedReceipt, FeedReceiptAttachment, FeedReceiptPayment } from '../types/feedReceipt'
import './FeedReceiptPrintView.css'

type FeedReceiptPrintViewProps = {
  receipt: FeedReceipt
  attachments: FeedReceiptAttachment[]
  farmName?: string | null
}

const paymentStateLabels: Record<string, string> = {
  UNPAID: 'Chưa thanh toán',
  PARTLY_PAID: 'Thanh toán một phần',
  PAID: 'Đã thanh toán',
}

const paymentMethodLabels: Record<string, string> = {
  CASH: 'Tiền mặt',
  BANK_TRANSFER: 'Chuyển khoản',
}

const valueOrDash = (value: string | number | null | undefined) => value === null || value === undefined || value === '' ? '—' : String(value)

function formatAuditTime(value: string | undefined) {
  if (!value) return ''
  const time = new Date(parseBusinessTime(value))
  return Number.isNaN(time.getTime())
    ? value
    : time.toLocaleString('vi-VN', { timeZone: DEFAULT_FARM_TIME_ZONE, dateStyle: 'short', timeStyle: 'short' })
}

function statusLabel(status: string) {
  if (status === 'DRAFT') return 'BẢN NHÁP — CHƯA CỘNG KHO'
  if (status === 'POSTED') return 'ĐÃ GHI SỔ'
  if (status === 'VOIDED') return 'ĐÃ HỦY'
  return status
}

function paymentStateLabel(state: string | undefined) {
  return state ? paymentStateLabels[state] ?? state : 'Chưa có dữ liệu thanh toán'
}

function paymentMethodLabel(method: string | null | undefined) {
  return method ? paymentMethodLabels[method] ?? method : '—'
}

function PaymentHistory({ payments }: { payments?: FeedReceiptPayment[] }) {
  if (!payments?.length) return <p className="feed-receipt-print-muted">Chưa có dữ liệu thanh toán</p>
  return (
    <table aria-label="Lịch sử thanh toán">
      <thead>
        <tr><th>Ngày</th><th>Phương thức</th><th>Số tiền</th><th>Nội dung / người ghi</th><th>Trạng thái</th></tr>
      </thead>
      <tbody>
        {payments.map((payment) => (
          <tr key={payment.id} className="feed-receipt-print-avoid-break">
            <td>{formatDate(payment.paymentDate)}</td>
            <td>{paymentMethodLabel(payment.method)}</td>
            <td className="feed-receipt-print-money">{formatVnd(payment.amount)}</td>
            <td>{valueOrDash(payment.reference || payment.note)}{payment.recordedByName && <><br /><span className="feed-receipt-print-muted">{payment.recordedByName}</span></>}</td>
            <td>{payment.status === 'VOIDED' ? `Đã hủy${payment.voidReason ? ` · ${payment.voidReason}` : ''}` : payment.status === 'RECORDED' ? 'Đã ghi' : valueOrDash(payment.status)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ReceiptAudit({ receipt }: { receipt: FeedReceipt }) {
  const rows = [
    { label: 'Tạo phiếu', actor: receipt.createdByName, at: receipt.createdAt },
    { label: 'Ghi sổ', actor: receipt.postedByName, at: receipt.postedAt },
    { label: 'Hủy phiếu', actor: receipt.voidedByName, at: receipt.voidedAt },
  ].filter((row) => row.actor || row.at)
  const hasHistory = rows.length > 0 || Boolean(receipt.voidReason)

  if (!hasHistory) return <p className="feed-receipt-print-muted">Chưa có dữ liệu lịch sử</p>
  return (
    <div className="feed-receipt-print-audit">
      {rows.map((row) => <div key={row.label}><dt>{row.label}</dt><dd>{[row.actor, formatAuditTime(row.at)].filter(Boolean).join(' · ')}</dd></div>)}
      {receipt.voidReason && <div><dt>Lý do hủy</dt><dd>{receipt.voidReason}</dd></div>}
    </div>
  )
}

export function FeedReceiptPrintView({ receipt, attachments, farmName }: FeedReceiptPrintViewProps) {
  const totalKg = receipt.lines.reduce((sum, line) => sum + line.kgReceived, 0)
  const statusClass = receipt.status === 'DRAFT' ? 'feed-receipt-print-status--draft' : receipt.status === 'VOIDED' ? 'feed-receipt-print-status--voided' : ''

  return (
    <article className="feed-receipt-print-root" data-testid="feed-receipt-print">
      <header className="feed-receipt-print-header feed-receipt-print-avoid-break">
        <div>
          {farmName && <div className="feed-receipt-print-farm">{farmName}</div>}
          <div className="feed-receipt-print-muted">BeefCare</div>
        </div>
        <div className={`feed-receipt-print-status ${statusClass}`}>{statusLabel(receipt.status)}</div>
      </header>

      <h1>PHIẾU NHẬP KHO THỨC ĂN</h1>
      <dl className="feed-receipt-print-meta feed-receipt-print-avoid-break" style={{ marginTop: '10px' }}>
        <div><dt>Mã phiếu</dt><dd>{receipt.code}</dd></div>
        <div><dt>Ngày nhập kho</dt><dd>{formatDate(receipt.receiptDate)}</dd></div>
        <div><dt>Nhà cung cấp</dt><dd>{receipt.supplierName}</dd></div>
        {receipt.invoiceNumber && <div><dt>Số hóa đơn / phiếu giao</dt><dd>{receipt.invoiceNumber}</dd></div>}
        {receipt.receivedBy && <div><dt>Người nhận hàng</dt><dd>{receipt.receivedBy}</dd></div>}
        {receipt.storageLocation && <div><dt>Nơi để</dt><dd>{receipt.storageLocation}</dd></div>}
      </dl>
      {receipt.note && <p className="feed-receipt-print-note"><strong>Ghi chú:</strong> {receipt.note}</p>}
      {receipt.status === 'VOIDED' && receipt.voidReason && <p className="feed-receipt-print-void-reason"><strong>Lý do hủy:</strong> {receipt.voidReason}</p>}

      <section>
        <h2>Danh sách thức ăn</h2>
        <table aria-label="Danh sách thức ăn nhập kho">
          <thead>
            <tr><th style={{ width: '5%' }}>STT</th><th style={{ width: '20%' }}>Mã / tên thức ăn</th><th style={{ width: '12%' }}>Số lô</th><th style={{ width: '12%' }}>Hạn dùng</th><th style={{ width: '13%' }}>SL mua / đơn vị</th><th style={{ width: '12%' }}>Quy đổi kg</th><th style={{ width: '13%' }}>Đơn giá</th><th style={{ width: '13%' }}>Thành tiền</th></tr>
          </thead>
          <tbody>
            {receipt.lines.map((line, index) => (
              <tr key={line.id} className="feed-receipt-print-avoid-break">
                <td>{index + 1}</td>
                <td><strong>{line.feedCode}</strong><br />{line.feedName}</td>
                <td>{valueOrDash(line.lotNumber)}</td>
                <td>{line.expiryDate ? formatDate(line.expiryDate) : '—'}</td>
                <td>{formatNumber(line.quantityPurchase, 3)} {valueOrDash(line.purchaseUnit)}</td>
                <td>{formatKg(line.kgReceived, 3)}</td>
                <td className="feed-receipt-print-money">{formatVnd(line.unitPrice)} / {valueOrDash(line.purchaseUnit)}</td>
                <td className="feed-receipt-print-money">{formatVnd(line.lineAmount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="feed-receipt-print-avoid-break"><th colSpan={5}>Tổng</th><th>{formatKg(totalKg, 3)}</th><th /><th className="feed-receipt-print-money">{formatVnd(receipt.goodsAmount)}</th></tr>
          </tfoot>
        </table>
      </section>

      <section className="feed-receipt-print-avoid-break">
        <h2>Tài chính và thanh toán</h2>
        <dl className="feed-receipt-print-financial">
          <div><dt>Tiền hàng</dt><dd className="feed-receipt-print-money">{formatVnd(receipt.goodsAmount)}</dd></div>
          <div><dt>Phí vận chuyển</dt><dd className="feed-receipt-print-money">{formatVnd(receipt.transportFee)}</dd></div>
          <div><dt>Tổng phải trả</dt><dd className="feed-receipt-print-money"><strong>{formatVnd(receipt.totalPayable)}</strong></dd></div>
          <div><dt>Đã thanh toán</dt><dd className="feed-receipt-print-money">{receipt.amountPaid === undefined ? '—' : formatVnd(receipt.amountPaid)}</dd></div>
          <div><dt>Còn nợ</dt><dd className="feed-receipt-print-money">{receipt.outstanding === undefined ? '—' : formatVnd(receipt.outstanding)}</dd></div>
          <div><dt>Tình trạng thanh toán</dt><dd>{paymentStateLabel(receipt.paymentState)}</dd></div>
          {receipt.paymentMethod && <div><dt>Phương thức ban đầu</dt><dd>{paymentMethodLabel(receipt.paymentMethod)}</dd></div>}
          {receipt.paymentDate && <div><dt>Ngày trả lần đầu</dt><dd>{formatDate(receipt.paymentDate)}</dd></div>}
          {receipt.paymentDueDate && <div><dt>Hạn trả phần nợ</dt><dd>{formatDate(receipt.paymentDueDate)}</dd></div>}
        </dl>
        <div style={{ marginTop: '9px' }}><PaymentHistory payments={receipt.payments} /></div>
      </section>

      <section className="feed-receipt-print-avoid-break">
        <h2>Chứng từ đính kèm</h2>
        {attachments.length ? <ul style={{ margin: 0, paddingLeft: '18px' }}>{attachments.map((attachment) => <li key={attachment.id}>{attachment.originalFilename} <span className="feed-receipt-print-muted">({attachment.contentType}, {Math.ceil(attachment.fileSize / 1024)} KB)</span></li>)}</ul> : <p className="feed-receipt-print-muted">Không có chứng từ đính kèm.</p>}
      </section>

      <section className="feed-receipt-print-avoid-break">
        <h2>Lịch sử phiếu</h2>
        <ReceiptAudit receipt={receipt} />
      </section>

      <section className="feed-receipt-print-signatures feed-receipt-print-avoid-break" aria-label="Ô ký xác nhận">
        {['Người lập phiếu', 'Người giao hàng', 'Người nhận hàng', 'Thủ kho'].map((label) => <div key={label}><div className="feed-receipt-print-signature-line">{label}</div></div>)}
      </section>
    </article>
  )
}
