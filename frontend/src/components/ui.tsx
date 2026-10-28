import { useLayoutEffect, useRef, type ButtonHTMLAttributes, type ChangeEvent, type HTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TdHTMLAttributes, type ThHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import type { DocumentRow, Payment } from '../types'

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ')

const BTN = 'whitespace-nowrap border font-semibold cursor-pointer disabled:cursor-not-allowed disabled:opacity-45'
const BTN_VARIANT: Record<ButtonVariant, string> = {
  default: 'border-edge bg-white text-[#212121]',
  primary: 'border-brand bg-brand text-white',
  danger: 'border-err-fg bg-err-fg text-white',
  link: 'border-transparent bg-transparent text-brand',
}

/**
 * variant: default | primary | danger | link.  size: (mặc định) trang 13px, rounded 4 · 'sm' 12px · 'lg' = nút modal Figma
 * (cao 46px, rounded 12, 14px, viền #dce6de). `small` = tương thích cũ (giống size="sm").
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
        lg ? 'h-[46px] rounded-xl px-4 text-sm' : cx('rounded', variant === 'link' ? 'p-1' : 'px-4 py-[9px]', sm ? 'text-xs' : 'text-[13px]'),
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
    <span className={cx('inline-block whitespace-nowrap rounded-[10px] border px-2 py-[3px] text-[10px] font-medium', tone ? BADGE_TONE[tone] : undefined, tone ? undefined : 'border-edge bg-chip text-[#212121]', className)}>
      {children}
    </span>
  )
}

const STATUS_TONE: Record<string, BadgeTone | undefined> = { 'Đã nhập': 'ok', 'Đã xuất': 'ok', 'Đã hủy': 'err', 'Chờ xác nhận': 'warn' }
export const StatusBadge = ({ status }: { status: string }) => <Badge tone={STATUS_TONE[status]}>{status}</Badge>

export function Segmented({ options, value, onChange }: { options: Array<{ value: string; label: ReactNode }>; value: string; onChange: (value: string) => void }) {
  return (
    <div className="inline-flex max-w-full flex-wrap gap-[3px] rounded-[5px] bg-chip p-[3px]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            'cursor-pointer rounded px-3.5 py-[7px] text-xs border',
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
      <span className="text-[11px] font-semibold text-brand">{note}</span>
    </div>
  )
}

export const inputCls =
  'w-full rounded-xl border border-field bg-white px-2.5 py-3 text-sm text-ink outline-none focus:border-brand read-only:bg-page read-only:text-muted'
export const smInputCls =
  'rounded-lg border border-field bg-white px-2 py-1.5 text-xs text-ink outline-none focus:border-brand'

export function Field({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label className="text-xs font-medium text-ink">{label}</label>
      {children}
      {hint && <span className="text-[11px] text-muted">{hint}</span>}
    </div>
  )
}

export function Info({ items, cols = 3 }: { items: Array<ReadonlyArray<unknown>>; cols?: 2 | 3 }) {
  return (
    <dl className={cx('m-0 grid gap-x-4 gap-y-3', cols === 2 ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3')}>
      {items.map(([k, v, warn]) => (
        <div key={String(k)}>
          <dt className="mb-[3px] text-[11px] text-faint">{String(k)}</dt>
          <dd className={cx('m-0 text-[13px]', warn ? 'font-semibold text-warn-fg' : 'font-medium')}>{typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? '')}</dd>
        </div>
      ))}
    </dl>
  )
}

// Bảng không cuộn ngang: khi khung chứa hẹp hơn ngưỡng, mỗi dòng chuyển thành thẻ xếp dọc
// (nhãn lấy từ tiêu đề cột). Ngưỡng theo container, không theo màn hình.
const STACK = {
  wide: '@max-[900px]:block @max-[900px]:[&_thead]:hidden @max-[900px]:[&_tbody]:block @max-[900px]:[&_tfoot]:block @max-[900px]:[&_tr]:block @max-[900px]:[&_tr]:border-b @max-[900px]:[&_tr]:border-rule @max-[900px]:[&_td]:flex @max-[900px]:[&_td]:items-center @max-[900px]:[&_td]:justify-between @max-[900px]:[&_td]:gap-4 @max-[900px]:[&_td]:border-b-0 @max-[900px]:[&_td]:before:content-[attr(data-label)] @max-[900px]:[&_td]:before:text-[11px] @max-[900px]:[&_td]:before:font-semibold @max-[900px]:[&_td]:before:text-muted @max-[900px]:[&_td:empty]:hidden',
  normal: '@max-[640px]:block @max-[640px]:[&_thead]:hidden @max-[640px]:[&_tbody]:block @max-[640px]:[&_tfoot]:block @max-[640px]:[&_tr]:block @max-[640px]:[&_tr]:border-b @max-[640px]:[&_tr]:border-rule @max-[640px]:[&_td]:flex @max-[640px]:[&_td]:items-center @max-[640px]:[&_td]:justify-between @max-[640px]:[&_td]:gap-4 @max-[640px]:[&_td]:border-b-0 @max-[640px]:[&_td]:before:content-[attr(data-label)] @max-[640px]:[&_td]:before:text-[11px] @max-[640px]:[&_td]:before:font-semibold @max-[640px]:[&_td]:before:text-muted @max-[640px]:[&_td:empty]:hidden',
}

export function Table({ children, wide, scroll, stack = !scroll }: { children: ReactNode; wide?: boolean; scroll?: boolean; stack?: boolean }) {
  const ref = useRef<HTMLTableElement>(null)
  useLayoutEffect(() => {
    const t = ref.current
    if (!t) return
    const heads = [...t.querySelectorAll('thead th')].map((h) => h.textContent.trim())
    t.querySelectorAll('tbody tr, tfoot tr').forEach((tr) =>
      [...tr.children].forEach((td, i) => (heads[i] ? td.setAttribute('data-label', heads[i]) : td.removeAttribute('data-label'))),
    )
  })
  return (
    <div className={cx('@container rounded border border-edge bg-white', scroll ? 'overflow-x-auto' : 'overflow-hidden')}>
      <table
        ref={ref}
        className={cx('w-full border-collapse [&_tbody_tr:last-child_td]:border-b-0', scroll && 'min-w-[620px]', stack && STACK[wide ? 'wide' : 'normal'])}
      >
        {children}
      </table>
    </div>
  )
}
export const Th = ({ className, ...p }: ThHTMLAttributes<HTMLTableCellElement>) => (
  <th className={cx('bg-chip px-1.5 py-2.5 text-left text-[11px] font-semibold text-muted first:pl-3 last:pr-3', className)} {...p} />
)
export const Td = ({ className, ...p }: TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={cx('border-b border-rule px-1.5 py-2.5 align-middle text-xs [overflow-wrap:anywhere] first:pl-3 last:pr-3', className)} {...p} />
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

export const Foot = ({ children }: { children: ReactNode }) => <p className="m-0 text-[11px] text-subtle">{children}</p>

export function Docs({ docs }: { docs?: DocumentRow[] }) {
  return (docs ?? []).map((d) => (
    <div className="flex items-center gap-2 text-xs" key={d.name}>
      <Badge>{d.ext}</Badge>
      <span>{d.name}</span>
      <span className="flex-1" />
      <Button variant="link" small>Xem</Button>
    </div>
  ))
}

export function Dropzone({ hint }: { hint?: ReactNode }) {
  return (
    <div className="rounded-md border border-field bg-page p-4 text-center text-xs font-semibold text-brand">
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
            <Td>{Number(p.amount).toLocaleString('vi-VN')}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}

export function PageHeader({ title, sub, badge, children }: { title: ReactNode; sub?: ReactNode; badge?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div>
        <h1 className="m-0 text-[22px] font-bold">{title}</h1>
        {sub && <p className="mb-0 mt-1 max-w-[700px] text-xs text-muted">{sub}</p>}
        {badge && <div className="mt-1">{badge}</div>}
      </div>
      <div className="flex-1" />
      <div className="flex flex-wrap gap-2.5">{children}</div>
    </div>
  )
}

// ---------- Ô nhập liệu theo Figma (cao 44px, bo 12, viền #dce6de, chữ 14px) ----------

/** <select> có mũi tên ▾ nhỏ như Figma. Dùng thay <select className={inputCls}>. */
export function Select({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={cx('relative', className)}>
      <select className={cx(inputCls, 'cursor-pointer appearance-none pr-7')} {...p}>{children}</select>
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted">▾</span>
    </div>
  )
}

/** Ô ngày: hiện dd/mm/yyyy + ▾ (như Figma), bấm mở bộ chọn ngày. value/onChange dạng 'yyyy-mm-dd'. */
export function DateInput({ value, onChange, className, readOnly }: { value: string; onChange?: (value: string) => void; className?: string; readOnly?: boolean }) {
  const ref = useRef<HTMLInputElement>(null)
  const [y, m, d] = value ? value.split('-') : []
  return (
    <div className={cx('relative', className)}>
      <div className={cx(inputCls, 'flex items-center gap-1.5')}>
        <span className="min-w-0 flex-1">{value ? `${d}/${m}/${y}` : 'dd/mm/yyyy'}</span>
        <span className="text-[10px] text-muted">▾</span>
      </div>
      {!readOnly && (
        <input
          ref={ref}
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
    <div className="mb-[3px] text-[11px] text-faint">{k}</div>
    <div className="text-[13px] font-medium">{children}</div>
  </div>
)
