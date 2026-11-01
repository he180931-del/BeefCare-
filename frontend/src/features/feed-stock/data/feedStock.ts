import type { FeedGroup, FeedStockRow, FeedStockStatus } from '../types'
import { FEED_STOCK_MOCK } from './feedStockMock'

export { FEED_STOCK_MOCK }

export type FeedStockFilters = {
  query?: string
  status?: FeedStockStatus | 'ALL'
  group?: FeedGroup | 'ALL'
}

const normalize = (text: string) => text.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')

export function filterFeedStock(rows: readonly FeedStockRow[], { query = '', status = 'ALL', group = 'ALL' }: FeedStockFilters = {}): FeedStockRow[] {
  const normalizedQuery = normalize(query.trim())
  return rows.filter((row) => {
    const matchesStatus = status === 'ALL' || row.status === status
    const matchesGroup = group === 'ALL' || row.group === group
    const searchableText = normalize(`${row.code} ${row.name}`)
    return matchesStatus && matchesGroup && (!normalizedQuery || searchableText.includes(normalizedQuery))
  })
}
