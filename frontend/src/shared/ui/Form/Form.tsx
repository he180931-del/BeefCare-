import { useRef, type ChangeEvent, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cx } from '../cx'
import { Icon } from '../Icon/Icon'

// aria-invalid: a field marked invalid is drawn with a red border (only when a page sets aria-invalid="true").
const fieldCls =
  'w-full rounded-xl border border-field bg-white px-2.5 py-3 text-sm text-ink outline-none focus:border-brand aria-invalid:border-err-fg'

export const inputCls = `${fieldCls} read-only:bg-page read-only:text-muted`
export const smInputCls =
  'rounded-lg border border-field bg-white px-2 py-1.5 text-xs text-ink outline-none focus:border-brand'

export function Field({ label, id, hint, children }: { label: ReactNode; id?: string; hint?: ReactNode; children: ReactNode }) {
  const requiredLabel = typeof label === 'string' && label.endsWith(' *')
  const accessibleLabel = requiredLabel && typeof label === 'string' ? label.slice(0, -2) : undefined
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} aria-label={accessibleLabel} className="text-xs font-medium text-ink">{label}</label>
      {children}
      {hint && <span className="text-[11px] text-muted">{hint}</span>}
    </div>
  )
}

// ---------- Ô nhập liệu theo Figma (cao 44px, bo 12, viền #dce6de, chữ 14px) ----------

/** <select> có mũi tên như Figma. Dùng thay <select className={inputCls}>. */
export function Select({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={cx('relative', className)}>
      <select className={cx(fieldCls, 'cursor-pointer appearance-none pr-8')} {...p}>{children}</select>
      <Icon name="chevron-down" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" />
    </div>
  )
}

/**
 * Ô lọc đầu bảng của Redesign (cao 38px, bo 6, viền xám, chữ 12px).
 * `size="lg"`: cao 46px, bo 12, chữ 14px — cùng hàng với ô tìm kiếm / ô ngày 46px (SCR-16 Figma 2635:4108).
 */
export function FilterSelect({ className, children, size, ...p }: Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> & { size?: 'lg' }) {
  return (
    <div className={cx('relative inline-block max-w-full', className)}>
      <select className={cx('w-full cursor-pointer appearance-none border border-edge bg-white pl-[15px] pr-8 text-[#173629] outline-none focus:border-brand', size === 'lg' ? 'h-[46px] rounded-xl text-sm' : 'h-[38px] rounded-md text-xs')} {...p}>{children}</select>
      <Icon name="chevron-down" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#66756b]" />
    </div>
  )
}

/** Ô tìm kiếm trong trang, có icon kính lúp. */
export function SearchInput({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={cx('relative', className)}>
      <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
      <input type="search" className={cx(inputCls, 'pl-9')} {...p} />
    </div>
  )
}

/** Ô ngày: hiện dd/mm/yyyy + icon lịch (như Figma), bấm mở bộ chọn ngày. value/onChange dạng 'yyyy-mm-dd'. */
/**
 * `label` names the hidden native input for assistive technology; it falls back to "Chọn ngày".
 * Pass it whenever the field has a visible label, since an aria-label would otherwise hide that label.
 */
export function DateInput({ value, onChange, className, readOnly, id, label }: { value: string; onChange?: (value: string) => void; className?: string; readOnly?: boolean; id?: string; label?: string }) {
  const ref = useRef<HTMLInputElement>(null)
  const [y, m, d] = value ? value.split('-') : []
  return (
    <div className={cx('relative', className)}>
      {/* fieldCls, not inputCls: a <div> always matches :read-only, which greyed every date field out like a locked one. */}
      <div className={cx(fieldCls, 'flex items-center gap-1.5', readOnly && '!bg-page !text-muted')}>
        <span className={cx('min-w-0 flex-1', !value && 'text-subtle')}>{value ? `${d}/${m}/${y}` : 'dd/mm/yyyy'}</span>
        <Icon name="calendar-event" className="text-muted" />
      </div>
      {!readOnly && (
        <input
          ref={ref}
          id={id}
          type="date"
          value={value || ''}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange?.(e.target.value)}
          onClick={() => ref.current?.showPicker?.()}
          aria-label={label ?? 'Chọn ngày'}
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
      {/* The real input is visually hidden, so the dot carries the keyboard focus ring. */}
      <span className={cx('size-4 shrink-0 rounded-full border peer-focus-visible:ring-2 peer-focus-visible:ring-brand peer-focus-visible:ring-offset-2', checked ? 'border-brand bg-brand' : 'border-edge bg-white')} />
      {children}
    </label>
  )
}

/** Checkbox vuông 16px, đặc xanh khi chọn (Figma không vẽ dấu tick). */
export function Checkbox({ checked, onChange, children, className, ...p }: { checked: boolean; onChange?: InputHTMLAttributes<HTMLInputElement>['onChange']; children?: ReactNode; className?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, 'checked' | 'onChange' | 'className'>) {
  return (
    <label className={cx('inline-flex cursor-pointer items-start gap-2', className)}>
      <input type="checkbox" checked={checked} onChange={onChange} className="peer sr-only" {...p} />
      <span className={cx('mt-px size-4 shrink-0 rounded border peer-focus-visible:ring-2 peer-focus-visible:ring-brand peer-focus-visible:ring-offset-2', checked ? 'border-brand bg-brand' : 'border-edge bg-white')} />
      {children}
    </label>
  )
}
