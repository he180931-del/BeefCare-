import { Card, Pagination, Table, Td, Th } from '../../../components/ui'
import { formatMoney, formatVnd } from '../domain/financeRules'
import type { CashReport, ScopeTotals } from '../types'
import { activateTableRow, activateTableRowByKey, interactiveRowClass } from '../../../components/interactiveTableRow'

export const REPORT_SCOPE_PAGE_SIZE = 5
export const REPORT_DETAIL_PAGE_SIZE = 5

export function getPageCount(totalRows: number | readonly unknown[], pageSize: number) {
  const total = typeof totalRows === 'number' ? totalRows : totalRows.length
  return Math.max(1, Math.ceil(total / pageSize))
}

export function paginateReportRows<T>(rows: readonly T[], requestedPage: number, pageSize: number) {
  const pageCount = getPageCount(rows, pageSize)
  const page = Math.min(pageCount, Math.max(1, requestedPage))
  return { rows: rows.slice((page - 1) * pageSize, page * pageSize), page, pageCount, total: rows.length }
}

/** Biểu đồ cột thu theo ngày (triệu đồng); cột cuối nhấn màu. */
export function IncomeChart({ days }: { days: CashReport['summary']['dailyIncome'] }) {
  const max = Math.max(1, ...days.map((d) => d.income))
  return (
    <div className="flex h-[170px] items-end gap-1 overflow-x-auto" role="img" aria-label="Thu theo ngày trong kỳ">
      {days.map((d, i) => (
        <div key={d.date} className="flex min-w-[16px] flex-1 flex-col items-center justify-end gap-1" title={`${d.date.slice(8, 10)}/${d.date.slice(5, 7)}: ${formatVnd(d.income)} đ`}>
          <div className={`w-full rounded-[2px] ${i === days.length - 1 ? 'bg-brand' : 'bg-[#cfe5d7]'}`} style={{ height: `${Math.max(2, Math.round((d.income / max) * 140))}px` }} />
          <span className="text-[10px] text-muted">{Number(d.date.slice(8, 10))}</span>
        </div>
      ))}
    </div>
  )
}

export function ScopeTable({ scopes, onFarm, page = 1, onPageChange = () => {} }: { scopes: ScopeTotals[]; onFarm: (row: ScopeTotals) => void; page?: number; onPageChange?: (page: number) => void }) {
  const totalRow = scopes.find((s) => s.scope === 'PLATFORM')
  const pageData = paginateReportRows(scopes.filter((s) => s.scope !== 'PLATFORM'), page, REPORT_SCOPE_PAGE_SIZE)
  return (
    <Card title="Dòng tiền theo phạm vi">
      <Table scroll>
        <thead><tr><Th>Phạm vi</Th><Th>Gói đăng ký</Th><Th>Thu khác</Th><Th>Chi</Th><Th>Ròng</Th></tr></thead>
        <tbody>
          {pageData.rows.map((s) => {
            const net = s.subscriptionReceipts + s.otherIncome - s.expense
            const total = s.scope === 'PLATFORM'
            return (
              <tr
                key={`${s.scope}-${s.farmId ?? s.farmName}`}
                tabIndex={total ? undefined : 0}
                aria-label={total ? undefined : `Mở dòng tiền của ${s.farmName}`}
                className={total ? 'font-semibold' : interactiveRowClass}
                onClick={total ? undefined : (event) => activateTableRow(event, () => onFarm(s))}
                onKeyDown={total ? undefined : (event) => activateTableRowByKey(event, () => onFarm(s))}
              >
                <Td>{s.scope === 'FARM' ? <button type="button" className="cursor-pointer border-0 bg-transparent p-0 text-left text-[12px] font-medium text-brand" onClick={() => onFarm(s)}>{s.farmName}</button> : <span className="font-medium">{s.farmName}</span>}</Td>
                <Td className="whitespace-nowrap">{formatVnd(s.subscriptionReceipts)}</Td>
                <Td className="whitespace-nowrap">{formatVnd(s.otherIncome)}</Td>
                <Td className="whitespace-nowrap">{formatVnd(s.expense)}</Td>
                <Td className="whitespace-nowrap"><span className={net < 0 ? 'font-medium text-err-fg' : ''}>{formatMoney(net)}</span></Td>
              </tr>
            )
          })}
          {totalRow && (() => {
            const s = totalRow
            const net = s.subscriptionReceipts + s.otherIncome - s.expense
            return <tr key="PLATFORM-total" className="font-semibold"><Td>{s.farmName}</Td><Td className="whitespace-nowrap">{formatVnd(s.subscriptionReceipts)}</Td><Td className="whitespace-nowrap">{formatVnd(s.otherIncome)}</Td><Td className="whitespace-nowrap">{formatVnd(s.expense)}</Td><Td className="whitespace-nowrap"><span className={net < 0 ? 'font-medium text-err-fg' : ''}>{formatMoney(net)}</span></Td></tr>
          })()}
        </tbody>
      </Table>
      {pageData.total > REPORT_SCOPE_PAGE_SIZE && <Pagination page={pageData.page} pageCount={pageData.pageCount} onChange={onPageChange} summary={`Hiển thị ${(pageData.page - 1) * REPORT_SCOPE_PAGE_SIZE + 1}–${Math.min(pageData.page * REPORT_SCOPE_PAGE_SIZE, pageData.total)} / ${pageData.total} phạm vi`} />}
    </Card>
  )
}
