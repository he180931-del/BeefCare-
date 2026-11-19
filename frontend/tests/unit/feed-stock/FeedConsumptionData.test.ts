import { describe, expect, it } from 'vitest'
import {
  buildFeedConsumptionReport,
  filterFeedConsumptionReport,
  summarizeFeedConsumptionReport,
} from '../../../src/features/feed-stock/data/feedConsumptionReport'
import type { FeedFeedingRecord } from '../../../src/features/feed-stock/types/feedFeeding'
import type { FeedRation } from '../../../src/features/feed-stock/types/feedRation'

const ration: FeedRation = {
  id: 41,
  rationCode: 'KP-A',
  versionNo: 1,
  name: 'Khẩu phần A',
  herdGroup: 'Bò thịt',
  basis: '',
  effectiveFrom: '2026-06-01',
  effectiveTo: null,
  status: 'ACTIVE',
  sessionsPerDay: 2,
  penIds: [1],
  components: [],
}

function feeding(overrides: Partial<FeedFeedingRecord> = {}): FeedFeedingRecord {
  return {
    id: 1,
    penId: 1,
    penCode: 'C-01',
    penName: 'Chuồng 1',
    feedingDate: '2026-06-01',
    sessionNo: 1,
    time: '06:30',
    headCount: 10,
    rationCode: 'KP-A',
    rationVersion: 1,
    status: 'VALID',
    version: 0,
    fedBy: null,
    recordedAt: null,
    leftoverKg: null,
    note: null,
    plannedTotalKg: 10,
    actualTotalKg: 9,
    lines: [{ feedItemId: 100, feedCode: 'TA-01', feedName: 'Cỏ', plannedKg: 10, actualKg: 9, inRation: true, unitCost: 10, totalCost: 90 }],
    revisions: [],
    ...overrides,
  }
}

describe('SCR-85 consumption report projections', () => {
  it('aggregates valid sessions and counts head-days once per pen and date', () => {
    const data = buildFeedConsumptionReport({
      from: '2026-06-01',
      to: '2026-06-02',
      feedings: [
        feeding(),
        feeding({ id: 2, sessionNo: 2, plannedTotalKg: 5, actualTotalKg: 6, lines: [
          { feedItemId: 100, feedCode: 'TA-01', feedName: 'Cỏ', plannedKg: 5, actualKg: 6, inRation: true, unitCost: 10, totalCost: 60 },
          { feedItemId: 200, feedCode: 'TA-02', feedName: 'Cám', plannedKg: 4, actualKg: 4, inRation: true, unitCost: null, totalCost: null },
        ] }),
        feeding({ id: 3, penId: 2, penCode: 'C-02', penName: 'Chuồng 2', feedingDate: '2026-06-02', headCount: 5, plannedTotalKg: 2, actualTotalKg: 3,
          lines: [{ feedItemId: 100, feedCode: 'TA-01', feedName: 'Cỏ', plannedKg: 2, actualKg: 3, inRation: true, unitCost: 10, totalCost: 30 }] }),
        feeding({ id: 4, status: 'VOIDED', actualTotalKg: 90 }),
        feeding({ id: 5, feedingDate: '2026-06-03', actualTotalKg: 50 }),
      ],
      rations: [ration],
      receipts: [],
      adjustments: [],
      catalogue: [],
    })

    const filtered = filterFeedConsumptionReport(data, { from: '2026-06-01', to: '2026-06-02', groupBy: 'FEED' })
    const grass = filtered.rows.find((row) => row.key === 'feed:100')
    expect(grass).toMatchObject({ actualKg: 18, plannedKg: 17, totalCost: 180, headDays: 15 })
    expect(grass?.varianceRatio).toBeCloseTo(1 / 17)
    expect(filtered.days).toBe(2)
    expect(summarizeFeedConsumptionReport(filtered).headDays).toBe(15)
    expect(summarizeFeedConsumptionReport(filtered).cost).toBeNull()
    const pricedFeed = filterFeedConsumptionReport(data, { from: '2026-06-01', to: '2026-06-02', groupBy: 'FEED', feedItemId: 100 })
    expect(summarizeFeedConsumptionReport(pricedFeed, 100).cost).toBe(180)
    expect(filtered.rows.find((row) => row.key === 'feed:200')?.totalCost).toBeNull()
  })

  it('applies period, feed, pen, and herd-group filters before totals', () => {
    const data = buildFeedConsumptionReport({
      from: '2026-06-01',
      to: '2026-06-03',
      feedings: [
        feeding(),
        feeding({ id: 2, sessionNo: 2, plannedTotalKg: 10, actualTotalKg: 9 }),
        feeding({ id: 3, penId: 2, penCode: 'C-02', feedingDate: '2026-06-02', headCount: 5, rationCode: null, rationVersion: null,
          lines: [{ feedItemId: 100, feedCode: 'TA-01', feedName: null, plannedKg: 2, actualKg: 3, inRation: null, unitCost: 10, totalCost: 30 }] }),
      ],
      rations: [ration],
      receipts: [],
      adjustments: [],
      catalogue: [],
    })

    const result = filterFeedConsumptionReport(data, {
      from: '2026-06-01', to: '2026-06-01', groupBy: 'HERD_GROUP',
      feedItemId: 100, penId: 1, herdGroup: 'Bò thịt',
    })
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toMatchObject({ actualKg: 18, headDays: 10, label: 'Bò thịt' })
    expect(result.days).toBe(1)
  })

  it('returns a real empty state when the period has no valid feeding records', () => {
    const data = buildFeedConsumptionReport({ from: '2026-06-01', to: '2026-06-02', feedings: [], rations: [], receipts: [], adjustments: [], catalogue: [] })
    const result = filterFeedConsumptionReport(data, { from: '2026-06-01', to: '2026-06-02', groupBy: 'HERD_GROUP' })
    expect(result.rows).toEqual([])
    expect(result.days).toBe(0)
    expect(summarizeFeedConsumptionReport(result)).toMatchObject({ actualKg: 0, headDays: 0, cost: 0, receivedKg: 0 })
  })
})
