import type { CashReport, FinanceRecord, Farm, PmNotice, ReceiptFilters, Receipt, RecordErrors, RecordFields, RecordFilters, RecordState, RecordType, ReportCriteria, ReportLine, ReportSummary, ScopeTotals } from '../types'

export const DEMO_TODAY = '2026-10-19'
export const FINANCE_CATEGORIES: Record<RecordType, string[]> = {
  INCOME: ['Đào tạo tại trại', 'Dịch vụ tư vấn', 'Tài trợ / hỗ trợ'],
  EXPENSE: ['Hạ tầng máy chủ', 'Phí dịch vụ email', 'In thẻ tai QR', 'Phí nhắn tin SMS', 'Quảng bá'],
}
export const TYPE_LABEL: Record<RecordType, string> = { INCOME: 'Thu', EXPENSE: 'Chi' }
export const STATE_LABEL: Record<RecordState, string> = { DRAFT: 'Nháp', POSTED: 'Đã ghi sổ', VOID: 'Đã hủy bỏ' }

export const formatVnd = (n: number) => Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
export const formatMoney = (n: number) => `${n < 0 ? '−' : ''}${formatVnd(n)}`
export const formatSigned = (n: number) => `${n < 0 ? '−' : n > 0 ? '+' : ''}${formatVnd(n)}`
/** yyyy-mm-dd → dd/mm/yyyy */
export const formatDate = (iso: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '')
/** ISO local → dd/mm/yyyy hh:mm */
export const formatDateTime = (iso: string) => `${formatDate(iso)} ${iso.slice(11, 16)}`
export const formatShort = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)} ${iso.slice(11, 16)}`
export const formatPeriod = (from: string, to: string) => `${formatDate(from)} – ${formatDate(to)}`

const toMs = (iso: string) => Date.parse(`${iso.slice(0, 19)}Z`)
/** Thời gian tương đối cho thông báo (giờ Việt Nam). */
export function relativeTime(iso: string, nowIso: string): string {
  const diffMin = Math.floor((toMs(nowIso) - toMs(iso)) / 60000)
  if (diffMin < 1) return 'Vừa xong'
  if (diffMin < 60) return `${diffMin} phút trước`
  const day = iso.slice(0, 10)
  const nowDay = nowIso.slice(0, 10)
  if (day === nowDay) return iso.slice(11, 16)
  if (toMs(`${nowDay}T00:00:00`) - toMs(`${day}T00:00:00`) === 86400000) return `Hôm qua ${iso.slice(11, 16)}`
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)} ${iso.slice(11, 16)}`
}
export const addMinutes = (iso: string, minutes: number) => new Date(toMs(iso) + minutes * 60000).toISOString().slice(0, 19)

export function validateRecordFields(f: RecordFields, today = DEMO_TODAY, categoryOptions = FINANCE_CATEGORIES): RecordErrors {
  const errors: RecordErrors = {}
  if (!f.category) errors.category = 'Danh mục là bắt buộc.'
  else if (!categoryOptions[f.type].includes(f.category)) errors.category = `Danh mục ${f.category} không dùng được cho ${TYPE_LABEL[f.type]}.`
  if (!Number.isInteger(f.amountVnd) || f.amountVnd < 1) errors.amountVnd = 'Số tiền phải là số nguyên đồng lớn hơn 0.'
  if (!f.occurredOn) errors.occurredOn = 'Ngày phát sinh là bắt buộc.'
  else if (f.occurredOn > today) errors.occurredOn = 'Ngày phát sinh không được ở tương lai.'
  if (f.scope === 'FARM' && !f.farmId) errors.farmId = 'Trang trại là bắt buộc khi gắn với trại.'
  if (f.documentNumber.length > 100) errors.documentNumber = 'Số chứng từ tối đa 100 ký tự.'
  if (f.description.length > 500) errors.description = 'Diễn giải tối đa 500 ký tự.'
  if (f.sourceType === 'BANK' && !f.sourceEvidenceId) errors.sourceEvidenceId = 'Hãy chọn chứng từ ngân hàng.'
  return errors
}

export const signedAmount = (r: Pick<FinanceRecord, 'type' | 'amountVnd'>) => (r.type === 'INCOME' ? r.amountVnd : -r.amountVnd)

export function filterRecords(rows: FinanceRecord[], f: RecordFilters, ignoreState = false): FinanceRecord[] {
  return rows
    .filter((r) => (!f.type || r.type === f.type) && (!f.category || r.category === f.category))
    .filter((r) => !f.scope || (f.scope === 'GENERAL' ? r.scope === 'GENERAL' : String(r.farmId) === f.scope))
    .filter((r) => (!f.from || r.occurredOn >= f.from) && (!f.to || r.occurredOn <= f.to))
    .filter((r) => ignoreState || !f.state || r.state === f.state)
    .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn) || b.recordCode.localeCompare(a.recordCode))
}

export function filterReceipts(rows: Receipt[], f: ReceiptFilters): Receipt[] {
  const q = (f.search ?? '').trim().toLowerCase()
  return rows
    .filter((r) => !q || r.code.toLowerCase().includes(q) || r.paymentCode.toLowerCase().includes(q))
    .filter((r) => !f.farmId || r.farmId === f.farmId)
    .filter((r) => (!f.from || r.bankPaidAt.slice(0, 10) >= f.from) && (!f.to || r.bankPaidAt.slice(0, 10) <= f.to))
    .sort((a, b) => b.bankPaidAt.localeCompare(a.bankPaidAt))
}

