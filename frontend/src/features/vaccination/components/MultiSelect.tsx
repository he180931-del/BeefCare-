import { useState } from 'react'
import { Icon } from '../../../components/Icon'
import { Checkbox, inputCls } from '../../../components/ui'

/** Ô chọn nhiều giá trị: nút hiện các nhãn đã chọn, bấm mở danh sách có ô tick. */
export default function MultiSelect<T extends string>({ id, label, options, value, onChange }: { id: string; label: string; options: Array<{ value: T; label: string }>; value: T[]; onChange: (next: T[]) => void }) {
  const [open, setOpen] = useState(false)
  const text = value.length ? options.filter((o) => value.includes(o.value)).map((o) => o.label.split(' – ')[0]).join(', ') : 'Tất cả'
  const toggle = (v: T) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])
  return (
    <div className="relative">
      <button id={id} type="button" aria-label={label} aria-expanded={open} onClick={() => setOpen(!open)} className={`${inputCls} flex items-center justify-between gap-2 text-left`}>
        <span className="truncate">{text}</span>
        <Icon name="chevron-down" size={16} />
      </button>
      {open && (
        <>
          <button type="button" aria-label="Đóng danh sách" className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
          <div role="group" aria-label={label} className="absolute left-0 right-0 z-20 mt-1 flex max-h-64 flex-col gap-2 overflow-y-auto rounded-xl border border-field bg-white p-3 shadow-lg">
            {options.map((o) => <Checkbox key={o.value} checked={value.includes(o.value)} onChange={() => toggle(o.value)}>{o.label}</Checkbox>)}
          </div>
        </>
      )}
    </div>
  )
}
