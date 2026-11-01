import { Tile } from '../../../components/ui'
import type { FeedStockRow } from '../types'

const currency = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 })
const quantity = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 })

export function FeedStockSummary({ rows }: { rows: readonly FeedStockRow[] | null }) {
  const stockValue = rows?.reduce((total, row) => total + row.stockValue, 0)
  const averageDailyUse = rows?.reduce((total, row) => total + row.averageDailyUseKg, 0)
  const activeRows = rows?.filter((row) => row.available !== false)
  const lowRows = activeRows?.filter((row) => row.status === 'LOW' || row.status === 'OUT_OF_STOCK')

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Tile
        label="Thức ăn đang dùng"
        value={activeRows === undefined ? '—' : activeRows.length}
        note={activeRows === undefined ? 'Chưa tải được danh mục' : 'Mặt hàng đang hoạt động'}
      />
      <Tile
        label="Sắp hết / hết"
        value={lowRows === undefined ? '—' : lowRows.length}
        note={lowRows === undefined ? 'Chưa tải được danh mục' : 'Sắp hết hoặc hết hàng'}
        warn
      />
      <Tile
        label="Giá trị tồn kho"
        value={stockValue === undefined ? '—' : currency.format(stockValue)}
        note={stockValue === undefined ? 'Chưa tải được dữ liệu' : 'Tổng giá trị các dòng tồn kho'}
      />
      <Tile
        label="Tiêu thụ TB 7 ngày"
        value={averageDailyUse === undefined ? '—' : `${quantity.format(averageDailyUse)} kg/ngày`}
        note={averageDailyUse === undefined ? 'Chưa tải được dữ liệu' : 'Chưa có số liệu theo đầu bò'}
      />
    </div>
  )
}
