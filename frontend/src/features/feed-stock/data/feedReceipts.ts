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

export function summarizeFeedReceipts(rows: readonly FeedReceipt[], today = new Date()) {
  const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const postedThisMonth = rows.filter((row) => row.status === 'POSTED' && row.receiptDate.startsWith(`${month}-`))
  return {
    receivedKg: postedThisMonth.flatMap((row) => row.lines).reduce((total, line) => total + line.kgReceived, 0),
    receiptCount: postedThisMonth.length,
    totalPayable: postedThisMonth.reduce((total, row) => total + row.totalPayable, 0),
    counts: {
      all: rows.length,
      draft: rows.filter((row) => row.status === 'DRAFT').length,
      posted: rows.filter((row) => row.status === 'POSTED').length,
      voided: rows.filter((row) => row.status === 'VOIDED').length,
    },
  }
}
