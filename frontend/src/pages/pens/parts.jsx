export const cx = (...c) => c.filter(Boolean).join(' ')
// Khoảng cách cột 8px như Figma (dùng cho cả Th lẫn Td)
export const TH = '!px-1 first:!pl-3 last:!pr-3'

/** Thẻ Figma: viền #bdbdbd, bo 6, padding 16, gap 14 giữa các khối. */
export const Box = ({ className, children }) => (
  <section className={cx('flex flex-col gap-[14px] rounded-md border border-[#bdbdbd] bg-white p-4', className)}>{children}</section>
)
