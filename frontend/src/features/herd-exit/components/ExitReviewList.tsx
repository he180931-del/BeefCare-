import { Link } from 'react-router-dom'
import { Box } from './parts'
import type { ExitReviewItem } from '../types'

type Group = { label: string; count: number; tab?: string }

const groups = (item: ExitReviewItem): Group[] => [
  { label: 'mũi tiêm đã hủy', count: item.cancelledDoseIds.length, tab: 'vaccine' },
  { label: 'nhắc việc đã hủy', count: item.cancelledReminderIds.length },
  { label: 'ca sức khỏe đã đóng', count: item.closedCaseIds.length, tab: 'health' },
  { label: 'thai đã đóng', count: item.closedPregnancyId ? 1 : 0, tab: 'repro' },
  { label: 'bê nháp', count: item.pendingCalfIds.length, tab: 'repro' },
].filter((group) => group.count > 0)

/** "Cần xem lại sau khi hủy" (R-13-12, MSG-FE13-05): what the exit closed or cancelled, per cattle; nothing is restored automatically. */
export default function ExitReviewList({ items }: { items: ExitReviewItem[] }) {
  const rows = items.map((item) => ({ item, groups: groups(item) }))
  return (
    <Box title="Cần xem lại sau khi hủy" sub="Các mục bị hủy hoặc đóng khi xuất không tự khôi phục; mở hồ sơ từng con để lập lại nếu cần.">
      <ul className="m-0 flex list-none flex-col gap-2 p-0 text-xs" aria-label="Cần xem lại sau khi hủy">
        {rows.map(({ item, groups: list }) => (
          <li key={item.cattleId || item.cattleCode} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <Link to={`/cattle/${encodeURIComponent(item.cattleCode)}`} className="font-semibold text-brand hover:underline">{item.cattleCode}</Link>
            {list.length ? list.map((group) => (
              <span key={group.label}>
                {group.tab
                  ? <Link to={`/cattle/${encodeURIComponent(item.cattleCode)}?tab=${group.tab}`} className="text-brand hover:underline">{group.count} {group.label}</Link>
                  : `${group.count} ${group.label}`}
              </span>
            )) : <span className="text-muted">Không có mục nào cần xem lại</span>}
          </li>
        ))}
      </ul>
    </Box>
  )
}
