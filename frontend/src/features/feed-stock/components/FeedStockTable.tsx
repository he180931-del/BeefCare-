import { Badge, Button, Table, Td, Th } from '../../../components/ui'
import { useNavigate } from 'react-router-dom'
import type { FeedGroup, FeedStockRow, FeedStockStatus } from '../types'

const GROUP_LABELS: Record<FeedGroup, string> = {
  GREEN_ROUGHAGE: 'Thức ăn thô xanh',
  DRY_ROUGHAGE: 'Thức ăn thô khô',
  CONCENTRATE: 'Thức ăn tinh',
  TMR: 'Thức ăn hỗn hợp hoàn chỉnh',
  MINERAL_ADDITIVE: 'Khoáng bổ sung',
  CALF_FEED: 'Thức ăn bê',
}

const STATUS: Record<FeedStockStatus, { label: string; tone: 'ok' | 'warn' | 'err' }> = {
  SUFFICIENT: { label: 'Đủ dùng', tone: 'ok' },
  LOW: { label: 'Sắp hết', tone: 'warn' },
  OUT_OF_STOCK: { label: 'Hết hàng', tone: 'err' },
}

const quantity = (value: number) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value)

function expiryText(row: FeedStockRow) {
  if (!row.nearestLotExpiryDate) return '—'
  const [year, month, day] = row.nearestLotExpiryDate.split('-')
  return `${row.nearestLotNumber ?? 'Lô gần hạn'} · ${day}/${month}/${year}`
}

export default function FeedStockTable({ rows }: { rows: readonly FeedStockRow[] }) {
  const navigate = useNavigate()
  return (
    <Table scroll stack={false}>
      <thead>
        <tr>
          <Th>Mã</Th>
          <Th>Thức ăn</Th>
          <Th>Tồn hiện tại</Th>
          <Th>Tối thiểu</Th>
          <Th>TB/ngày (7 ngày)</Th>
          <Th>Đủ dùng</Th>
          <Th>Lô gần hết hạn</Th>
          <Th>Trạng thái</Th>
          <Th>Thao tác</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.feedItemId}>
            <Td className="whitespace-nowrap font-medium">{row.code}</Td>
            <Td className="min-w-[150px]">
              <div className="font-medium">{row.name}</div>
              <div className="mt-1 text-[11px] text-muted">{GROUP_LABELS[row.group] ?? row.group}</div>
            </Td>
            <Td className="whitespace-nowrap">{quantity(row.onHandKg)} kg</Td>
            <Td className="whitespace-nowrap">{row.minimumStockKg === null ? '—' : `${quantity(row.minimumStockKg)} kg`}</Td>
            <Td className="whitespace-nowrap">{quantity(row.averageDailyUseKg)} kg</Td>
            <Td className="whitespace-nowrap">{row.daysOfCover === null ? '—' : `${quantity(row.daysOfCover)} ngày`}</Td>
            <Td className="min-w-[145px]">{expiryText(row)}</Td>
            <Td>
              {STATUS[row.status]
                ? <Badge tone={STATUS[row.status].tone}>{STATUS[row.status].label}</Badge>
                : <Badge tone="outline">{row.status}</Badge>}
            </Td>
            <Td>
              <div className="flex flex-wrap gap-1">
                <Button
                  size="sm"
                  disabled={row.available === false}
                  title={row.available === false ? 'Thức ăn đã ngừng hoạt động' : undefined}
                  aria-label={`Nhập kho ${row.name}`}
                  onClick={() => navigate(`/thuc-an/phieu-nhap/moi?feedItemId=${row.feedItemId}`)}
                >
                  Nhập kho
                </Button>
                <Button
                  size="sm"
                  disabled
                  title="Lịch sử biến động tồn kho chưa được triển khai"
                  aria-label={`Xem biến động ${row.name}`}
                >
                  Xem
                </Button>
              </div>
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}
