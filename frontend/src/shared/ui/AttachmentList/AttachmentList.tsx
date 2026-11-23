import { Badge } from '../Badge/Badge'
import { Button } from '../Button/Button'

export interface AttachmentItem { key: string; name: string; extension?: string }
export function AttachmentList({ items, onView, onRemove }: { items: AttachmentItem[]; onView?: (key: string) => void; onRemove?: (key: string) => void }) {
  return <>{items.map((item) => <div className="flex items-center gap-2 text-xs" key={item.key}><Badge>{item.extension}</Badge><span>{item.name}</span><span className="flex-1" />{onView && <Button variant="link" small aria-label={`Xem ${item.name}`} onClick={() => onView(item.key)}>Xem</Button>}{onRemove && <Button variant="link" small aria-label={`Xóa ${item.name}`} onClick={() => onRemove(item.key)}>Xóa</Button>}</div>)}</>
}
