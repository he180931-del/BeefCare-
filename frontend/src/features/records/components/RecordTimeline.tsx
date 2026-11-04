export interface TimelineEvent { date: string; title: string; detail: string; by: string }
export function RecordTimeline({ events }: { events: TimelineEvent[] }) {
  return <ol className="m-0 list-none divide-y divide-rule p-0">{events.map((event) => <li key={`${event.date}-${event.title}`} className="grid gap-2 py-4 sm:grid-cols-[120px_1fr]"><time dateTime={event.date} className="text-xs font-semibold text-brand">{new Date(`${event.date}T00:00:00`).toLocaleDateString('vi-VN')}</time><div><h3 className="m-0 text-sm font-semibold text-ink">{event.title}</h3><p className="mb-0 mt-1 text-xs leading-5 text-subtle">{event.detail}</p><span className="mt-1 block text-[11px] text-faint">{event.by}</span></div></li>)}</ol>
}
