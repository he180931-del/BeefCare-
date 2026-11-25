import { useEffect, type ReactNode } from 'react'
import { Button } from '../Button/Button'
import { cx } from '../cx'
import { useTopbarTitle } from './topbarTitle'

const WIDTH: Record<number, string> = { 560: 'w-[560px]', 600: 'w-[600px]', 620: 'w-[620px]', 640: 'w-[640px]', 700: 'w-[700px]', 720: 'w-[720px]', 760: 'w-[760px]', 820: 'w-[820px]', 840: 'w-[840px]', 1040: 'w-[1040px]', 1100: 'w-[1100px]', 1180: 'w-[1180px]', 1200: 'w-[1200px]' }

/**
 * Hộp thoại theo Figma: phủ mờ rgba(20,36,30,.32) toàn màn hình, căn giữa vùng nội dung
 * (bên phải sidebar), bo 16 px như card Bento (docs/BeefCare-Bento-Grid.md §2), padding 24, tiêu đề 20px đậm #183528, phụ đề 12px #67766c.
 * `topTitle`: tiêu đề hiện trên thanh trên khi modal mở (Figma đổi tiêu đề topbar).
 * `width`: 560 | 600 | 620 | 640 | 700 | 720 | 760 | 820 | 840 | 1040 | 1100 | 1180 | 1200 (px, theo từng frame Figma).
 * Chân modal: dùng <ModalFooter> (nút cao 46px, bo 12px, căn phải).
 */
export default function Modal({ title, sub, topTitle, width = 600, maxHeight, onClose, top, compact = false, dialogClassName = '', bodyClassName = '', footer, children }: { title: string; sub?: ReactNode; topTitle?: string; width?: number; maxHeight?: string; onClose: () => void; top?: number; compact?: boolean; dialogClassName?: string; bodyClassName?: string; footer?: ReactNode; children: ReactNode }) {
  useTopbarTitle(topTitle || title)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 box-border w-full max-w-full overflow-x-hidden overflow-y-auto bg-[rgba(23,37,30,0.32)]" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`pointer-events-none flex min-h-full w-full min-w-0 max-w-full justify-center box-border p-4 ${top ? 'items-start' : 'items-center'}`} style={top ? { paddingTop: top } : undefined}>
        <div role="dialog" aria-modal="true" aria-label={title} style={{ width: `min(${width}px, calc(100vw - 2rem))`, ...(maxHeight ? { maxHeight } : {}) }} className={`pointer-events-auto relative flex max-h-[calc(100vh-1rem)] min-w-0 max-w-full flex-col overflow-x-hidden overflow-y-hidden rounded-2xl bg-white p-6 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] ${WIDTH[width] || WIDTH[600]} ${dialogClassName}`}>
          <button type="button" aria-label="Đóng" onClick={onClose} className="absolute right-3.5 top-3.5 z-20 grid size-11 cursor-pointer place-items-center rounded-lg text-[#67766c] focus-visible:outline-2 focus-visible:outline-brand">
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M5 5l14 14M19 5L5 19" /></svg>
          </button>
          <div className="sticky top-0 z-10 -mx-6 bg-white px-6 pb-1">
            <h2 className="m-0 pr-10 text-lg font-bold leading-[normal] text-ink">{title}</h2>
            {sub && <p className="m-0 mt-1 text-xs leading-[normal] text-subtle">{sub}</p>}
          </div>
          <div className={`mt-4 min-h-0 min-w-0 overflow-x-hidden overflow-y-auto pb-0 ${compact ? 'max-h-[calc(100vh-8rem)] flex-1' : 'flex-1'} ${bodyClassName}`}>
            <div className="flex min-w-0 flex-col gap-4">{children}</div>
          </div>
          {footer && <div className="mt-4 shrink-0">{footer}</div>}
        </div>
      </div>
    </div>
  )
}

export function ModalFooter({ children, className = '' }: { children: ReactNode; className?: string }) {
  // Modal places the outer inset and the content gap. Keep actions in flow so the last field can scroll into view.
  return (
    <div className={cx(
      'flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-2.5 [&>*]:min-w-0 [&>*]:max-w-full',
      '[&_button]:h-auto [&_button]:min-h-[46px] [&_button]:min-w-0 [&_button]:max-w-full [&_button]:whitespace-normal [&_button]:wrap-anywhere [&_button]:py-2 [&_button]:text-center',
      '[&_button]:focus-visible:outline-2 [&_button]:focus-visible:outline-offset-[-3px] [&_button]:focus-visible:outline-current',
      className,
    )}>
      {children}
    </div>
  )
}

/** Nút trong modal (cao 46px). variant: default | primary | danger | link */
export const ModalButton = ({ variant = 'default', ...p }: { variant?: 'default' | 'primary' | 'danger' | 'link'; children?: ReactNode; onClick?: () => void; disabled?: boolean; className?: string }) => <Button size="lg" variant={variant} {...p} />
