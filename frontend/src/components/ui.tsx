import { Children, cloneElement, isValidElement, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type ChangeEvent, type HTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TdHTMLAttributes, type ThHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import type { DocumentRow, Payment } from '../types'

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ')

const BTN = 'inline-flex max-w-full items-center justify-center whitespace-nowrap border font-semibold leading-tight cursor-pointer disabled:cursor-not-allowed disabled:opacity-45'
const BTN_VARIANT: Record<ButtonVariant, string> = {
  default: 'border-edge bg-white text-[#212121]',
  primary: 'border-brand bg-brand text-white',
  danger: 'border-err-fg bg-err-fg text-white',
  link: 'border-transparent bg-transparent text-brand',
}

/**
 * variant: default | primary | danger | link. Mọi cỡ dùng bán kính 4–8px;
 * nút thường cao 32px, nút nhỏ 28px để hành động trong bảng không chen nhau.
 */
type ButtonVariant = 'default' | 'primary' | 'danger' | 'link'
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: ButtonVariant; size?: 'sm' | 'lg'; small?: boolean; block?: boolean }
export function Button({ variant = 'default', size, small, block, className, ...props }: ButtonProps) {
  const lg = size === 'lg'
  const sm = small || size === 'sm'
  return (
    <button
      type="button"
      className={cx(
        BTN,
        BTN_VARIANT[variant],
        lg
          ? 'min-h-11 rounded-md px-5 py-2 text-sm'
          : cx(
              'rounded-md',
              variant === 'link' ? 'min-h-8 px-1.5 py-1' : sm ? 'min-h-8 px-2.5 py-1' : 'min-h-9 px-3.5 py-1.5',
              sm ? 'text-xs' : 'text-[13px]',
            ),
        lg && variant === 'default' && 'border-field',
        block && 'w-full',
        className,
      )}
      {...props}
    />
  )
}

const BADGE_TONE = {
  ok: 'border-ok-bg bg-ok-bg text-ok-fg',
  err: 'border-err-bg bg-err-bg text-err-fg',
  warn: 'border-warn-bg bg-warn-bg text-warn-fg',
  info: 'border-[#e8f2fa] bg-[#e8f2fa] text-[#296194]',
  outline: 'border-edge bg-white text-[#212121]',
}

/** tone: ok | err | warn | info | outline | (mặc định xám). Chữ 10px, bo 10px. */
export type BadgeTone = 'ok' | 'err' | 'warn' | 'info' | 'outline'
export function Badge({ tone, className, children }: { tone?: BadgeTone; className?: string; children?: ReactNode }) {
  return (
    <span className={cx('inline-block whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium leading-5', tone ? BADGE_TONE[tone] : undefined, tone ? undefined : 'border-edge bg-chip text-[#212121]', className)}>
      {children}
    </span>
  )
}

const STATUS_TONE: Record<string, BadgeTone | undefined> = { 'Đã nhập': 'ok', 'Đã xuất': 'ok', 'Đã hủy': 'err', 'Chờ xác nhận': 'warn' }
export const StatusBadge = ({ status }: { status: string }) => <Badge tone={STATUS_TONE[status]}>{status}</Badge>

