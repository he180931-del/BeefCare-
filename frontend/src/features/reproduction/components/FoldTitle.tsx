import { Icon } from '../../../shared/ui'

/**
 * Tiêu đề khối gập của tab Sinh sản (D79): nút mang tên khối, mũi tên xoay khi mở. Khối gập luôn kèm một dòng tóm tắt
 * để thông tin hay dùng vẫn thấy ngay.
 */
export default function FoldTitle({ title, open, onToggle }: { title: string; open: boolean; onToggle: () => void }) {
  return (
    <button type="button" aria-expanded={open} onClick={onToggle} className="flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-ink">
      {title}
      <Icon name="chevron-down" size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
  )
}
