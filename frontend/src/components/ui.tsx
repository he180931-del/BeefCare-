import { useRef, type ReactNode } from 'react'
import { Badge, Button, Table, Td, Th, type BadgeTone } from '../shared/ui'
import type { DocumentRow, Payment } from '../types'

// These four parts know Herd Entry / Herd Exit models or copy, so they are not shared UI. They stay here until their
// owner is decided (docs/frontend-refactor-guide.md §6.2 and §13 item 2); neutral primitives live in `shared/ui`.

const STATUS_TONE: Record<string, BadgeTone | undefined> = { 'Đã nhập': 'ok', 'Đã xuất': 'ok', 'Đã hủy': 'err', 'Chờ xác nhận': 'warn' }
export const StatusBadge = ({ status }: { status: string }) => <Badge tone={STATUS_TONE[status]}>{status}</Badge>

export function Docs({ docs, onView, onRemove }: { docs?: DocumentRow[]; onView?: (index: number) => void; onRemove?: (index: number) => void }) {
  return (docs ?? []).map((d, index) => (
    <div className="flex items-center gap-2 text-xs" key={`${d.name}-${index}`}>
      <Badge>{d.ext}</Badge>
      <span>{d.name}</span>
      <span className="flex-1" />
      {(onView || typeof d.url === 'string') && (
        <Button
          variant="link"
          small
          aria-label={`Xem ${d.name}`}
          onClick={() => onView ? onView(index) : window.open(String(d.url), '_blank', 'noopener,noreferrer')}
        >Xem</Button>
      )}
      {onRemove && <Button variant="link" small aria-label={`Xóa ${d.name}`} onClick={() => onRemove(index)}>Xóa</Button>}
    </div>
  ))
}

export function Dropzone({ hint, onFiles, accept = 'application/pdf,image/jpeg', multiple = true }: {
  hint?: ReactNode
  onFiles?: (files: File[]) => void
  accept?: string
  multiple?: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  const send = (files: FileList | null) => onFiles?.(files ? Array.from(files) : [])
  return (
    <div
      className="cursor-pointer rounded-md border border-field bg-page p-4 text-center text-xs font-semibold text-brand"
      role="button"
      tabIndex={0}
      onClick={() => input.current?.click()}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') input.current?.click() }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => { event.preventDefault(); send(event.dataTransfer.files) }}
    >
      <input
        ref={input}
        type="file"
        className="sr-only"
        aria-label="Chọn chứng từ đính kèm"
        accept={accept}
        multiple={multiple}
        onChange={(event) => { send(event.target.files); event.target.value = '' }}
      />
      ⇪ Kéo thả tệp hoặc Chọn tệp
      <small className="mt-1 block text-[11px] font-normal text-muted">{hint}</small>
    </div>
  )
}

export function PaymentTable({ payments }: { payments: Payment[] }) {
  return (
    <Table stack={false}>
      <thead>
        <tr><Th>Ngày · người ghi</Th><Th>Phương thức · tham chiếu</Th><Th>Số tiền (đ)</Th></tr>
      </thead>
      <tbody>
        {payments.map((p) => (
          <tr key={p.ref}>
            <Td>{p.date}<br />{p.by}</Td>
            <Td>{p.method}<br />{p.ref}</Td>
            <Td className="whitespace-nowrap">{Number(p.amount).toLocaleString('vi-VN')}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}
