import { useState } from 'react'
import { activateTableRow, activateTableRowByKey, Card, interactiveRowClass, Pagination, Table, Td, Th } from '../../../shared/ui'
import { formatMoney, formatVnd } from '../domain/financeRules'
import { categoryLabel, FINANCE_CATEGORIES } from '../domain/financeRules'
import type { CashReport, ReportLine, ScopeTotals } from '../types'

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
    <Card title="Dòng tiền theo trại">
      <Table scroll>
        <thead><tr><Th>Trại</Th><Th>Thu từ gói đăng ký</Th><Th>Thu khác</Th><Th>Chi</Th><Th>Ròng</Th></tr></thead>
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

export interface DayFlow { date: string; income: number; expense: number; net: number; cumulative: number }
/** Gom các dòng của bản chốt theo ngày dòng tiền; lũy kế cộng dồn thu trừ chi. */
export function dailyFlows(lines: readonly ReportLine[]): DayFlow[] {
  const byDay = new Map<string, { income: number; expense: number }>()
  for (const l of lines) {
    const d = byDay.get(l.cashDate) ?? { income: 0, expense: 0 }
    if (l.direction === 'IN') d.income += l.amountVnd; else d.expense += l.amountVnd
    byDay.set(l.cashDate, d)
  }
  let cumulative = 0
  return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => {
    const net = v.income - v.expense
    cumulative += net
    return { date, income: v.income, expense: v.expense, net, cumulative }
  })
}

export interface Slice { label: string; value: number }
/** Tổng tiền theo nhóm, lớn nhất trước. */
export function sumBy(lines: readonly ReportLine[], direction: 'IN' | 'OUT', key: (l: ReportLine) => string): Slice[] {
  const map = new Map<string, number>()
  for (const l of lines) if (l.direction === direction) map.set(key(l), (map.get(key(l)) ?? 0) + l.amountVnd)
  return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
}
export const byCategory = (l: ReportLine) => categoryLabel(l.category)
export const byFarm = (l: ReportLine) => (l.scope === 'GENERAL' ? 'Chung nền tảng' : l.farmName)

const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const fmtM = (v: number) => `${(v / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}`

