import { Table, Td, Th } from '../../../shared/ui'
import type { ExitPayment } from '../types'

export function PaymentTable({ payments }: { payments: ExitPayment[] }) {
  return (
    <Table stack={false}>
      <thead>
        <tr><Th>Ngày · người ghi</Th><Th>Phương thức · tham chiếu</Th><Th>Số tiền (đ)</Th></tr>
      </thead>
      <tbody>
        {payments.map((payment) => (
          <tr key={payment.ref}>
            <Td>{payment.date}<br />{payment.by}</Td>
            <Td>{payment.method}<br />{payment.ref}</Td>
            <Td className="whitespace-nowrap">{Number(payment.amount).toLocaleString('vi-VN')}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}
