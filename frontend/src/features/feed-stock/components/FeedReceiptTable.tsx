import { Badge, Button, Table, Td, Th } from '../../../components/ui'
import { useNavigate } from 'react-router-dom'
import { formatDate, formatKg, formatMoney } from '../domain/feedLabels'
import type { FeedReceipt } from '../types/feedReceipt'

const STATUS: Record<string, { label: string; tone: 'ok' | 'info' | 'outline'; icon?: 'pencil' | 'circle-check' }> = {
  DRAFT: { label: 'NHÁP', tone: 'info', icon: 'pencil' },
  POSTED: { label: 'ĐÃ NHẬP', tone: 'ok', icon: 'circle-check' },
  VOIDED: { label: 'ĐÃ HỦY', tone: 'outline' },
}

export default function FeedReceiptTable({ rows }: { rows: readonly FeedReceipt[] }) {
  const navigate = useNavigate()
  return (
    <Table scroll stack={false}>
      <thead>
        <tr>
          <Th>Mã phiếu</Th>
          <Th>Ngày nhập</Th>
          <Th>Nhà cung cấp</Th>
          <Th>Mặt hàng</Th>
          <Th>Tổng KL</Th>
          <Th>Tổng tiền (đ)</Th>
          <Th>Còn nợ (đ)</Th>
          <Th>Trạng thái</Th>
          <Th aria-label="Thao tác" />
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const status = STATUS[row.status]
          const voided = row.status === 'VOIDED'
          const receivedKg = row.lines.reduce((total, line) => total + line.kgReceived, 0)
          const owed = row.outstanding ?? (row.amountPaid === undefined ? null : row.totalPayable - row.amountPaid)
          const subtitle = voided && row.voidReason ? `Hủy: ${row.voidReason}` : row.invoiceNumber
          const action = row.status === 'DRAFT' ? 'Tiếp tục' : 'Xem'
          return (
            <tr key={row.id} className={`${row.status === 'DRAFT' ? 'bg-[#eef4ef]' : ''} ${voided ? 'text-faint' : ''}`}>
              <Td className="min-w-[130px]">
                <div className="whitespace-nowrap font-medium">{row.code}</div>
                {subtitle && <div className="max-w-[170px] truncate text-[11px] text-muted" title={subtitle}>{subtitle}</div>}
              </Td>
              <Td className="whitespace-nowrap">{formatDate(row.receiptDate)}</Td>
              <Td className="min-w-[150px]">{row.supplierName}</Td>
              <Td className="min-w-[140px]">{row.lines.length ? [...new Set(row.lines.map((line) => line.feedName))].join(', ') : '—'}</Td>
              <Td className="whitespace-nowrap">{formatKg(receivedKg, 0)}</Td>
              <Td className="whitespace-nowrap">{formatMoney(row.totalPayable)}</Td>
              <Td className="whitespace-nowrap">{row.status === 'DRAFT' ? 'nháp' : voided || owed === null ? '—' : formatMoney(owed)}</Td>
              <Td className="whitespace-nowrap">
                {status
                  ? <Badge tone={status.tone} icon={status.icon}>{status.label}</Badge>
                  : <Badge tone="outline">{row.status}</Badge>}
              </Td>
              <Td className="whitespace-nowrap">
                <Button variant="link" size="sm" aria-label={`${action} ${row.code}`} onClick={() => navigate(`/thuc-an/phieu-nhap/${row.id}`)}>{action}</Button>
              </Td>
            </tr>
          )
        })}
      </tbody>
    </Table>
  )
}
