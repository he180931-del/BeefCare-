import { Badge, Button, Table, Td, Th } from './index'
import { canVoidVoucherPayment, type VoucherPayment } from '../domain/voucherPayment'
import { dmy, money } from '../lib/format'
import { toBusinessTime } from '../lib/date/farmTime'

export function VoucherPaymentTable({ payments, onVoid }: { payments: VoucherPayment[]; onVoid?: (payment: VoucherPayment) => void }) {
  // Chưa có khoản nào: một dòng chữ thay vì bảng chỉ có tiêu đề cột (cả trên màn hình lẫn khi in).
  if (!payments.length) return <p className="m-0 text-xs text-muted">Chưa ghi khoản thanh toán nào.</p>
  return <Table stack={false}>
    <thead><tr><Th>Ngày · người ghi</Th><Th>Phương thức · tham chiếu</Th><Th>Số tiền (đ)</Th></tr></thead>
    <tbody>{payments.map((payment, index) => {
      const voided = payment.status === 'VOIDED'
      const at = toBusinessTime(payment.voidedAt)
      return <tr key={payment.id == null ? `legacy:${index}` : `id:${payment.id}`}>
        <Td>{/^\d{4}-\d{2}-\d{2}$/.test(payment.date) ? dmy(payment.date) : payment.date}<br />{payment.by}</Td>
        <Td className="break-words">{payment.method}<br />{payment.ref || '—'}
          <div className="text-[11px] text-muted">{payment.note || '—'}</div>
          {voided && <div className="text-[11px] text-muted">Lý do: {payment.voidReason || '—'}{at && ` · ${dmy(at.slice(0, 10))} ${at.slice(11, 16)}`}</div>}
        </Td>
        <Td><span className={voided ? 'whitespace-nowrap line-through' : 'whitespace-nowrap'}>{money(payment.amount)}</span>
          {voided && <div><Badge>Đã hủy</Badge></div>}
          {onVoid && canVoidVoucherPayment(payment) && <div><Button onClick={() => onVoid(payment)}>Hủy</Button></div>}
        </Td>
      </tr>
    })}</tbody>
  </Table>
}
