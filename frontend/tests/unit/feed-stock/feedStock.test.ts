import { describe, expect, it } from 'vitest'
import { createFeedStockApi, filterFeedStock, FEED_STOCK_MOCK, type FeedStockRow } from '../../../src/features/feed-stock'

describe('FE-23 feed stock read model', () => {
  const feedGroups = [
    'GREEN_ROUGHAGE',
    'DRY_ROUGHAGE',
    'CONCENTRATE',
    'TMR',
    'MINERAL_ADDITIVE',
    'CALF_FEED',
  ]

  it('provides mock rows with exactly the GET stock contract fields', () => {
    const contractFields: (keyof FeedStockRow)[] = [
      'feedItemId', 'code', 'name', 'group', 'onHandKg', 'minimumStockKg',
      'averageDailyUseKg', 'daysOfCover', 'stockValue', 'status', 'version',
      'nearestLotNumber', 'nearestLotExpiryDate',
    ]

    expect(FEED_STOCK_MOCK.length).toBeGreaterThan(0)
    for (const row of FEED_STOCK_MOCK) {
      expect(Object.keys(row).sort()).toEqual([...contractFields].sort())
      expect(row.feedItemId).toEqual(expect.any(Number))
      expect(row.code).toMatch(/^TA-/)
      expect(feedGroups).toContain(row.group)
      expect(['OUT_OF_STOCK', 'LOW', 'SUFFICIENT']).toContain(row.status)
      const expectedStatus = row.onHandKg <= 0
        ? 'OUT_OF_STOCK'
        : row.minimumStockKg !== null && row.onHandKg <= row.minimumStockKg
          ? 'LOW'
          : 'SUFFICIENT'
      expect(row.status).toBe(expectedStatus)
      const expectedCover = row.averageDailyUseKg === 0
        ? null
        : Math.round((row.onHandKg / (row.averageDailyUseKg ?? 0)) * 10) / 10
      expect(row.daysOfCover).toBe(expectedCover)
    }
  })

  it('filters by stock status and searches feed code or name', () => {
    const rows = filterFeedStock(FEED_STOCK_MOCK, { status: 'LOW', query: 'TA-02' })

    expect(rows).toHaveLength(1)
    expect(rows[0].code).toBe('TA-02')
    expect(rows[0].status).toBe('LOW')
    expect(filterFeedStock(FEED_STOCK_MOCK, { query: 'cam hon hop bo thit' }).map((row) => row.code)).toEqual(['TA-02'])
    expect(filterFeedStock(FEED_STOCK_MOCK, { query: 'CONCENTRATE' })).toEqual([])
  })

  it('returns an empty list when filters have no match', () => {
    expect(filterFeedStock(FEED_STOCK_MOCK, { query: 'no such feed' })).toEqual([])
    expect(filterFeedStock([], {})).toEqual([])
  })

  it('filters by the feed group code independently of search and status', () => {
    const rows = filterFeedStock(FEED_STOCK_MOCK, { group: 'CONCENTRATE' })

    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((row) => row.group === 'CONCENTRATE')).toBe(true)
  })

  it('preserves backend errors instead of substituting local mock rows', async () => {
    const backendError = new Error('Stock request failed')
    const requestedPaths: string[] = []
    const transport = {
      get: async (path: string) => { requestedPaths.push(path); throw backendError },
      command: async () => { throw new Error('not used') },
      farmPath: (farmId: string | number, suffix?: string) => `/api/farms/${farmId}${suffix ?? ''}`,
    }
    const api = createFeedStockApi({ mode: 'backend', farmId: 22, transport, mockRows: FEED_STOCK_MOCK })

    await expect(api.list()).rejects.toBe(backendError)
    expect(requestedPaths).toEqual(['/api/farms/22/feed/stock', '/api/farms/22/feed/catalogue'])
  })
})
