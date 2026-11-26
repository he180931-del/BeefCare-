import { Metric } from '../../../shared/ui'
import { formatNumber, formatVnd } from '../domain/feedLabels'
import type { FeedStockRow } from '../types'

const GROUP_BUCKETS: Array<[string, readonly string[]]> = [
  ['Thô', ['GREEN_ROUGHAGE', 'DRY_ROUGHAGE']],
  ['Tinh', ['CONCENTRATE']],
  ['TMR', ['TMR']],
  ['Khoáng', ['MINERAL_ADDITIVE']],
  ['Sữa', ['CALF_FEED']],
]

function hasUnavailableConsumption(row: Pick<FeedStockRow, 'averageDailyUseKg' | 'daysOfCover'>) {
  return row.averageDailyUseKg === 0 && row.daysOfCover === null
}

export function FeedStockSummary({ rows, headCount }: { rows: readonly FeedStockRow[] | null; headCount?: number | null }) {
  const stockValue = rows?.reduce((total, row) => total + row.stockValue, 0)
  const averageDailyUse = rows?.reduce((total, row) => total + row.averageDailyUseKg, 0)
  const consumptionUnavailable = Boolean(rows?.length && averageDailyUse === 0 && rows.some(hasUnavailableConsumption))
  const activeRows = rows?.filter((row) => row.available !== false)
  const lowRows = activeRows?.filter((row) => row.status === 'LOW' || row.status === 'OUT_OF_STOCK')
  // Khối nổi bật của màn tồn kho là việc cần xử lý (docs/BeefCare-Bento-Grid.md §1, §3): đỏ khi có mặt hàng đã hết,
  // vàng khi chỉ sắp hết, trắng khi không có gì cần nhập thêm.
  const lowTone = lowRows?.some((row) => row.status === 'OUT_OF_STOCK') ? 'err' : lowRows?.length ? 'warn' : 'default'
  const groupNote = activeRows?.length
    ? GROUP_BUCKETS.map(([label, groups]) => [label, activeRows.filter((row) => groups.includes(row.group)).length] as const)
      .filter(([, count]) => count > 0).map(([label, count]) => `${label} ${count}`).join(' · ')
    : 'Mặt hàng đang hoạt động'
  const perHead = averageDailyUse !== undefined && !consumptionUnavailable && headCount
    ? `${headCount} con · ${formatNumber(averageDailyUse / headCount)} kg/con/ngày`
    : consumptionUnavailable ? 'Chưa đủ dữ liệu tiêu thụ' : 'Chưa có số liệu theo đầu bò'
  const consumptionValue = averageDailyUse === undefined || consumptionUnavailable
    ? '—'
    : `${formatNumber(averageDailyUse, 0)} kg/ngày`

  return (
    <section aria-label="Chỉ số tồn kho" className="grid grid-cols-1 gap-4 @min-[640px]:grid-cols-2 @min-[1024px]:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
      <Metric
        surface="panel"
        tone={lowTone}
        label="Sắp hết / hết"
        value={lowRows === undefined ? '—' : <span className={lowRows.length ? 'text-err-fg' : undefined}>{lowRows.length}</span>}
        sub={lowRows === undefined ? 'Chưa tải được danh mục' : lowRows.length ? lowRows.map((row) => row.name).join(' · ') : 'Không có thức ăn sắp hết'}
      />
      <Metric compact surface="panel" label="Thức ăn đang dùng" value={activeRows === undefined ? '—' : activeRows.length} sub={activeRows === undefined ? 'Chưa tải được danh mục' : groupNote} />
      <Metric compact surface="panel" label="Giá trị tồn kho" value={stockValue === undefined ? '—' : formatVnd(stockValue)} sub={stockValue === undefined ? 'Chưa tải được dữ liệu' : 'Theo giá nhập bình quân'} />
      <Metric compact surface="panel" label="Tiêu thụ TB 7 ngày" value={consumptionValue} sub={averageDailyUse === undefined ? 'Chưa tải được dữ liệu' : perHead} />
    </section>
  )
}
