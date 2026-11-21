import { useQuery } from '../../../shared/hooks/useQuery'
import { listFeedFeedingRecords } from '../api/feedFeedingApi'
import { listFeedRationPens, listFeedRations } from '../api/feedRationApi'

export type FeedTodayRationsData = Awaited<ReturnType<typeof loadFeedTodayRations>>

async function loadFeedTodayRations(date: string) {
  const [rations, pens, records] = await Promise.all([
    listFeedRations(),
    listFeedRationPens(),
    listFeedFeedingRecords({ from: date, to: date }),
  ])
  return { rations, pens, records, stock: [] as never[] }
}

/** Shared read boundary for the technician's read-only today-rations view. */
export function useFeedTodayRations(date: string) {
  const query = useQuery<FeedTodayRationsData>(() => loadFeedTodayRations(date), [date])
  return { ...query, today: query.data }
}
