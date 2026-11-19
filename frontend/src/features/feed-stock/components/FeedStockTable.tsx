import { Badge, Button, Table, Td, Th } from '../../../components/ui'
import { useNavigate } from 'react-router-dom'
import { feedGroupLabel, formatDate, formatDaysOfCover, formatKg, formatNumber } from '../domain/feedLabels'
import type { FeedStockRow, FeedStockStatus } from '../types'

const STATUS: Record<FeedStockStatus, { label: string; tone: 'ok' | 'warn' | 'err'; icon?: 'circle-check' | 'alert-triangle' }> = {
  SUFFICIENT: { label: 'Đủ', tone: 'ok', icon: 'circle-check' },
  LOW: { label: 'Sắp hết', tone: 'warn', icon: 'alert-triangle' },
  OUT_OF_STOCK: { label: 'Hết', tone: 'err' },
}

/** Purchase-unit equivalent of the stock ("≈ 44,8 bao 25 kg"), only for packaged feeds. */
function equivalent(row: FeedStockRow) {
  const perUnit = row.kgPerPurchaseUnit ?? 1
  if (!row.purchaseUnit || perUnit <= 1 || row.onHandKg <= 0) return null
  return `≈ ${formatNumber(row.onHandKg / perUnit)} ${row.purchaseUnit.toLocaleLowerCase('vi')} ${formatNumber(perUnit)} kg`
}

export default function FeedStockTable({ rows, onView }: { rows: readonly FeedStockRow[]; onView?: (row: FeedStockRow) => void }) {
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
          <Th aria-label="Thao tác" />
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const status = STATUS[row.status]
          const needsStock = row.status !== 'SUFFICIENT'
          const packs = equivalent(row)
          return (
            <tr key={row.feedItemId}>
              <Td className="whitespace-nowrap font-medium">{row.code}</Td>
              <Td className="min-w-[130px]">
                <div className="font-medium">{row.name}</div>
                <div className="text-[11px] text-muted">{feedGroupLabel(row.group)}</div>
              </Td>
              <Td className="whitespace-nowrap">
                <div className={packs ? 'font-medium' : undefined}>{formatKg(row.onHandKg)}</div>
                {packs && <div className="text-[11px] text-muted">{packs}</div>}
              </Td>
              <Td className="whitespace-nowrap">{row.minimumStockKg === null ? '—' : formatKg(row.minimumStockKg)}</Td>
              <Td className="whitespace-nowrap">{formatKg(row.averageDailyUseKg)}</Td>
              <Td className="whitespace-nowrap">{formatDaysOfCover(row.daysOfCover)}</Td>
              <Td className="whitespace-nowrap">
                {row.nearestLotExpiryDate
                  ? <><div className="font-medium">{row.nearestLotNumber ?? 'Lô gần hạn'}</div><div className="text-[11px] text-muted">HSD {formatDate(row.nearestLotExpiryDate)}</div></>
                  : '—'}
              </Td>
              <Td>
                {status
                  ? <Badge tone={status.tone} icon={status.icon}>{status.label}</Badge>
                  : <Badge tone="outline">{row.status}</Badge>}
              </Td>
              <Td>
                <div className="flex items-center gap-2 whitespace-nowrap">
                  {needsStock && (
                    <Button
                      variant="link"
                      size="sm"
                      disabled={row.available === false}
                      title={row.available === false ? 'Thức ăn đã ngừng hoạt động' : undefined}
                      aria-label={`Nhập kho ${row.name}`}
                      onClick={() => navigate(`/thuc-an/phieu-nhap/moi?feedItemId=${row.feedItemId}`)}
                    >
                      Nhập kho
                    </Button>
                  )}
                  <Button variant="link" size="sm" aria-label={`Xem biến động ${row.name}`} onClick={() => onView?.(row)}>Xem</Button>
                </div>
              </Td>
            </tr>
          )
        })}
      </tbody>
    </Table>
  )
}
