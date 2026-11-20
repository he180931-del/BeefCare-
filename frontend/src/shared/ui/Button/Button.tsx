import type { ButtonHTMLAttributes } from 'react'
import { cx } from '../cx'

const BTN = 'inline-flex items-center justify-center gap-1.5 whitespace-nowrap border font-semibold cursor-pointer disabled:cursor-not-allowed disabled:opacity-45'
const BTN_VARIANT: Record<ButtonVariant, string> = {
  default: 'border-edge bg-white text-[#212121]',
  primary: 'border-brand bg-brand text-white',
  danger: 'border-err-fg bg-err-fg text-white',
  link: 'border-transparent bg-transparent text-brand',
}

/**
 * variant: default | primary | danger | link.  size: (mặc định) trang 13px, rounded 4 · 'sm' 12px · 'lg' = nút modal Figma
 * (cao 46px, rounded 12, 14px, viền #dce6de). `small` = tương thích cũ (giống size="sm").
 */
type ButtonVariant = 'default' | 'primary' | 'danger' | 'link'
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: ButtonVariant; size?: 'sm' | 'lg'; small?: boolean; block?: boolean }
export function Button({ variant = 'default', size, small, block, className, ...props }: ButtonProps) {
  const lg = size === 'lg'
  const sm = small || size === 'sm'
  return (
    <button
      type="button"
      className={cx(
        BTN,
        BTN_VARIANT[variant],
        lg ? 'h-[46px] rounded-xl px-4 text-sm' : cx('rounded', variant === 'link' ? 'p-1' : 'px-4 py-[9px]', sm ? 'text-xs' : 'text-[13px]'),
        lg && variant === 'default' && 'border-field',
        block && 'w-full',
        className,
      )}
      {...props}
    />
  )
}
