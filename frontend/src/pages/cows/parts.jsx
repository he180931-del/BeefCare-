import { Th as UiTh, Td as UiTd } from '../../components/ui'

const cx = (...c) => c.filter(Boolean).join(' ')

// Nhãn trạng thái không viền (Figma); tone grey có viền xám.
const CHIP_TONE = {
  ok: 'bg-ok-bg text-ok-fg',
  err: 'bg-err-bg text-err-fg',
  warn: 'bg-warn-bg text-warn-fg',
  info: 'bg-[#e8f2fa] text-[#296194]',
  grey: 'border border-edge bg-white text-[#212121]',
}
export function Chip({ tone = 'grey', className, children }) {
  return (
    <span className={cx('inline-block whitespace-nowrap rounded-[10px] px-2 py-[2px] text-[11px] font-medium', CHIP_TONE[tone], className)}>
      {children}
    </span>
  )
}

/** Phân đoạn: chỉ tab đang chọn có viền (Figma). */
export function Seg({ options, value, onChange }) {
  return (
    <div className="inline-flex max-w-full flex-wrap gap-[3px] rounded-[5px] bg-chip p-[3px]">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cx(
            'cursor-pointer rounded border px-3.5 py-[7px] text-xs leading-[normal]',
            v === value ? 'border-faint bg-white font-semibold text-[#212121]' : 'border-transparent text-muted',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

/** Thẻ nội dung: viền xám, bo 6, tiêu đề 14px đậm. `gap` đổi theo thẻ theo Figma. */
export function Panel({ title, action, gap = 'gap-3', pad = 'p-4', className, children }) {
  return (
    <section className={cx('flex flex-col rounded-md border border-edge bg-white', pad, gap, className)}>
      {(title || action) && (
        <div className="flex flex-wrap items-center gap-3">
          {title && <h3 className="m-0 text-sm font-semibold text-[#212121]">{title}</h3>}
          <div className="flex-1" />
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

/** Lưới nhãn/giá trị: nhãn 11px #8f8f8f, giá trị 13px medium. */
export function Fields({ items, cols = 'grid-cols-2 sm:grid-cols-4', gap = 'gap-x-4 gap-y-3', className }) {
  return (
    <dl className={cx('m-0 grid', cols, gap, className)}>
      {items.map(([k, v, extra]) => (
        <div key={k} className="min-w-0">
          <dt className="mb-[3px] text-[11px] text-faint">{k}</dt>
          <dd className="m-0 break-words text-[13px] font-medium text-[#212121]">
            {v || '—'}
            {extra}
          </dd>
        </div>
      ))}
    </dl>
  )
}

// Th/Td theo Figma: lề trong 4px, chữ 11px/12px.
export const Th = ({ className, ...p }) => <UiTh className={cx('!px-1', className)} {...p} />
export const Td = ({ className, ...p }) => <UiTd className={cx('!px-1 !text-[12px] !leading-[normal]', className)} {...p} />

/** Ô nhập theo Figma trong modal: cao 44, chữ 14px, không dãn dòng. */
export const fieldCls = 'w-full rounded-xl border border-field bg-white px-2.5 py-3 text-sm text-ink !leading-[normal] outline-none focus:border-brand read-only:bg-[#f7faf7] read-only:text-muted'
