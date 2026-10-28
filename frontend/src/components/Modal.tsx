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

const WIDTH: Record<number, string> = { 560: 'w-[560px]', 600: 'w-[600px]', 640: 'w-[640px]', 700: 'w-[700px]', 720: 'w-[720px]', 760: 'w-[760px]', 820: 'w-[820px]' }

/**
 * Hộp thoại theo Figma: phủ mờ rgba(20,36,30,.32) toàn màn hình, căn giữa vùng nội dung
 * (bên phải sidebar), bo 10px, padding 24, tiêu đề 20px đậm #183528, phụ đề 12px #67766c.
 * `topTitle`: tiêu đề hiện trên thanh trên khi modal mở (Figma đổi tiêu đề topbar).
 * `width`: 560 | 600 | 640 | 700 | 720 | 760 | 820 (px, theo từng frame Figma).
 * Chân modal: dùng <ModalFooter> (nút cao 46px, bo 12px, căn phải).
 */
export default function Modal({ title, sub, topTitle, width = 600, onClose, top, children }: { title: string; sub?: ReactNode; topTitle?: string; width?: number; onClose: () => void; top?: number; children: ReactNode }) {
  useTopbarTitle(topTitle || title)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-[rgba(23,37,30,0.32)]" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`pointer-events-none flex min-h-full justify-center p-4 lg:pl-[calc(264px+1rem)] ${top ? 'items-start' : 'items-center'}`} style={top ? { paddingTop: top } : undefined}>
        <div role="dialog" aria-modal="true" aria-label={title} className={`pointer-events-auto relative max-w-full rounded-lg bg-white p-6 ${WIDTH[width] || WIDTH[600]}`}>
          <button type="button" aria-label="Đóng" onClick={onClose} className="absolute right-6 top-6 size-6 text-[#67766c]">
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M5 5l14 14M19 5L5 19" /></svg>
          </button>
          <h2 className="m-0 pr-10 text-lg font-bold leading-[normal] text-ink">{title}</h2>
          {sub && <p className="m-0 mt-1 text-xs leading-[normal] text-subtle">{sub}</p>}
          <div className="mt-4 flex flex-col gap-4">{children}</div>
        </div>
      </div>
    </div>
  )
}

export function ModalFooter({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">{children}</div>
}

/** Nút trong modal (cao 46px). variant: default | primary | danger | link */
export const ModalButton = ({ variant = 'default', ...p }: { variant?: 'default' | 'primary' | 'danger' | 'link'; children?: ReactNode; onClick?: () => void; disabled?: boolean; className?: string }) => <Button size="lg" variant={variant} {...p} />
