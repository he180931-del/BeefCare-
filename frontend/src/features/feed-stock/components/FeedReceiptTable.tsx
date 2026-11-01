import { Badge, Button, Table, Td, Th } from '../../../components/ui'
import { useNavigate } from 'react-router-dom'
import type { FeedReceipt } from '../types/feedReceipt'

const STATUS: Record<string, { label: string; tone: 'ok' | 'warn' | 'err' }> = {
  DRAFT: { label: 'Nháp', tone: 'warn' },
  POSTED: { label: 'Đã ghi', tone: 'ok' },
  VOIDED: { label: 'Đã hủy', tone: 'err' },
}
const quantity = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 })
const currency = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 })

function dateText(date: string) {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : date
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
          <Th>Hóa đơn / phiếu giao</Th>
          <Th>Thức ăn</Th>
          <Th>Tổng khối lượng</Th>
          <Th>Tổng tiền (đ)</Th>
          <Th>Còn nợ</Th>
          <Th>Trạng thái</Th>
          <Th>Thao tác</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const status = STATUS[row.status]
          const receivedKg = row.lines.reduce((total, line) => total + line.kgReceived, 0)
          return (
            <tr key={row.id}>
              <Td className="whitespace-nowrap font-semibold">{row.code}</Td>
              <Td className="whitespace-nowrap">{dateText(row.receiptDate)}</Td>
              <Td className="min-w-[150px]">{row.supplierName}</Td>
              <Td>—</Td>
              <Td className="min-w-[180px]">
                {row.lines.length
                  ? row.lines.map((line) => <div key={line.id}>{line.feedName}</div>)
                  : '—'}
              </Td>
              <Td className="whitespace-nowrap">{quantity.format(receivedKg)} kg</Td>
              <Td className="whitespace-nowrap">{currency.format(row.totalPayable)}</Td>
              <Td>—</Td>
              <Td>
                <div className="flex flex-col items-start gap-1">
                  {status
                    ? <Badge tone={status.tone}>{status.label}</Badge>
                    : <Badge tone="outline">{row.status}</Badge>}
                  {row.status === 'VOIDED' && <span className="text-[11px] text-muted">Lý do: —</span>}
                </div>
              </Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  <Button
                    size="sm"
                    aria-label={`${row.status === 'DRAFT' ? 'Tiếp tục' : 'Xem'} ${row.code}`}
                    onClick={() => navigate(`/thuc-an/phieu-nhap/${row.id}`)}
                  >
                    {row.status === 'DRAFT' ? 'Tiếp tục' : 'Xem'}
                  </Button>
                  {row.status === 'POSTED' && <>
                    <Button size="sm" disabled title="Màn hình ghi thanh toán chưa được triển khai" aria-label={`Ghi thanh toán ${row.code}`}>Thanh toán</Button>
                    <Button size="sm" disabled title="Thao tác hủy phiếu chưa được triển khai" aria-label={`Hủy phiếu ${row.code}`}>Hủy phiếu</Button>
                  </>}
                </div>
              </Td>
            </tr>
          )
        })}
      </tbody>
    </Table>
  )
}
