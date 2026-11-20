import { isValidElement, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cx } from '../cx'

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

/**
 * Thẻ chỉ số của Redesign (Tổng quan, Hàng đợi...). `dot`: mã màu chấm trước nhãn; `compact`: số 20px thay vì 28px;
 * `sub`: dòng phụ xám; `link`: liên kết cuối thẻ.
 */
export function Metric({ label, value, note, sub, dot, compact, warn, link }: { label: ReactNode; value: ReactNode; note?: ReactNode; sub?: ReactNode; dot?: string; compact?: boolean; warn?: boolean; link?: { label: ReactNode; to: string } }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-md border border-edge bg-white px-[18px] py-4">
      <div className="flex items-center gap-2 text-xs text-[#66756b]">
        {dot && <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: dot }} />}
        {label}
      </div>
      <div className={cx('font-bold', compact ? 'text-xl leading-[25px]' : 'text-[28px] leading-[35px]', warn ? 'text-warn-fg' : 'text-[#173629]')}>{value}</div>
      {sub && <div className="text-[11px] text-[#66756b]">{sub}</div>}
      {note && <div className="text-[11px] font-bold text-[#08734f]">{note}</div>}
      {link && <Link to={link.to} className="text-[11px] font-bold text-[#08734f] no-underline hover:underline">{link.label}</Link>}
    </div>
  )
}

export function Info({ items, cols = 3 }: { items: Array<ReadonlyArray<unknown>>; cols?: 2 | 3 }) {
  return (
    <dl className={cx('m-0 grid gap-x-4 gap-y-3', cols === 2 ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3')}>
      {items.map(([k, v, warn]) => (
        <div key={String(k)}>
          {/* text-muted (#666, 5.7:1 on white); #8f8f8f was 3.2:1, below WCAG AA for 11 px labels. */}
          <dt className="mb-[3px] text-[11px] text-muted">{String(k)}</dt>
          <dd className={cx('m-0 text-[13px]', warn ? 'font-semibold text-warn-fg' : 'font-medium')}>{isValidElement(v) ? v : typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? '')}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Hộp số liệu "nhãn nhỏ xám + giá trị" dùng trong modal/summary (11px #8f8f8f trên, 13px medium dưới). */
export const KV = ({ k, children, className }: { k: ReactNode; children: ReactNode; className?: string }) => (
  <div className={className}>
    <div className="mb-[3px] text-[11px] text-muted">{k}</div>
    <div className="text-[13px] font-medium">{children}</div>
  </div>
)
