import { FEED_CATALOGUE_MOCK } from './feedCatalogueMock'
import { daysFromToday } from './feedDemoDates'
import type { FeedRation, FeedRationComponent } from '../types/feedRation'
import { rationStatusForDate } from '../domain/feedRationList'

/** Synthetic rows for local demos only; the rations and costs follow the Khẩu phần frames. */

function component(feedItemId: number, session1Kg: number, session2Kg: number, session3Kg = 0): FeedRationComponent {
  const feed = FEED_CATALOGUE_MOCK.find((row) => row.id === feedItemId)!
  const dailyKg = Math.round((session1Kg + session2Kg + session3Kg) * 1000) / 1000
  return {
    feedItemId,
    feedCode: feed.code,
    feedName: feed.name,
    session1Kg,
    session2Kg,
    session3Kg,
    dailyKg,
    estimatedDailyCost: Math.round(dailyKg * feed.unitCost),
  }
}

function ration(id: number, rationCode: string, versionNo: number, name: string, herdGroup: string, basis: string, from: number, to: number | null, penIds: number[], components: FeedRationComponent[]): FeedRation {
  const effectiveFrom = daysFromToday(from)
  const effectiveTo = to === null ? null : daysFromToday(to)
  return {
    id, rationCode, version: 0, versionNo, name, herdGroup, basis, effectiveFrom, effectiveTo,
    status: rationStatusForDate({ effectiveFrom, effectiveTo }),
    sessionsPerDay: 2, sessionTimes: ['06:30', '16:30'], penIds, components,
  }
}

export const FEED_RATION_MOCK: FeedRation[] = [
  ration(8001, 'KP-01', 1, 'Bò cái sinh sản – duy trì', 'BREEDING_FEMALES', 'Theo tư vấn kỹ sư chăn nuôi', -21, null, [1, 2], [component(101, 4.5, 4.5), component(102, 0.6, 0.6), component(105, 0.35, 0.35)]),
  ration(8002, 'KP-02', 1, 'Vỗ béo giai đoạn cuối', 'FATTENING', 'Theo tư vấn kỹ sư chăn nuôi – tăng tinh 30 ngày cuối trước xuất bán', -37, 0, [4], [component(104, 5, 5), component(106, 0.5, 0.5)]),
  ration(8003, 'KP-02', 2, 'Vỗ béo giai đoạn cuối', 'FATTENING', 'Theo tư vấn kỹ sư chăn nuôi – tăng tinh 30 ngày cuối trước xuất bán', 1, null, [4], [component(104, 4.75, 4.75), component(106, 0.75, 0.75)]),
  ration(8004, 'KP-03', 1, 'Bò đực giống', 'BREEDING_BULLS', 'Duy trì thể trạng đực giống', -52, null, [5], [component(101, 3, 3), component(105, 0.5, 0.5), component(107, 0.025, 0.025)]),
  ration(8005, 'KP-04', 1, 'Bê con – tập ăn', 'CALVES', 'Tập ăn cho bê theo mẹ', -21, null, [3], [component(103, 1, 1), component(108, 0.25, 0.25)]),
  ration(8006, 'KP-06', 1, 'Vỗ béo giai đoạn đầu', 'FATTENING', 'Khẩu phần giai đoạn đầu', -143, -38, [4], [component(101, 3, 3), component(104, 2, 2), component(106, 0.25, 0.25)]),
]
