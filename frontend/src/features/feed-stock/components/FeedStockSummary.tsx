import { Metric } from '../../../components/ui'
import { formatNumber, formatVnd } from '../domain/feedLabels'
import type { FeedStockRow } from '../types'

const GROUP_BUCKETS: Array<[string, readonly string[]]> = [
  ['Thô', ['GREEN_ROUGHAGE', 'DRY_ROUGHAGE']],
  ['Tinh', ['CONCENTRATE']],
  ['TMR', ['TMR']],
  ['Khoáng', ['MINERAL_ADDITIVE']],
  ['Sữa', ['CALF_FEED']],
]

export function FeedStockSummary({ rows, headCount }: { rows: readonly FeedStockRow[] | null; headCount?: number | null }) {
  const stockValue = rows?.reduce((total, row) => total + row.stockValue, 0)
  const averageDailyUse = rows?.reduce((total, row) => total + row.averageDailyUseKg, 0)
  const activeRows = rows?.filter((row) => row.available !== false)
  const lowRows = activeRows?.filter((row) => row.status === 'LOW' || row.status === 'OUT_OF_STOCK')
  const groupNote = activeRows?.length
    ? GROUP_BUCKETS.map(([label, groups]) => [label, activeRows.filter((row) => groups.includes(row.group)).length] as const)
      .filter(([, count]) => count > 0).map(([label, count]) => `${label} ${count}`).join(' · ')
    : 'Mặt hàng đang hoạt động'
  const perHead = averageDailyUse !== undefined && headCount
    ? `${headCount} con · ${formatNumber(averageDailyUse / headCount)} kg/con/ngày`
    : 'Chưa có số liệu theo đầu bò'

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Metric compact label="Thức ăn đang dùng" value={activeRows === undefined ? '—' : activeRows.length} sub={activeRows === undefined ? 'Chưa tải được danh mục' : groupNote} />
      <Metric
        compact
        label="Sắp hết / hết"
        value={lowRows === undefined ? '—' : <span className={lowRows.length ? 'text-err-fg' : undefined}>{lowRows.length}</span>}
        sub={lowRows === undefined ? 'Chưa tải được danh mục' : lowRows.length ? lowRows.map((row) => row.name).join(' · ') : 'Không có thức ăn sắp hết'}
      />
      <Metric compact label="Giá trị tồn kho" value={stockValue === undefined ? '—' : formatVnd(stockValue)} sub={stockValue === undefined ? 'Chưa tải được dữ liệu' : 'Theo giá nhập bình quân'} />
      <Metric compact label="Tiêu thụ TB 7 ngày" value={averageDailyUse === undefined ? '—' : `${formatNumber(averageDailyUse, 0)} kg/ngày`} sub={averageDailyUse === undefined ? 'Chưa tải được dữ liệu' : perHead} />
    </div>
  )
}
