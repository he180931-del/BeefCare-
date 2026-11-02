import { isUnread, relativeTime } from '../domain/notificationRules'
import type { NotificationView } from '../types'

/** Một thông báo: dấu chưa đọc, tiêu đề, dòng ngữ cảnh và thời gian tương đối. Mở đích khi bấm (GBR-64). */
export function NotificationRow({ item, now, onOpen }: { item: NotificationView; now: Date; onOpen: (item: NotificationView) => void }) {
  const unread = isUnread(item)
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={`flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-field px-4 py-3 text-left hover:border-brand ${unread ? 'bg-chip' : 'bg-white'}`}
    >
      <span aria-hidden className={`size-2 shrink-0 rounded-full ${unread ? 'bg-[#454545]' : 'bg-[#dedede]'}`} />
      <span className="min-w-0 flex-1 basis-[200px]">
        <span className={`block break-words text-[13px] text-ink ${unread ? 'font-semibold' : ''}`}>
          {unread && <span className="sr-only">Chưa đọc: </span>}
          {item.title}
        </span>
        <span className="block break-words text-xs text-muted">{item.summary}</span>
      </span>
      <span className="shrink-0 pl-5 text-xs text-muted sm:pl-0">{relativeTime(item.createdTime, now)}</span>
    </button>
  )
}