/** Cột thu / chi theo ngày (triệu đồng). */
export function IncomeExpenseChart({ days }: { days: DayFlow[] }) {
  const max = Math.max(1, ...days.flatMap((d) => [d.income, d.expense]))
  return (
    <div>
      <div className="flex h-[170px] items-end gap-2 overflow-x-auto" role="img" aria-label="Thu và chi theo ngày">
        {days.map((d) => (
          <div key={d.date} className="flex min-w-[28px] flex-1 flex-col items-center justify-end gap-1" title={`${dm(d.date)} · Thu ${formatVnd(d.income)} đ · Chi ${formatVnd(d.expense)} đ`}>
            <div className="flex h-[140px] w-full items-end justify-center gap-[2px]">
              <div className="w-1/2 max-w-[14px] rounded-[2px] bg-brand" style={{ height: `${Math.max(d.income ? 2 : 0, Math.round((d.income / max) * 140))}px` }} />
              <div className="w-1/2 max-w-[14px] rounded-[2px] bg-[#e0a458]" style={{ height: `${Math.max(d.expense ? 2 : 0, Math.round((d.expense / max) * 140))}px` }} />
            </div>
            <span className="text-[10px] text-muted">{dm(d.date)}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-4 text-[11px] text-muted"><span><i className="mr-1 inline-block size-2 rounded-sm bg-brand" />Thu</span><span><i className="mr-1 inline-block size-2 rounded-sm bg-[#e0a458]" />Chi</span></div>
    </div>
  )
}

/** Đường dòng tiền ròng lũy kế: cho thấy kỳ đang tăng hay giảm. */
export function CumulativeChart({ days }: { days: DayFlow[] }) {
  if (days.length === 0) return null
  const W = 520, H = 170, pad = 8
  const vals = days.map((d) => d.cumulative)
  const min = Math.min(0, ...vals), max = Math.max(0, ...vals), span = Math.max(1, max - min)
  const x = (i: number) => pad + (days.length === 1 ? (W - 2 * pad) / 2 : (i * (W - 2 * pad)) / (days.length - 1))
  const y = (v: number) => pad + ((max - v) / span) * (H - 2 * pad)
  const points = days.map((d, i) => `${x(i)},${y(d.cumulative)}`).join(' ')
  const last = days[days.length - 1]
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[170px] w-full" role="img" aria-label="Dòng tiền ròng lũy kế">
        <line x1={pad} x2={W - pad} y1={y(0)} y2={y(0)} stroke="#cfd8d2" strokeDasharray="4 4" />
        <polyline points={points} fill="none" stroke="#1f6b45" strokeWidth="2" />
        {days.map((d, i) => <circle key={d.date} cx={x(i)} cy={y(d.cumulative)} r="3" fill="#1f6b45"><title>{`${dm(d.date)}: ${formatMoney(d.cumulative)} đ`}</title></circle>)}
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-muted"><span>{dm(days[0].date)}</span><span>Lũy kế đến {dm(last.date)}: <b className="text-ink">{formatMoney(last.cumulative)} đ</b></span></div>
    </div>
  )
}

/** Thanh ngang xếp hạng theo nhóm (triệu đồng). */
/** Bảng màu phân loại đã kiểm (xanh dương, cam, xanh ngọc, vàng, hồng, xanh lá, tím, đỏ); mỗi danh mục giữ một màu cố định, không đổi theo thứ hạng. */
const CATEGORY_PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948']
const OTHER_COLOR = '#9a9a96'
const CATEGORY_ORDER = [...FINANCE_CATEGORIES.INCOME, 'SUBSCRIPTION', ...FINANCE_CATEGORIES.EXPENSE].map(categoryLabel)
function sliceColor(label: string, fallbackIndex: number) {
  if (label === 'Khác') return OTHER_COLOR
  const known = CATEGORY_ORDER.indexOf(label)
  return CATEGORY_PALETTE[(known >= 0 ? known : fallbackIndex) % CATEGORY_PALETTE.length]
}

/** Biểu đồ tròn (donut) cơ cấu theo danh mục; tối đa 5 phần, phần còn lại gộp thành "Khác". */
export function DonutChart({ items, empty }: { items: Slice[]; empty: string }) {
  if (items.length === 0) return <div className="py-6 text-center text-[12px] text-muted">{empty}</div>
  const total = items.reduce((a, i) => a + i.value, 0)
  const rest = items.slice(5).reduce((a, i) => a + i.value, 0)
  const slices = rest > 0 ? [...items.slice(0, 5), { label: 'Khác', value: rest }] : items.slice(0, 5)
  const colorOf = (label: string, i: number) => sliceColor(label, i)
  const r = 40
  const c = 2 * Math.PI * r
  let offset = 0
  return (
    <div className="flex flex-wrap items-center gap-4">
      <svg viewBox="0 0 100 100" className="size-[120px] shrink-0 -rotate-90" role="img" aria-label="Biểu đồ tròn cơ cấu">
        {slices.map((s, i) => {
          const len = (s.value / total) * c
          const el = (
            <circle key={s.label} cx="50" cy="50" r={r} fill="none" stroke={colorOf(s.label, i)} strokeWidth="18"
              strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset}><title>{`${s.label}: ${formatVnd(s.value)} đ`}</title></circle>
          )
          offset += len
          return el
        })}
      </svg>
      <ul className="m-0 flex min-w-0 flex-1 list-none flex-col gap-1.5 p-0">
        {slices.map((s, i) => (
          <li key={s.label} className="flex items-center gap-2 text-[12px]" title={`${formatVnd(s.value)} đ`}>
            <span aria-hidden className="size-2.5 shrink-0 rounded-sm" style={{ background: colorOf(s.label, i) }} />
            <span className="min-w-0 flex-1 truncate">{s.label}</span>
            <span className="whitespace-nowrap text-muted">{fmtM(s.value)} tr · {Math.round((s.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function RankBars({ items, tone = 'brand', empty }: { items: Slice[]; tone?: 'brand' | 'warn'; empty: string }) {
  if (items.length === 0) return <div className="py-6 text-center text-[12px] text-muted">{empty}</div>
  const max = Math.max(1, ...items.map((i) => i.value))
  const total = items.reduce((a, i) => a + i.value, 0)
  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {items.slice(0, 6).map((i) => (
        <li key={i.label} className="text-[12px]" title={`${formatVnd(i.value)} đ`}>
          <div className="flex justify-between gap-2"><span className="truncate">{i.label}</span><span className="whitespace-nowrap text-muted">{fmtM(i.value)} tr · {Math.round((i.value / total) * 100)}%</span></div>
          <div className="mt-1 h-2 rounded bg-[#eef2ef]"><div className={`h-2 rounded ${tone === 'warn' ? 'bg-[#e0a458]' : 'bg-brand'}`} style={{ width: `${Math.max(2, (i.value / max) * 100)}%` }} /></div>
        </li>
      ))}
    </ul>
  )
}

export type SheetKind = 'title' | 'head' | 'body' | 'total' | 'blank'
export interface SheetRow { kind: SheetKind; cells: (string | number)[] }
export interface SheetPreviewData { name: string; rows: SheetRow[] }

/** Mô phỏng bảng tính sẽ được xuất: tên sheet và từng ô đúng như trong tệp. */
export function buildWorkbookPreview(report: CashReport, farmLabel: string, sourceLabel: string): SheetPreviewData[] {
  const s = report.summary
  const c = report.criteria
  const period = `${c.dateFrom.slice(8, 10)}/${c.dateFrom.slice(5, 7)}/${c.dateFrom.slice(0, 4)} – ${c.dateTo.slice(8, 10)}/${c.dateTo.slice(5, 7)}/${c.dateTo.slice(0, 4)}`
  const blank: SheetRow = { kind: 'blank', cells: [] }
  const dt = report.generatedAt
  const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—')
  const catRows = (dir: 'IN' | 'OUT', total: number): SheetRow[] => sumBy(report.lines, dir, byCategory).map((x) => ({ kind: 'body', cells: [`  ${x.label}`, x.value, pct(x.value, total)] }))
  const ins = report.lines.filter((l) => l.direction === 'IN')
  const outs = report.lines.filter((l) => l.direction === 'OUT')
  const topFarm = sumBy(report.lines, 'IN', byFarm)[0]
  const topExpense = sumBy(report.lines, 'OUT', byCategory)[0]
  let running = 0
  const monthRows = monthsBetween(c.dateFrom, c.dateTo).map((m): SheetRow => {
    const inM = ins.filter((l) => l.cashDate.startsWith(m)).reduce((x, l) => x + l.amountVnd, 0)
    const outM = outs.filter((l) => l.cashDate.startsWith(m)).reduce((x, l) => x + l.amountVnd, 0)
    running += inM - outM
    return { kind: 'body', cells: [`Tháng ${m.slice(5, 7)}/${m.slice(0, 4)}`, inM, outM, inM - outM, running] }
  })
  const summary: SheetRow[] = [
    { kind: 'title', cells: ['Báo cáo dòng tiền nền tảng BeefCare'] },
    { kind: 'body', cells: ['Kỳ báo cáo', period] },
    { kind: 'body', cells: ['Trang trại / Nguồn', `${farmLabel} · ${sourceLabel}`] },
    { kind: 'body', cells: ['Bản chốt', `${report.code} · ${dt.slice(11, 16)} ${dt.slice(8, 10)}/${dt.slice(5, 7)}/${dt.slice(0, 4)}`] },
    { kind: 'body', cells: ['Đơn vị', 'VND · giờ Việt Nam'] },
    blank,
    { kind: 'head', cells: ['Kết quả chính', 'Số tiền'] },
    { kind: 'total', cells: ['Tổng thu', s.totalIncome] },
    { kind: 'body', cells: ['  Thu từ gói đăng ký', s.subscriptionReceipts] },
    { kind: 'body', cells: ['  Thu khác', s.otherIncome] },
    { kind: 'total', cells: ['Tổng chi', s.totalExpense] },
    { kind: 'total', cells: ['Dòng tiền ròng', s.netCashFlow] },
    { kind: 'body', cells: ['Tỷ lệ chi / thu', pct(s.totalExpense, s.totalIncome)] },
    blank,
    { kind: 'head', cells: ['Theo tháng', 'Thu', 'Chi', 'Ròng', 'Ròng lũy kế'] },
    ...monthRows,
    blank,
    { kind: 'head', cells: ['Theo danh mục', 'Số tiền', 'Tỷ trọng'] },
    { kind: 'total', cells: ['Thu', s.totalIncome] },
    ...catRows('IN', s.totalIncome),
    { kind: 'total', cells: ['Chi', s.totalExpense] },
    ...catRows('OUT', s.totalExpense),
    blank,
    { kind: 'head', cells: ['Điểm nổi bật', 'Giá trị'] },
    { kind: 'body', cells: ['Số giao dịch thu', `${ins.length}`] },
    { kind: 'body', cells: ['Số giao dịch chi', `${outs.length}`] },
    { kind: 'body', cells: ['Trại thu nhiều nhất', topFarm ? `${topFarm.label} · ${formatVnd(topFarm.value)} đ` : '—'] },
    { kind: 'body', cells: ['Danh mục chi lớn nhất', topExpense ? `${topExpense.label} · ${formatVnd(topExpense.value)} đ` : '—'] },
  ]
  const farmSheet: SheetRow[] = [
    { kind: 'head', cells: ['Trại', 'Thu từ gói đăng ký', 'Thu khác', 'Tổng thu', 'Chi', 'Ròng'] },
    ...s.scopes.map((x): SheetRow => ({ kind: x.scope === 'PLATFORM' ? 'total' : 'body', cells: [x.farmName, x.subscriptionReceipts, x.otherIncome, x.subscriptionReceipts + x.otherIncome, x.expense, x.subscriptionReceipts + x.otherIncome - x.expense] })),
  ]
  const dmy = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`
  const flowSheet = (dir: 'IN' | 'OUT'): SheetRow[] => {
    const rows = report.lines.filter((l) => l.direction === dir)
    return [
      { kind: 'head', cells: ['Ngày', 'Mã', 'Loại nguồn', 'Danh mục', 'Trại', 'Số tiền (VND)', 'Trạng thái', 'Nguồn', 'Phiên bản nguồn'] },
      ...rows.map((l): SheetRow => ({ kind: 'body', cells: [dmy(l.cashDate), l.code, l.sourceType === 'RECEIPT' ? 'Biên nhận gói' : 'Khoản thu chi', categoryLabel(l.category), l.farmName, l.amountVnd, l.status, l.reference, l.sourceVersion == null ? '' : `v${l.sourceVersion}`] })),
      { kind: 'total', cells: [`Tổng (${rows.length} giao dịch)`, '', '', '', '', rows.reduce((a, l) => a + l.amountVnd, 0)] },
    ]
  }
  return [{ name: 'Tổng hợp', rows: summary }, { name: 'Theo trại', rows: farmSheet }, { name: 'Thu', rows: flowSheet('IN') }, { name: 'Chi', rows: flowSheet('OUT') }]
}

/** Các tháng (yyyy-mm) từ ngày bắt đầu đến ngày kết thúc, kể cả tháng không có giao dịch. */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = []
  let y = Number(from.slice(0, 4)), m = Number(from.slice(5, 7))
  const endY = Number(to.slice(0, 4)), endM = Number(to.slice(5, 7))
  while (y < endY || (y === endY && m <= endM)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m += 1
    if (m > 12) { m = 1; y += 1 }
  }
  return out
}

const colName = (i: number) => String.fromCharCode(65 + i)

/** Khung giống Excel: tiêu đề cột A, B, C…, số dòng và thẻ sheet phía dưới. */
export function WorkbookPreview({ sheets }: { sheets: SheetPreviewData[] }) {
  const [active, setActive] = useState(0)
  const sheet = sheets[active] ?? sheets[0]
  const cols = Math.max(5, ...sheet.rows.map((r) => r.cells.length))
  return (
    <div className="overflow-hidden rounded-md border border-[#c8d1cb] bg-white">
      <div className="max-h-[360px] overflow-auto">
        <table className="w-max min-w-full border-collapse text-[12px]" aria-label={`Bản xem trước sheet ${sheet.name}`}>
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-20 w-9 border border-[#d4dbd6] bg-[#eceff0]" />
              {Array.from({ length: cols }, (_, i) => <th key={i} scope="col" className="sticky top-0 z-10 min-w-[110px] border border-[#d4dbd6] bg-[#eceff0] px-2 py-1 text-center font-normal text-muted">{colName(i)}</th>)}
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((row, r) => (
              <tr key={r} className={row.kind === 'title' ? 'font-bold' : row.kind === 'total' ? 'bg-[#f1f6f2] font-semibold' : ''}>
                <th scope="row" className="sticky left-0 z-10 border border-[#d4dbd6] bg-[#eceff0] px-1 text-center font-normal text-muted">{r + 1}</th>
                {Array.from({ length: cols }, (_, i) => {
                  const v = row.cells[i]
                  const num = typeof v === 'number'
                  return <td key={i} className={`whitespace-nowrap border border-[#e3e8e4] px-2 py-1 ${num ? 'text-right tabular-nums' : ''} ${row.kind === 'head' ? 'bg-[#dcebe1] font-semibold text-ink' : ''} ${num && v < 0 ? 'text-err-fg' : ''}`}>{v === undefined ? '' : num ? formatMoney(v) : v}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div role="tablist" className="flex gap-1 border-t border-[#c8d1cb] bg-[#eceff0] px-2 pt-1">
        {sheets.map((sh, i) => (
          <button key={sh.name} type="button" role="tab" aria-selected={i === active} onClick={() => setActive(i)} className={`cursor-pointer rounded-t border border-b-0 px-3 py-1 text-[12px] ${i === active ? 'border-[#c8d1cb] bg-white font-semibold text-brand' : 'border-transparent bg-transparent text-muted'}`}>{sh.name}</button>
        ))}
      </div>
    </div>
  )
}
