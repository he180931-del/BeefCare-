import { useState, type ChangeEvent } from 'react'
import { Radio } from '../../../components/ui'
import { money } from '../../../data/format'

/** <select> không viền, chỉ hiện chữ + ▾ (ô trong bảng của Figma). Đổi giá trị bằng <select> phủ trong suốt. */
export function GhostSelect({ value, onChange, options, className }: { value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }>; className?: string }) {
  const label = options.find((o) => o.value === value)?.label ?? value
  return (
    <span className={`relative inline-block whitespace-nowrap text-xs ${className || ''}`}>
      {label} <small className="text-[9px]">▾</small>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 size-full cursor-pointer opacity-0">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </span>
  )
}

/** Số tiền dạng chữ trần: hiện "1.500.000 đ", khi bấm vào hiện số thô để sửa. */
export function GhostMoney({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      inputMode="numeric"
      value={focused ? value : `${money(value)} đ`}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(Number(e.target.value.replace(/\D/g, '')) || 0)}
      className="w-full bg-transparent p-0 text-[13px] font-medium text-ink outline-none focus:underline"
    />
  )
}

/** Hàng radio cách nhau 18px. */
export function RadioRow({ name, value, options, onChange }: { name: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <div className="flex flex-wrap gap-[18px]">
      {options.map((o) => (
        <Radio key={o} name={name} checked={value === o} onChange={() => onChange(o)} className="text-[13px]">
          {o}
        </Radio>
      ))}
    </div>
  )
}
