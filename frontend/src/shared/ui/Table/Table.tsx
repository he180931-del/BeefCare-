import { useLayoutEffect, useRef, type ReactNode, type TdHTMLAttributes, type ThHTMLAttributes } from 'react'
import { cx } from '../cx'
import { Icon } from '../Icon/Icon'

/** Phân trang "‹ 1 2 3 … 36 ›" dưới bảng. `summary`: dòng "Hiển thị 1–7 trong 248". */
export function Pagination({ page, pageCount, onChange, summary }: { page: number; pageCount: number; onChange: (page: number) => void; summary?: ReactNode }) {
  const shown = [...new Set([1, page - 1, page, page + 1, pageCount])].filter((value) => value >= 1 && value <= pageCount).sort((a, b) => a - b)
  // 32 px hit areas (WCAG 2.5.8 needs ≥ 24 px): the arrows were 14 px and page numbers 5 px wide on phones.
  const arrow = 'grid size-8 cursor-pointer place-items-center rounded hover:bg-chip disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent'
  return (
    <nav aria-label="Phân trang" className="flex flex-wrap items-center gap-3 text-[11px] text-muted">
      {summary && <span>{summary}</span>}
      <span className="flex-1" />
      <div className="flex items-center gap-1 text-xs font-medium text-brand">
        <button type="button" aria-label="Trang trước" disabled={page <= 1} onClick={() => onChange(page - 1)} className={arrow}><Icon name="chevron-left" size={14} /></button>
        {shown.map((value, index) => (
          <span key={value} className="flex items-center gap-1">
            {index > 0 && value - shown[index - 1] > 1 && <span aria-hidden="true" className="text-muted">…</span>}
            <button type="button" aria-current={value === page ? 'page' : undefined} onClick={() => onChange(value)} className={cx('grid min-w-8 h-8 cursor-pointer place-items-center rounded px-1 hover:bg-chip', value === page ? 'font-bold text-ink' : '')}>{value}</button>
          </span>
        ))}
        <button type="button" aria-label="Trang sau" disabled={page >= pageCount} onClick={() => onChange(page + 1)} className={arrow}><Icon name="chevron-right" size={14} /></button>
      </div>
    </nav>
  )
}

// Bảng không cuộn ngang: khi khung chứa hẹp hơn ngưỡng, mỗi dòng chuyển thành thẻ xếp dọc
// (nhãn lấy từ tiêu đề cột). Ngưỡng theo container, không theo màn hình.
const STACK = {
  wide: '@max-[720px]:block @max-[720px]:[&_thead]:hidden @max-[720px]:[&_tbody]:block @max-[720px]:[&_tfoot]:block @max-[720px]:[&_tr]:block @max-[720px]:[&_tr]:border-b @max-[720px]:[&_tr]:border-rule @max-[720px]:[&_td]:flex @max-[720px]:[&_td]:items-center @max-[720px]:[&_td]:justify-between @max-[720px]:[&_td]:gap-4 @max-[720px]:[&_td]:border-b-0 @max-[720px]:[&_td]:before:content-[attr(data-label)] @max-[720px]:[&_td]:before:text-[11px] @max-[720px]:[&_td]:before:font-semibold @max-[720px]:[&_td]:before:text-muted @max-[720px]:[&_td:empty]:hidden',
  normal: '@max-[640px]:block @max-[640px]:[&_thead]:hidden @max-[640px]:[&_tbody]:block @max-[640px]:[&_tfoot]:block @max-[640px]:[&_tr]:block @max-[640px]:[&_tr]:border-b @max-[640px]:[&_tr]:border-rule @max-[640px]:[&_td]:flex @max-[640px]:[&_td]:items-center @max-[640px]:[&_td]:justify-between @max-[640px]:[&_td]:gap-4 @max-[640px]:[&_td]:border-b-0 @max-[640px]:[&_td]:before:content-[attr(data-label)] @max-[640px]:[&_td]:before:text-[11px] @max-[640px]:[&_td]:before:font-semibold @max-[640px]:[&_td]:before:text-muted @max-[640px]:[&_td:empty]:hidden',
  // Bảng ít cột, chữ ngắn (vd. "Cần chú ý hôm nay" của Tổng quan): vẫn là bảng tới 480 px, hẹp hơn mới thành thẻ.
  narrow: '@max-[480px]:block @max-[480px]:[&_thead]:hidden @max-[480px]:[&_tbody]:block @max-[480px]:[&_tfoot]:block @max-[480px]:[&_tr]:block @max-[480px]:[&_tr]:border-b @max-[480px]:[&_tr]:border-rule @max-[480px]:[&_td]:flex @max-[480px]:[&_td]:items-center @max-[480px]:[&_td]:justify-between @max-[480px]:[&_td]:gap-4 @max-[480px]:[&_td]:border-b-0 @max-[480px]:[&_td]:before:content-[attr(data-label)] @max-[480px]:[&_td]:before:text-[11px] @max-[480px]:[&_td]:before:font-semibold @max-[480px]:[&_td]:before:text-muted @max-[480px]:[&_td:empty]:hidden',
}

export function Table({ children, wide, narrow, scroll, stack = !scroll, bordered = true, variant = 'default' }: { children: ReactNode; wide?: boolean; narrow?: boolean; scroll?: boolean; stack?: boolean; bordered?: boolean; variant?: 'default' | 'panel' }) {
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
    // relative: nhãn sr-only (position:absolute) trong ô bảng phải nằm trong vùng cuộn, không kéo rộng cả trang trên điện thoại.
    <div className={cx('@container relative bg-white', bordered && (variant === 'panel' ? 'rounded-2xl border border-field' : 'rounded border border-edge'), scroll || wide ? 'overflow-x-auto' : 'overflow-hidden')}>
      <table
        ref={ref}
        className={cx('w-full border-collapse [&_tbody_tr:last-child_td]:border-b-0', scroll && 'min-w-[620px]', stack && STACK[wide ? 'wide' : narrow ? 'narrow' : 'normal'])}
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
