import type { InputHTMLAttributes, ReactNode } from 'react'
import { inputCls } from '../../../components/ui'

export const FieldError = ({ children }: { children?: ReactNode }) =>
  children ? <p role="alert" className="m-0 text-[11px] text-err-fg">{children}</p> : null

/** Ô nhập số có đơn vị ở bên phải (kg, cm). */
export function UnitInput({ unit, className = '', ...props }: { unit: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <input type="number" step="any" className={`${inputCls} pr-10 ${className}`} {...props} />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">{unit}</span>
    </div>
  )
}

export const parseNum = (s: string): number | undefined => {
  const t = s.trim()
  if (!t) return undefined
  const n = Number(t.replace(',', '.'))
  return Number.isNaN(n) ? undefined : n
}