const monthsBetween = (from: string, to: string) => (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + Number(to.slice(5, 7)) - Number(from.slice(5, 7)) + (Number(to.slice(8, 10)) >= Number(from.slice(8, 10)) ? 0 : -1)
export function validateCriteria(c: ReportCriteria): string | null {
  if (!c.dateFrom || !c.dateTo) return 'Kỳ báo cáo là bắt buộc.'
  if (c.dateFrom > c.dateTo) return 'Ngày bắt đầu phải trước ngày kết thúc.'
  if (monthsBetween(c.dateFrom, c.dateTo) >= 24) return 'Kỳ báo cáo tối đa 24 tháng.'
  return null
}

const daysBetween = (from: string, to: string) => {
  const out: string[] = []
  for (let t = toMs(`${from}T00:00:00`); t <= toMs(`${to}T00:00:00`); t += 86400000) out.push(new Date(t).toISOString().slice(0, 10))
  return out
}

/** GBR-85: biên nhận theo giờ ngân hàng + thu khác đã ghi sổ - chi đã ghi sổ theo ngày phát sinh. */
export function computeReport(c: ReportCriteria, receipts: Receipt[], records: FinanceRecord[], farms: Farm[]): { summary: ReportSummary; lines: ReportLine[] } {
  const inRange = (d: string) => d >= c.dateFrom && d <= c.dateTo
  const farmOk = (id: number | null) => c.farmId == null || id === c.farmId
  const useReceipts = c.sourceFilter !== 'MANUAL'
  const useManual = c.sourceFilter !== 'RECEIPTS'
  const rc = useReceipts ? receipts.filter((r) => inRange(r.bankPaidAt.slice(0, 10)) && farmOk(r.farmId)) : []
  const posted = useManual ? records.filter((r) => r.state === 'POSTED' && inRange(r.occurredOn) && (r.scope === 'GENERAL' ? c.farmId == null : farmOk(r.farmId))) : []

  const lines: ReportLine[] = [
    ...rc.map((r): ReportLine => ({ sourceType: 'RECEIPT', code: r.code, scope: 'FARM', farmName: r.farmName, direction: 'IN', category: `Biên nhận gói ${r.termYears} năm`, amountVnd: r.amountVnd, cashDate: r.bankPaidAt.slice(0, 10), status: 'Đã thanh toán', reference: `${r.paymentCode} · ${r.evidenceCode} · ${r.priceVersion}` })),
    ...posted.map((r): ReportLine => ({ sourceType: 'MANUAL', code: r.recordCode, scope: r.scope, farmName: r.scope === 'GENERAL' ? 'Chung nền tảng' : r.farmName, direction: r.type === 'INCOME' ? 'IN' : 'OUT', category: r.category, amountVnd: r.amountVnd, cashDate: r.occurredOn, status: 'Đã ghi sổ', reference: r.documentNumber || r.sourceReference || '—' })),
  ].sort((a, b) => b.cashDate.localeCompare(a.cashDate) || a.code.localeCompare(b.code))

  const sum = (ls: ReportLine[], pred: (l: ReportLine) => boolean) => ls.filter(pred).reduce((t, l) => t + l.amountVnd, 0)
  const row = (scope: ScopeTotals['scope'], farmId: number | null, farmName: string, ls: ReportLine[]): ScopeTotals => ({
    scope, farmId, farmName,
    subscriptionReceipts: sum(ls, (l) => l.sourceType === 'RECEIPT'),
    otherIncome: sum(ls, (l) => l.sourceType === 'MANUAL' && l.direction === 'IN'),
    expense: sum(ls, (l) => l.direction === 'OUT'),
  })
  const featured = farms.filter((f) => records.some((r) => r.scope === 'FARM' && r.farmId === f.id && inRange(r.occurredOn))).map((f) => f.id)
  const farmLines = (id: number) => lines.filter((l) => l.scope === 'FARM' && l.farmName === farms.find((f) => f.id === id)?.name)
  const scopes: ScopeTotals[] = []
  if (c.farmId == null) {
    scopes.push(row('GENERAL', null, 'Chung nền tảng', lines.filter((l) => l.scope === 'GENERAL')))
    const named = farms.filter((f) => featured.includes(f.id))
    named.forEach((f) => scopes.push(row('FARM', f.id, f.name, farmLines(f.id))))
    const others = lines.filter((l) => l.scope === 'FARM' && !named.some((f) => f.name === l.farmName))
    if (others.length) scopes.push(row('OTHER', null, 'Các trại khác', others))
  } else {
    const f = farms.find((x) => x.id === c.farmId)
    if (f) scopes.push(row('FARM', f.id, f.name, lines))
  }
  const total = row('TOTAL', null, 'Toàn nền tảng', lines)
  scopes.push(total)

  const dailyIncome = daysBetween(c.dateFrom, c.dateTo).map((date) => ({ date, income: sum(lines, (l) => l.direction === 'IN' && l.cashDate === date) }))
  const totalIncome = total.subscriptionReceipts + total.otherIncome
  return {
    lines,
    summary: { subscriptionReceipts: total.subscriptionReceipts, otherIncome: total.otherIncome, totalIncome, totalExpense: total.expense, netCashFlow: totalIncome - total.expense, scopes, dailyIncome, note: 'Dòng tiền, không phải lợi nhuận kế toán.' },
  }
}

export const isReportExpired = (r: Pick<CashReport, 'expiresAt' | 'expired'>, nowIso: string) => r.expired || r.expiresAt <= nowIso

export const unreadCount = (list: PmNotice[]) => list.filter((n) => !n.readTime).length