export function Segmented({ options, value, onChange }: { options: Array<{ value: string; label: ReactNode; disabled?: boolean }>; value: string; onChange: (value: string) => void }) {
  return (
    <div className="inline-flex max-w-full flex-wrap gap-[3px] rounded-[5px] bg-chip p-[3px]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={cx(
            'min-h-8 cursor-pointer rounded px-3 py-1.5 text-xs border disabled:cursor-not-allowed disabled:opacity-50',
            o.value === value ? 'border-faint bg-white font-semibold text-[#212121]' : 'border-transparent text-muted',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Card({ title, sub, actions, children }: { title?: ReactNode; sub?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-md border border-edge bg-white p-4">
      {(title || actions) && (
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="m-0 text-sm font-semibold">
            {title}
            {sub && <small className="mt-[3px] block text-[11px] font-normal text-muted">{sub}</small>}
          </h3>
          <div className="flex-1" />
          {actions && <div className="flex gap-2.5">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

export function Tile({ label, value, note, warn }: { label: ReactNode; value: ReactNode; note: ReactNode; warn?: boolean }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-edge bg-white p-4">
      <span className="text-xs text-muted">{label}</span>
      <span className={cx('text-xl font-bold', warn && 'text-warn-fg')}>{value}</span>
      <span className="text-xs font-semibold text-brand">{note}</span>
    </div>
  )
}

export const inputCls =
  'min-h-8 w-full min-w-0 rounded-md border border-field bg-white px-3 py-1.5 text-[13px] text-ink outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/10 disabled:cursor-not-allowed disabled:bg-page disabled:text-faint read-only:bg-page read-only:text-muted'
export const smInputCls =
  'rounded-md border border-field bg-white px-2 py-1 text-xs text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/10'

export function Field({ label, id, hint, children }: { label: ReactNode; id?: string; hint?: ReactNode; children: ReactNode }) {
  const generatedId = useId()
  const controlId = id || `field-${generatedId.replace(/:/g, '')}`
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={controlId} className="text-xs font-semibold text-ink">{label}</label>
      {isValidElement(children) ? cloneElement(children, { id: controlId } as Record<string, unknown>) : children}
      {hint && <span className="text-xs leading-5 text-muted">{hint}</span>}
    </div>
  )
}

export function Info({ items, cols = 3 }: { items: Array<ReadonlyArray<unknown>>; cols?: 2 | 3 }) {
  return (
    <dl className={cx('m-0 grid gap-x-4 gap-y-3', cols === 2 ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3')}>
      {items.map(([k, v, warn]) => (
        <div key={String(k)}>
          <dt className="mb-[3px] text-xs text-faint">{String(k)}</dt>
          <dd className={cx('m-0 text-[13px]', warn ? 'font-semibold text-warn-fg' : 'font-medium')}>{typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? '')}</dd>
        </div>
      ))}
    </dl>
  )
}

// Giữ dạng bảng lâu hơn ở tablet để tránh mỗi dòng bị kéo thành một khối rất cao.
// Chỉ xếp dọc khi khung thực sự hẹp; bảng `scroll` vẫn cuộn trong chính khung, không làm tràn trang.
const STACK = {
  wide: '@max-[620px]:block @max-[620px]:[&_thead]:hidden @max-[620px]:[&_tbody]:block @max-[620px]:[&_tfoot]:block @max-[620px]:[&_tr]:block @max-[620px]:[&_tr:not(:last-child)]:border-b @max-[620px]:[&_tr]:border-rule @max-[620px]:[&_td]:grid @max-[620px]:[&_td]:grid-cols-[minmax(112px,0.32fr)_minmax(0,1fr)] @max-[620px]:[&_td]:items-start @max-[620px]:[&_td]:gap-4 @max-[620px]:[&_td]:border-b-0 @max-[620px]:[&_td>*]:col-start-2 @max-[620px]:[&_td]:before:content-[attr(data-label)] @max-[620px]:[&_td]:before:text-xs @max-[620px]:[&_td]:before:font-semibold @max-[620px]:[&_td]:before:text-muted @max-[620px]:[&_td:empty]:hidden',
  normal: '@max-[640px]:block @max-[640px]:[&_thead]:hidden @max-[640px]:[&_tbody]:block @max-[640px]:[&_tfoot]:block @max-[640px]:[&_tr]:block @max-[640px]:[&_tr:not(:last-child)]:border-b @max-[640px]:[&_tr]:border-rule @max-[640px]:[&_td]:grid @max-[640px]:[&_td]:grid-cols-[minmax(96px,0.36fr)_minmax(0,1fr)] @max-[640px]:[&_td]:items-start @max-[640px]:[&_td]:gap-3 @max-[640px]:[&_td]:border-b-0 @max-[640px]:[&_td>*]:col-start-2 @max-[640px]:[&_td]:before:content-[attr(data-label)] @max-[640px]:[&_td]:before:text-xs @max-[640px]:[&_td]:before:font-semibold @max-[640px]:[&_td]:before:text-muted @max-[640px]:[&_td:empty]:hidden',
}

export function Table({ children, wide, scroll, stack = true, bordered = false, pageSize = 25 }: { children: ReactNode; wide?: boolean; scroll?: boolean; stack?: boolean; bordered?: boolean; pageSize?: number }) {
  const ref = useRef<HTMLTableElement>(null)
  const [page, setPage] = useState(1)
  const [responsivePageSize, setResponsivePageSize] = useState(() => {
    if (pageSize !== 25 || typeof window === 'undefined') return pageSize
    return window.innerWidth <= 900 ? 8 : window.innerWidth <= 1180 ? 15 : pageSize
  })
  useEffect(() => {
    if (pageSize !== 25) { setResponsivePageSize(pageSize); return }
    const update = () => setResponsivePageSize(window.innerWidth <= 900 ? 8 : window.innerWidth <= 1180 ? 15 : pageSize)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [pageSize])
  const sections = useMemo(() => Children.toArray(children), [children])
  const bodyIndex = sections.findIndex((child) => isValidElement<{ children?: ReactNode }>(child) && child.type === 'tbody')
  const body = bodyIndex >= 0 && isValidElement<{ children?: ReactNode }>(sections[bodyIndex]) ? sections[bodyIndex] : undefined
  const rows = body ? Children.toArray(body.props.children) : []
  const shouldPaginate = responsivePageSize > 0 && rows.length > responsivePageSize
  const pageCount = shouldPaginate ? Math.ceil(rows.length / responsivePageSize) : 1
  const visiblePages = useMemo(() => {
    const windowSize = Math.min(5, pageCount)
    const start = Math.max(1, Math.min(page - 2, pageCount - windowSize + 1))
    return Array.from({ length: windowSize }, (_, index) => start + index)
  }, [page, pageCount])
  useEffect(() => { if (page > pageCount) setPage(pageCount) }, [page, pageCount])
  const renderedSections = shouldPaginate && body
    ? sections.map((section, index) => index === bodyIndex
      ? cloneElement(body, { children: rows.slice((page - 1) * responsivePageSize, page * responsivePageSize) })
      : section)
    : sections
  useLayoutEffect(() => {
    const t = ref.current
    if (!t) return
    const heads = [...t.querySelectorAll('thead th')].map((h) => h.textContent.trim())
    t.querySelectorAll('tbody tr').forEach((tr) =>
      [...tr.children].forEach((td, i) => (heads[i] ? td.setAttribute('data-label', heads[i]) : td.removeAttribute('data-label'))),
    )
    t.querySelectorAll('tfoot tr').forEach((tr) => {
      let column = 0
      let headingFound = false
      ;[...tr.children].forEach((td) => {
        const span = Number(td.getAttribute('colspan') || 1)
        const text = td.textContent.trim()
        const summaryHeading = !headingFound && /^tổng\b/i.test(text)
        td.toggleAttribute('data-summary-heading', summaryHeading)
        if (summaryHeading) {
          headingFound = true
          td.removeAttribute('data-label')
        } else if (heads[column]) td.setAttribute('data-label', heads[column])
        else td.removeAttribute('data-label')
        column += span
      })
    })
  })
  return (
    <div className={cx('@container bg-white', bordered && 'rounded-md border border-edge')}>
      <div className={scroll ? 'overflow-x-auto' : 'overflow-hidden'}>
        <table
          ref={ref}
          data-stack={wide ? 'wide' : 'normal'}
          className={cx('beefcare-table w-full border-collapse', scroll && wide && 'min-w-[860px]', scroll && !wide && !stack && 'min-w-[620px]', stack && STACK[wide ? 'wide' : 'normal'])}
        >
          {renderedSections}
        </table>
      </div>
      {shouldPaginate && <nav aria-label="Phân trang bảng" className="flex flex-wrap items-center justify-between gap-3 border-t border-rule px-3 py-2 text-xs text-subtle">
        <span>Hiển thị {(page - 1) * responsivePageSize + 1}–{Math.min(page * responsivePageSize, rows.length)} / {rows.length} dòng</span>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Button small disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Trước</Button>
          <span className="sr-only">Trang {page} trên {pageCount}</span>
          {visiblePages.map((pageNumber) => <Button key={pageNumber} small variant={pageNumber === page ? 'primary' : 'default'} aria-current={pageNumber === page ? 'page' : undefined} aria-label={`Trang ${pageNumber}`} onClick={() => setPage(pageNumber)}>{pageNumber}</Button>)}
          <Button small disabled={page === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>Sau</Button>
        </div>
      </nav>}
    </div>
  )
}
export const Th = ({ className, ...p }: ThHTMLAttributes<HTMLTableCellElement>) => (
  <th className={cx('bg-chip px-2 py-2 text-left text-xs font-semibold text-muted first:pl-3 last:pr-3', className)} {...p} />
)
export const Td = ({ className, ...p }: TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={cx('px-2 py-2 align-middle text-xs [overflow-wrap:anywhere] first:pl-3 last:pr-3', className)} {...p} />
)

export const Note = ({ tone = 'grey', children }: { tone?: 'grey' | 'warn' | 'err' | 'ok' | 'info'; children: ReactNode }) => (
  <div
    className={cx(
      'rounded-md px-3 py-2.5 text-xs',
      { grey: 'bg-chip', warn: 'bg-warn-bg text-warn-fg', err: 'bg-err-bg text-err-fg', ok: 'bg-ok-bg text-ok-fg', info: 'bg-[#e8f2fa] text-[#296194]' }[tone],
    )}
  >
    {children}
  </div>
)

export const Foot = ({ children }: { children: ReactNode }) => <p className="m-0 text-xs leading-5 text-subtle">{children}</p>

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

export function Dropzone({ hint, onFiles, accept = 'application/pdf,image/jpeg', multiple = true, disabled = false }: {
  hint?: ReactNode
  onFiles?: (files: File[]) => void
  accept?: string
  multiple?: boolean
  disabled?: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  const send = (files: FileList | null) => onFiles?.(files ? Array.from(files) : [])
  return (
    <div
      className={cx('rounded-md border border-field bg-page p-4 text-center text-xs font-semibold text-brand', disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer')}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={() => { if (!disabled) input.current?.click() }}
      onKeyDown={(event) => { if (!disabled && (event.key === 'Enter' || event.key === ' ')) input.current?.click() }}
      onDragOver={(event) => { if (!disabled) event.preventDefault() }}
      onDrop={(event) => { event.preventDefault(); if (!disabled) send(event.dataTransfer.files) }}
    >
      <input
        ref={input}
        type="file"
        className="sr-only"
        aria-label="Chọn chứng từ đính kèm"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(event) => { if (!disabled) send(event.target.files); event.target.value = '' }}
      />
      ⇪ Kéo thả tệp hoặc Chọn tệp
      <small className="mt-1 block text-xs font-normal text-muted">{hint}</small>
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
            <Td>{Number(p.amount).toLocaleString('vi-VN')}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}

export function PageHeader({ title, sub, badge, children }: { title: ReactNode; sub?: ReactNode; badge?: ReactNode; children?: ReactNode }) {
  const visibleSub = typeof sub === 'string' && /(?:dữ liệu demo|duyệt giao diện|duyệt luồng|không gọi api|bản demo|localstorage|lưu trên thiết bị|scr\d{2,3})/i.test(sub) ? undefined : sub
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div>
        <h1 className="m-0 text-[22px] font-bold">{title}</h1>
        {visibleSub && <p className="mb-0 mt-1 max-w-[700px] text-xs text-muted">{visibleSub}</p>}
        {badge && <div className="mt-1">{badge}</div>}
      </div>
      <div className="flex-1" />
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

// ---------- Ô nhập liệu dùng chung: cao tối thiểu 32px, bo 6px ----------

/** <select> có mũi tên ▾ nhỏ như Figma. Dùng thay <select className={inputCls}>. */
export function Select({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={cx('relative', className)}>
      <select className={cx(inputCls, 'cursor-pointer appearance-none pr-7')} {...p}>{children}</select>
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted">▾</span>
    </div>
  )
}

/** Ô ngày: hiện dd/mm/yyyy + ▾ (như Figma), bấm mở bộ chọn ngày. value/onChange dạng 'yyyy-mm-dd'. */
export function DateInput({ value, onChange, className, readOnly, id }: { value: string; onChange?: (value: string) => void; className?: string; readOnly?: boolean; id?: string }) {
  const ref = useRef<HTMLInputElement>(null)
  const [y, m, d] = value ? value.split('-') : []
  return (
    <div className={cx('relative', className)}>
      <div className={cx(inputCls, 'flex items-center gap-1.5')}>
        <span className="min-w-0 flex-1">{value ? `${d}/${m}/${y}` : 'dd/mm/yyyy'}</span>
        <span className="text-xs text-muted">▾</span>
      </div>
      {!readOnly && (
        <input
          ref={ref}
          id={id}
          type="date"
          value={value || ''}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange?.(e.target.value)}
          onClick={() => ref.current?.showPicker?.()}
          aria-label="Chọn ngày"
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      )}
    </div>
  )
}

export const Textarea = ({ className, rows = 2, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea rows={rows} className={cx(inputCls, 'resize-none leading-[1.4]', className)} {...p} />

/** Radio tròn đặc màu xanh khi chọn (như Figma). Dùng trong <label> riêng cho từng lựa chọn. */
export function Radio({ checked, onChange, children, name, className }: { checked: boolean; onChange?: InputHTMLAttributes<HTMLInputElement>['onChange']; children: ReactNode; name?: string; className?: string }) {
  return (
    <label className={cx('inline-flex cursor-pointer items-center gap-2 text-sm text-ink', className)}>
      <input type="radio" name={name} checked={checked} onChange={onChange} className="peer sr-only" />
      <span className={cx('size-4 shrink-0 rounded-full border', checked ? 'border-brand bg-brand' : 'border-edge bg-white')} />
      {children}
    </label>
  )
}

/** Checkbox vuông 16px, đặc xanh khi chọn (Figma không vẽ dấu tick). */
export function Checkbox({ checked, onChange, children, className, ...p }: { checked: boolean; onChange?: InputHTMLAttributes<HTMLInputElement>['onChange']; children?: ReactNode; className?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, 'checked' | 'onChange' | 'className'>) {
  return (
    <label className={cx('inline-flex cursor-pointer items-start gap-2', className)}>
      <input type="checkbox" checked={checked} onChange={onChange} className="peer sr-only" {...p} />
      <span className={cx('mt-px size-4 shrink-0 rounded border', checked ? 'border-brand bg-brand' : 'border-edge bg-white')} />
      {children}
    </label>
  )
}

/** Tab gạch chân (hồ sơ bò): tab = [{value,label}]. Chọn = đậm + gạch 3px xanh. */
export function Tabs({ tabs, value, onChange }: { tabs: Array<{ value: string; label: ReactNode }>; value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex flex-wrap gap-x-0 border-b-0">
      {tabs.map((t) => (
        <button key={t.value} type="button" onClick={() => onChange(t.value)} className="cursor-pointer px-3.5 pb-1.5 pt-1 text-sm">
          <span className={cx('inline-block pb-1.5', t.value === value ? 'border-b-[3px] border-brand font-semibold text-[#212121]' : 'border-b-[3px] border-transparent text-muted')}>{t.label}</span>
        </button>
      ))}
    </div>
  )
}

/** Hộp số liệu "nhãn nhỏ xám + giá trị" dùng trong modal/summary (11px #8f8f8f trên, 13px medium dưới). */
export const KV = ({ k, children, className }: { k: ReactNode; children: ReactNode; className?: string }) => (
  <div className={className}>
    <div className="mb-[3px] text-xs text-faint">{k}</div>
    <div className="text-[13px] font-medium">{children}</div>
  </div>
)
