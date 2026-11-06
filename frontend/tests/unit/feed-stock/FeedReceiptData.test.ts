import { describe, expect, it } from 'vitest'
import { FEED_RECEIPT_MOCK } from '../../../src/features/feed-stock/data/feedReceiptMock'
import { filterFeedReceipts, getDefaultFeedReceiptPeriod, summarizeFeedReceipts } from '../../../src/features/feed-stock/data/feedReceipts'

describe('SCR-78 receipt list projections', () => {
  it('summarizes posted receipts in the selected calendar month and keeps status counts separate', () => {
    // Posted receipts of the last 30 days only: the draft and the two receipts from a month ago are left out.
    expect(summarizeFeedReceipts(FEED_RECEIPT_MOCK, new Date())).toEqual({
      receivedKg: 16_400,
      receiptCount: 3,
      totalPayable: 27_100_000,
      owedAmount: 2_500_000,
      owingCodes: ['PNK-2026-0029'],
      counts: { all: 6, draft: 1, posted: 4, voided: 1 },
    })
    // Backend rows carry no paid amount, so the debt is reported as unknown instead of guessed.
    expect(summarizeFeedReceipts(FEED_RECEIPT_MOCK.map(({ amountPaid: _paid, ...row }) => row)).owedAmount).toBeNull()
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
      query: 'htx co ba vi',
    })).toEqual([FEED_RECEIPT_MOCK[1], FEED_RECEIPT_MOCK[3]])
    expect(filterFeedReceipts(FEED_RECEIPT_MOCK, { from: '2099-01-01' })).toEqual([])
  })
})
