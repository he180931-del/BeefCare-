import { isUnread, relativeTime } from '../domain/notificationRules'
import type { NotificationView } from '../types'

/** Một thông báo: dấu chưa đọc, tiêu đề, dòng ngữ cảnh và thời gian tương đối. Mở đích khi bấm (GBR-64). */
export function NotificationRow({ item, now, onOpen }: { item: NotificationView; now: Date; onOpen: (item: NotificationView) => void }) {
  const unread = isUnread(item)
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={`grid min-h-11 w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 rounded-2xl border border-field px-4 py-3 text-left hover:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand @min-[640px]:grid-cols-[auto_minmax(0,1fr)_auto] ${unread ? 'bg-chip' : 'bg-white'}`}
    >
      <span aria-hidden className={`size-2 shrink-0 rounded-full ${unread ? 'bg-[#454545]' : 'bg-[#dedede]'}`} />
      <span className="min-w-0">
        <span className={`block break-words text-[13px] text-ink ${unread ? 'font-semibold' : ''}`}>
          {unread && <span className="sr-only">Chưa đọc: </span>}
          {item.title}
        </span>
        <span className="block break-words text-xs text-label">{item.summary}</span>
      </span>
      <span className="col-start-2 text-xs text-label @min-[640px]:col-start-3 @min-[640px]:row-start-1">{relativeTime(item.createdTime, now)}</span>
    </button>
  )
}
