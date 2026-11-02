import { FEED_UNIT_COST } from './feedCatalogueMock'
import { FEED_DEMO_PENS } from './feedPenMock'
import { isoAt, today } from './feedDemoDates'
import type { FeedFeedingLine, FeedFeedingRecord } from '../types/feedFeeding'

// Today's sessions as drawn in the Nhật ký cho ăn frame: 8 of 10 sessions recorded, 1.010,5 kg actual.
const FEEDS: Record<number, [string, string]> = {
  101: ['TA-01', 'Cỏ voi'], 102: ['TA-02', 'Rơm khô'], 103: ['TA-03', 'Cỏ non'], 104: ['TA-04', 'Thức ăn TMR'],
  105: ['TA-05', 'Cám hỗn hợp'], 106: ['TA-06', 'Cám ngô'], 107: ['TA-07', 'Khoáng premix'], 108: ['TA-08', 'Sữa thay thế'],
}

const line = (feedItemId: number, plannedKg: number, actualKg: number): FeedFeedingLine => {
  const unitCost = FEED_UNIT_COST.get(feedItemId) ?? null
  return {
    feedItemId, feedCode: FEEDS[feedItemId][0], feedName: FEEDS[feedItemId][1], plannedKg, actualKg, inRation: true,
    unitCost, totalCost: unitCost === null ? null : Math.round(actualKg * unitCost),
  }
}

let nextId = 7000
function record(penId: number, sessionNo: number, time: string, rationCode: string, rationVersion: number, fedBy: string, lines: FeedFeedingLine[], extra: Partial<FeedFeedingRecord> = {}): FeedFeedingRecord {
  const pen = FEED_DEMO_PENS.find((row) => row.id === penId)!
  const sum = (key: 'plannedKg' | 'actualKg') => Math.round(lines.reduce((total, row) => total + row[key], 0) * 10) / 10
  return {
    id: ++nextId, penId, penCode: pen.code, penName: pen.name, feedingDate: today(), sessionNo, time, headCount: pen.headcount,
    rationCode, rationVersion, status: 'VALID', version: 0, fedBy, recordedAt: isoAt(0, time), leftoverKg: null, note: null,
    plannedTotalKg: sum('plannedKg'), actualTotalKg: sum('actualKg'), lines, revisions: [], recordedBy: 'Trần Quốc Long', ...extra,
  }
}

const A1 = [130.5, 17.4, 10.1] as const
const A2 = [126, 16.8, 9.8] as const

export function buildFeedFeedingSeed(): FeedFeedingRecord[] {
  return [
    record(1, 1, '06:40', 'KP-01', 1, 'Lê Thị Mai', [line(101, A1[0], 128), line(102, A1[1], 17), line(105, A1[2], 10)]),
    record(2, 1, '06:45', 'KP-01', 1, 'Trần Quốc Long', [line(101, A2[0], 123), line(102, A2[1], 17), line(105, A2[2], 10)]),
    record(2, 2, '16:35', 'KP-01', 1, 'Trần Quốc Long', [line(101, A2[0], 127), line(102, A2[1], 17), line(105, A2[2], 8)]),
    record(3, 1, '06:50', 'KP-04', 1, 'Trần Quốc Long', [line(103, 6, 6), line(108, 1.5, 0)], { note: 'Sữa thay thế hết kho – không cho' }),
    record(3, 2, '16:20', 'KP-04', 1, 'Trần Quốc Long', [line(103, 6, 6.5), line(108, 1.5, 0)], { note: 'Sữa thay thế hết kho' }),
    record(4, 1, '06:52', 'KP-02', 1, 'Trần Quốc Long', [line(104, 230, 230), line(106, 23, 20)], {
      version: 1, revisions: [{ action: 'CORRECTED', reason: 'Đối chiếu sổ tay chuồng', changedAt: isoAt(0, '07:10'), lines: [line(104, 230, 230), line(106, 23, 18)] }],
    }),
    record(4, 2, '16:40', 'KP-02', 1, 'Trần Quốc Long', [line(104, 230, 233), line(106, 23, 23)]),
    record(5, 1, '06:50', 'KP-03', 1, 'Trần Quốc Long', [line(101, 30, 30), line(105, 5, 5), line(107, 0.3, 0)]),
  ]
}
