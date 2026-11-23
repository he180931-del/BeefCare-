import { isValidElement, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cx } from '../cx'
import { Panel } from '../Panel/Panel'

/**
 * `variant="panel"`: khối Bento cho màn đã chuyển sang docs/BeefCare-Bento-Grid.md. Dùng chung bề mặt và tiêu đề của
 * `Panel` (bo 16 px, padding 16/24 px, tiêu đề h2 18 px) để khối cạnh nhau trên một màn cùng một kiểu; `headingAs="h3"`
 * cho khối lồng trong khối khác.
 */
export function Card({ title, sub, actions, variant = 'default', headingAs, children }: { title?: ReactNode; sub?: ReactNode; actions?: ReactNode; variant?: 'default' | 'panel'; headingAs?: 'h2' | 'h3'; children: ReactNode }) {
  if (variant === 'panel') return <Panel title={title} sub={sub} headingAs={headingAs} actions={actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}>{children}</Panel>
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

export type MetricTone = 'default' | 'emphasis' | 'err' | 'warn' | 'ok'

// Bento (docs/BeefCare-Bento-Grid.md §3): xanh đậm = khối nổi bật, đỏ nhạt = lỗi/quá hạn, vàng nhạt = cần chú ý,
// xanh nhạt = tích cực. Nhãn/dòng phụ #5b6a60 đạt ≥ 4,9:1 trên cả ba nền nhạt (#66756b chỉ 4,2:1 trên nền đỏ nhạt).
const METRIC_PANEL: Record<MetricTone, { box: string; label: string; value: string; accent: string }> = {
  default: { box: 'border-field bg-white', label: 'text-label', value: 'text-[#173629]', accent: 'text-[#08734f]' },
  emphasis: { box: 'border-brand-dark bg-brand-dark', label: 'text-side-text', value: 'text-white', accent: 'text-white' },
  err: { box: 'border-err-bg bg-err-bg', label: 'text-label', value: 'text-[#173629]', accent: 'text-[#08734f]' },
  warn: { box: 'border-warn-bg bg-warn-bg', label: 'text-label', value: 'text-[#173629]', accent: 'text-[#08734f]' },
  ok: { box: 'border-ok-bg bg-ok-bg', label: 'text-label', value: 'text-[#173629]', accent: 'text-[#08734f]' },
}

/**
 * Thẻ chỉ số của Redesign (Tổng quan, Hàng đợi...). `dot`: mã màu chấm trước nhãn; `compact`: số 20px thay vì 28px;
 * `sub`: dòng phụ xám; `link`: liên kết cuối thẻ. `surface="panel"` + `tone`: thẻ của bố cục Bento (bo 16 px, nền theo
 * mức độ); màu luôn đi kèm nhãn chữ của thẻ.
 */
export function Metric({ label, value, note, sub, dot, compact, warn, link, surface = 'card', tone = 'default' }: { label: ReactNode; value: ReactNode; note?: ReactNode; sub?: ReactNode; dot?: string; compact?: boolean; warn?: boolean; link?: { label: ReactNode; to: string }; surface?: 'card' | 'panel'; tone?: MetricTone }) {
  const panel = surface === 'panel' ? METRIC_PANEL[tone] : undefined
  const muted = panel?.label ?? 'text-[#66756b]'
  const accent = panel?.accent ?? 'text-[#08734f]'
  return (
    <div className={cx('flex min-w-0 flex-col gap-1.5 border px-[18px] py-4', panel ? `rounded-2xl ${panel.box}` : 'rounded-md border-edge bg-white')}>
      <div className={cx('flex items-center gap-2 text-xs', muted)}>
        {dot && <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: dot }} />}
        {label}
      </div>
      <div className={cx('font-bold', compact ? 'text-xl leading-[25px]' : 'text-[28px] leading-[35px]', warn ? 'text-warn-fg' : panel?.value ?? 'text-[#173629]')}>{value}</div>
      {sub && <div className={cx('text-[11px]', muted)}>{sub}</div>}
      {note && <div className={cx('text-[11px] font-bold', accent)}>{note}</div>}
      {/* Thẻ Bento: -my/py mở vùng chạm lên ~44 px (§3) mà không đổi chiều cao thẻ. */}
      {link && <Link to={link.to} className={cx('text-[11px] font-bold no-underline hover:underline', accent, panel && '-my-3.5 py-3.5')}>{link.label}</Link>}
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
