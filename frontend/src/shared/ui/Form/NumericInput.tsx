import { useEffect, useState, type InputHTMLAttributes } from 'react'
import { inputCls } from './Form'
import { cx } from '../cx'
import { money } from '../../lib/format'

export const parseMoney = (value: string) => Number(String(value).replace(/\D/g, '')) || 0

type NumericProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>

/** Keep incomplete decimal text while typing; business validators own min/max. */
export function NumberInput({ value, onChange, decimals = 2, className, ...props }: NumericProps & {
  value: number | null; onChange: (value: number | null) => void; decimals?: number
}) {
  const [text, setText] = useState(value == null || value === 0 ? '' : String(value))
  useEffect(() => {
    setText(current => (current === '' ? null : Number(current)) === value || (current === '' && value === 0)
      ? current : value == null || value === 0 ? '' : String(value))
  }, [value])
  return <input {...props} type="text" inputMode={decimals === 0 ? 'numeric' : 'decimal'} placeholder={props.placeholder ?? '0'} className={className ?? inputCls} value={text}
    onChange={event => {
      let next = event.target.value.replace(',', '.')
      if (!/^\d*(\.\d*)?$/.test(next) || (decimals === 0 && next.includes('.')) || (next.split('.')[1]?.length ?? 0) > decimals) return
      if (next.startsWith('.')) next = `0${next}`
      next = next.replace(/^0+(?=\d)/, '')
      setText(next)
      onChange(next === '' ? null : Number(next))
    }} />
}

/** Raw digits on focus preserve the caret; group thousands only on blur. */
export function MoneyInput({ value, onChange, suffix, className, inputClassName, formatWhileTyping = false, ...props }: NumericProps & {
  value: number; onChange: (value: number) => void; suffix?: string; inputClassName?: string; formatWhileTyping?: boolean
}) {
  const [focused, setFocused] = useState(false)
  const [text, setText] = useState(value ? value.toLocaleString('vi-VN') : '')
  useEffect(() => {
    setText(current => parseMoney(current) === value ? current : value ? (focused ? String(value) : value.toLocaleString('vi-VN')) : '')
  }, [value, focused])
  return <div className={cx('relative', className)}>
    <input {...props} type="text" inputMode="numeric" placeholder={props.placeholder ?? '0'} value={formatWhileTyping ? money(value) : text}
      className={cx(inputClassName ?? inputCls, suffix && 'pr-8')}
      onFocus={event => {
        if (!formatWhileTyping) { setFocused(true); setText(value ? String(value) : '') }
        props.onFocus?.(event)
      }}
      onBlur={event => {
        if (!formatWhileTyping) { setFocused(false); setText(value ? money(value) : '') }
        props.onBlur?.(event)
      }}
      onChange={event => {
        const next = event.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '')
        if (!formatWhileTyping) setText(next)
        onChange(parseMoney(next))
      }} />
    {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">{suffix}</span>}
  </div>
}
