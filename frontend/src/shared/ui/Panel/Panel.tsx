import { useId, type ReactNode } from 'react'
import { cx } from '../cx'

export type PanelTone = 'default' | 'emphasis' | 'ok' | 'warn' | 'err'

/**
 * Bề mặt khối của bố cục Bento (docs/BeefCare-Bento-Grid.md §2–3): bo 16 px, padding 16 px, 24 px khi vùng chứa
 * (`@container` gần nhất) từ 1.024 px. `emphasis` là khối nổi bật duy nhất của màn: nền xanh đậm, chữ trắng.
 * `warn` (vàng nhạt) cho việc sắp đến hạn/cần chú ý, `err` (đỏ nhạt) cho lỗi/quá hạn/đang điều trị, `ok` (xanh nhạt) cho
 * trạng thái tích cực; màu luôn đi kèm nhãn chữ trong khối và chỉ dùng khi dữ liệu hiện tại đúng là như vậy.
 */
export const PANEL_SURFACE: Record<PanelTone, string> = {
  default: 'min-w-0 rounded-2xl border border-field bg-white p-4 text-ink @min-[1024px]:p-6',
  emphasis: 'min-w-0 rounded-2xl border border-brand-dark bg-brand-dark p-4 text-white @min-[1024px]:p-6',
  ok: 'min-w-0 rounded-2xl border border-ok-bg bg-ok-bg p-4 text-ink @min-[1024px]:p-6',
  warn: 'min-w-0 rounded-2xl border border-warn-bg bg-warn-bg p-4 text-ink @min-[1024px]:p-6',
  err: 'min-w-0 rounded-2xl border border-err-bg bg-err-bg p-4 text-ink @min-[1024px]:p-6',
}

/** Màu dòng phụ dưới tiêu đề: #5b6a60 đạt ≥ 4,9:1 trên cả nền trắng lẫn hai nền nhạt. */
const SUB_TEXT: Record<PanelTone, string> = {
  default: 'text-muted',
  emphasis: 'text-side-text',
  ok: 'text-[#5b6a60]',
  warn: 'text-[#5b6a60]',
  err: 'text-[#5b6a60]',
}

/** Khối có tiêu đề h2 (nhãn của vùng), dòng phụ và hành động ở góc phải. */
export function Panel({ title, sub, actions, tone = 'default', className, children }: {
  title?: ReactNode
  sub?: ReactNode
  actions?: ReactNode
  tone?: PanelTone
  className?: string
  children: ReactNode
}) {
  const titleId = useId()
  return (
    <section aria-labelledby={title ? titleId : undefined} className={cx(PANEL_SURFACE[tone], 'flex flex-col gap-3', className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          {title && (
            <div className="min-w-0">
              <h2 id={titleId} className="m-0 text-lg font-bold">{title}</h2>
              {sub && <p className={cx('mb-0 mt-1 text-xs', SUB_TEXT[tone])}>{sub}</p>}
            </div>
          )}
          {actions}
        </div>
      )}
      {children}
    </section>
  )
}
