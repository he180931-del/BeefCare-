import { describe, expect, it } from 'vitest'
import { FEED_RECEIPT_MOCK } from '../../../src/features/feed-stock/data/feedReceiptMock'
import { filterFeedReceipts, getDefaultFeedReceiptPeriod, summarizeFeedReceipts } from '../../../src/features/feed-stock/data/feedReceipts'

describe('SCR-78 receipt list projections', () => {
  it('summarizes posted receipts in the selected calendar month and keeps status counts separate', () => {
    expect(summarizeFeedReceipts(FEED_RECEIPT_MOCK, new Date())).toEqual({
      receivedKg: FEED_RECEIPT_MOCK[0].lines.reduce((sum, line) => sum + line.kgReceived, 0),
      receiptCount: 1,
      totalPayable: FEED_RECEIPT_MOCK[0].totalPayable,
      counts: { all: 3, draft: 1, posted: 1, voided: 1 },
    })
  })

  it('defaults the list period to the previous month through today', () => {
    expect(getDefaultFeedReceiptPeriod(new Date(2026, 10, 15))).toEqual({ from: '2026-10-01', to: '2026-11-15' })
  })

  it('filters status, date, supplier, and accent-insensitive receipt text', () => {
    expect(filterFeedReceipts(FEED_RECEIPT_MOCK, {
      status: 'POSTED',
      from: '2000-01-01',
      to: '2100-12-31',
      supplierId: 202,
      query: 'cong ty thuc an xanh',
    })).toEqual([FEED_RECEIPT_MOCK[0]])
    expect(filterFeedReceipts(FEED_RECEIPT_MOCK, { from: '2099-01-01' })).toEqual([])
  })
})
