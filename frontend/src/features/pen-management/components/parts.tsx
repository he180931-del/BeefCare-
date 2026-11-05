import type { ReactNode } from 'react'

export const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ')
// Khoảng cách cột 8px như Figma (dùng cho cả Th lẫn Td)
export const TH = '!px-1 first:!pl-3 last:!pr-3'

/** Phân đoạn quản lý chuồng: chỉ dùng đường chia để màn danh sách thoáng hơn. */
export const Box = ({ className, children }: { className?: string; children: ReactNode }) => (
  <section className={cx('flex flex-col gap-[14px] border-y border-rule p-4', className)}>{children}</section>
)
