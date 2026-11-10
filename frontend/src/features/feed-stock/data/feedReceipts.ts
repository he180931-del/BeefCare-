import type { FeedReceipt, FeedReceiptFilters } from '../types/feedReceipt'

const fold = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('vi')

export function filterFeedReceipts(rows: readonly FeedReceipt[], filters: FeedReceiptFilters = {}) {
  const query = fold(filters.query?.trim() ?? '')
  return rows.filter((row) => {
    if (filters.status && filters.status !== 'ALL' && row.status !== filters.status) return false
    if (filters.from && row.receiptDate < filters.from) return false
    if (filters.to && row.receiptDate > filters.to) return false
    if (filters.supplierId !== undefined && filters.supplierId !== 'ALL' && row.supplierId !== filters.supplierId) return false
    if (!query) return true
    const haystack = [row.code, row.supplierName, ...row.lines.map((line) => `${line.feedCode} ${line.feedName}`)].join(' ')
    return fold(haystack).includes(query)
  })
}

export function getDefaultFeedReceiptPeriod(today = new Date()) {
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  return { from: iso(start), to: iso(end) }
}

const isoOf = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

/** Tiles of SCR-78: posted receipts of the last 30 days, what is still owed, and status counts for the tabs. */
export function summarizeFeedReceipts(rows: readonly FeedReceipt[], today = new Date()) {
  const to = isoOf(today)
  const from = isoOf(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29))
  const posted = rows.filter((row) => row.status === 'POSTED')
  const recent = posted.filter((row) => row.receiptDate >= from && row.receiptDate <= to)
  const outstanding = (row: FeedReceipt) => row.outstanding ?? (row.amountPaid === undefined ? undefined : row.totalPayable - row.amountPaid)
  const debtKnown = posted.every((row) => outstanding(row) !== undefined)
  const owing = debtKnown ? posted.filter((row) => (outstanding(row) ?? 0) > 0) : []
  return {
    receivedKg: recent.flatMap((row) => row.lines).reduce((total, line) => total + line.kgReceived, 0),
    receiptCount: recent.length,
    totalPayable: recent.reduce((total, row) => total + row.totalPayable, 0),
    owedAmount: debtKnown ? owing.reduce((total, row) => total + (outstanding(row) ?? 0), 0) : null,
    owingCodes: owing.map((row) => row.code),
    counts: {
      all: rows.length,
      draft: rows.filter((row) => row.status === 'DRAFT').length,
      posted: posted.length,
      voided: rows.filter((row) => row.status === 'VOIDED').length,
    },
  }
}

/** "Đại lý TACN Hưng Thịnh – Sơn Tây" -> "Hưng Thịnh"; keeps other names as they are. */
export function shortSupplierName(name: string) {
  return name.replace(/^(Đại lý TACN|Công ty|Cty)\s+/i, '').replace(/\s+[–-]\s+.*$/, '').trim()
}
