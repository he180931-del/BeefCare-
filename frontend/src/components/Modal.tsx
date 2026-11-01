import { useEffect, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTopbarTitle } from './Layout'
import { Button } from './ui'

/**
 * Modal mở bằng query `?m=<tên>` để test/chụp ảnh trực tiếp (vd /herd-entry/new?m=excel).
 *   const [m, openModal, closeModal] = useModalParam()
 *   {m === 'excel' && <Modal ...onClose={closeModal} />}
 * Các query khác (vd ?tab=) được giữ nguyên.
 */
export function useModalParam() {
  const [params, setParams] = useSearchParams()
  const m = params.get('m')
  const openModal = (name: string) => {
    const next = new URLSearchParams(params)
    next.set('m', name)
    setParams(next)
  }
  const closeModal = () => {
    const next = new URLSearchParams(params)
    next.delete('m')
    setParams(next)
  }
  return [m, openModal, closeModal] as [string | null, (name: string) => void, () => void]
}

const WIDTH: Record<number, string> = { 560: 'w-[560px]', 600: 'w-[600px]', 640: 'w-[640px]', 700: 'w-[700px]', 720: 'w-[720px]', 760: 'w-[760px]', 820: 'w-[820px]', 840: 'w-[840px]', 1040: 'w-[1040px]', 1100: 'w-[1100px]', 1180: 'w-[1180px]', 1200: 'w-[1200px]' }

/**
 * Hộp thoại theo Figma: phủ mờ rgba(20,36,30,.32) toàn màn hình, căn giữa vùng nội dung
 * (bên phải sidebar), bo 10px, padding 24, tiêu đề 20px đậm #183528, phụ đề 12px #67766c.
 * `topTitle`: tiêu đề hiện trên thanh trên khi modal mở (Figma đổi tiêu đề topbar).
 * `width`: 560 | 600 | 640 | 700 | 720 | 760 | 820 | 1100 | 1180 | 1200 (px, theo từng frame Figma).
 * Chân modal: dùng <ModalFooter> (nút cao 46px, bo 12px, căn phải).
 */
export default function Modal({ title, sub, topTitle, width = 600, maxHeight, onClose, top, compact = false, dialogClassName = '', bodyClassName = '', children }: { title: string; sub?: ReactNode; topTitle?: string; width?: number; maxHeight?: string; onClose: () => void; top?: number; compact?: boolean; dialogClassName?: string; bodyClassName?: string; children: ReactNode }) {
  useTopbarTitle(topTitle || title)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 box-border w-full max-w-full overflow-x-hidden overflow-y-auto bg-[rgba(23,37,30,0.32)]" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`pointer-events-none flex min-h-full w-full min-w-0 max-w-full justify-center box-border p-4 ${top ? 'items-start' : 'items-center'}`} style={top ? { paddingTop: top } : undefined}>
        <div role="dialog" aria-modal="true" aria-label={title} style={{ width: `min(${width}px, calc(100vw - 2rem))`, ...(maxHeight ? { maxHeight } : {}) }} className={`pointer-events-auto relative flex max-h-[calc(100vh-1rem)] min-w-0 max-w-full flex-col overflow-x-hidden overflow-y-hidden rounded-lg bg-white p-6 ${WIDTH[width] || WIDTH[600]} ${dialogClassName}`}>
          <button type="button" aria-label="Đóng" onClick={onClose} className="absolute right-6 top-6 size-6 text-[#67766c]">
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M5 5l14 14M19 5L5 19" /></svg>
          </button>
          <div className="sticky top-0 z-10 -mx-6 bg-white px-6 pb-1">
            <h2 className="m-0 pr-10 text-lg font-bold leading-[normal] text-ink">{title}</h2>
            {sub && <p className="m-0 mt-1 text-xs leading-[normal] text-subtle">{sub}</p>}
          </div>
          <div className={`mt-4 min-h-0 min-w-0 overflow-x-hidden overflow-y-auto pb-0 ${compact ? 'max-h-[calc(100vh-8rem)] flex-1' : 'flex-1'} ${bodyClassName}`}>
            <div className="flex min-w-0 flex-col gap-4">{children}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ModalFooter({ children, className = '', compact = false }: { children: ReactNode; className?: string; compact?: boolean }) {
  // Keep actions in normal flow. A sticky/negative-margin footer overlays the
  // last form fields in compact dialogs (especially the vaccination fields).
  return <div className={`flex shrink-0 min-w-0 flex-wrap items-center justify-end gap-2.5 overflow-x-hidden bg-white ${compact ? '!gap-1.5 !px-2 !pt-[0.1875rem] !pb-[max(0.28125rem,env(safe-area-inset-bottom))]' : 'px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4'} ${className}`}>{children}</div>
}

/** Nút trong modal (cao 46px). variant: default | primary | danger | link */
export const ModalButton = ({ variant = 'default', ...p }: { variant?: 'default' | 'primary' | 'danger' | 'link'; children?: ReactNode; onClick?: () => void; disabled?: boolean; className?: string }) => <Button size="lg" variant={variant} {...p} />
