import type { InputHTMLAttributes, ReactNode } from 'react'
import { inputCls } from '../../../shared/ui'

export const FieldError = ({ children }: { children?: ReactNode }) =>
  children ? <p role="alert" className="m-0 text-[11px] text-err-fg">{children}</p> : null

/**
 * Ô nhập số có đơn vị ở bên phải (kg, cm). Là ô chữ bàn phím số (D51): ô số của trình duyệt xóa chữ gõ sai thành
 * trống, khiến lỗi bị bỏ qua âm thầm; ô chữ giữ nguyên để bước kiểm tra báo dưới ô.
 */
export function UnitInput({ unit, className = '', ...props }: { unit: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <input type="text" inputMode="decimal" className={`${inputCls} pr-10 ${className}`} {...props} />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">{unit}</span>
    </div>
  )
}

/**
 * Đọc ô số thập phân một cách nghiêm (D51): để trống → undefined (không nhập); "325", "325,5", "325.5" → số;
 * gõ sai (chữ, ký tự lạ, nhiều dấu phẩy) → NaN để bước kiểm tra báo lỗi dưới ô thay vì coi như chưa nhập.
 */
export const parseNum = (s: string): number | undefined => {
  const t = s.trim()
  if (!t) return undefined
  return /^\d+([.,]\d+)?$/.test(t) ? Number(t.replace(',', '.')) : Number.NaN
}
