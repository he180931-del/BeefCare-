import { Card, Table, Td, Th } from '../../../components/ui'
import { formatMoney, formatVnd } from '../domain/financeRules'
import type { CashReport, ScopeTotals } from '../types'

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

export function ScopeTable({ scopes, onFarm }: { scopes: ScopeTotals[]; onFarm: (row: ScopeTotals) => void }) {
  return (
    <Card title="Dòng tiền theo phạm vi">
      <Table scroll>
        <thead><tr><Th>Phạm vi</Th><Th>Gói đăng ký</Th><Th>Thu khác</Th><Th>Chi</Th><Th>Ròng</Th></tr></thead>
        <tbody>
          {scopes.map((s) => {
            const net = s.subscriptionReceipts + s.otherIncome - s.expense
            const total = s.scope === 'TOTAL'
            return (
              <tr key={`${s.scope}-${s.farmId ?? s.farmName}`} className={total ? 'font-semibold' : ''}>
                <Td>{s.scope === 'FARM' ? <button type="button" className="cursor-pointer border-0 bg-transparent p-0 text-left text-[12px] font-medium text-brand" onClick={() => onFarm(s)}>{s.farmName}</button> : <span className="font-medium">{s.farmName}</span>}</Td>
                <Td className="whitespace-nowrap">{formatVnd(s.subscriptionReceipts)}</Td>
                <Td className="whitespace-nowrap">{formatVnd(s.otherIncome)}</Td>
                <Td className="whitespace-nowrap">{formatVnd(s.expense)}</Td>
                <Td className="whitespace-nowrap"><span className={net < 0 ? 'font-medium text-err-fg' : ''}>{formatMoney(net)}</span></Td>
              </tr>
            )
          })}
        </tbody>
      </Table>
    </Card>
  )
}
