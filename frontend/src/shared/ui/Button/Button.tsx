import type { ButtonHTMLAttributes } from 'react'
import { cx } from '../cx'

const BTN = 'inline-flex items-center justify-center gap-1.5 whitespace-nowrap border font-semibold cursor-pointer disabled:cursor-not-allowed disabled:opacity-45'
const BTN_VARIANT: Record<ButtonVariant, string> = {
  default: 'border-edge bg-white text-[#212121]',
  primary: 'border-brand bg-brand text-white',
  danger: 'border-err-fg bg-err-fg text-white',
  link: 'border-transparent bg-transparent text-brand',
  // Nút đặt trên khối nổi bật xanh đậm của Bento (Panel tone="emphasis"): nút chính nền trắng chữ xanh, nút phụ trong
  // suốt viền trắng mờ. Viền focus trắng để nhìn thấy được trên nền tối.
  onDark: 'border-white/30 bg-white/12 text-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
  onDarkPrimary: 'border-white bg-white text-brand hover:bg-ok-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
}

/**
 * variant: default | primary | danger | link | onDark | onDarkPrimary.  size: (mặc định) trang 13px, rounded 4
 * (onDark*: 8 px như docs/BeefCare-Bento-Grid.md §2) · 'sm' 12px · 'lg' = nút modal Figma (cao 46px, rounded 12, 14px,
 * viền #dce6de). `small` = tương thích cũ (giống size="sm").
 */
type ButtonVariant = 'default' | 'primary' | 'danger' | 'link' | 'onDark' | 'onDarkPrimary'
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: ButtonVariant; size?: 'sm' | 'lg'; small?: boolean; block?: boolean }
export function Button({ variant = 'default', size, small, block, className, ...props }: ButtonProps) {
  const lg = size === 'lg'
  const sm = small || size === 'sm'
  const onDark = variant === 'onDark' || variant === 'onDarkPrimary'
  return (
    <button
      type="button"
      className={cx(
        BTN,
        BTN_VARIANT[variant],
        lg ? 'h-[46px] rounded-xl px-4 text-sm' : cx(onDark ? 'rounded-lg' : 'rounded', variant === 'link' ? 'p-1' : 'px-4 py-[9px]', sm ? 'text-xs' : 'text-[13px]'),
        lg && variant === 'default' && 'border-field',
        block && 'w-full',
        className,
      )}
      {...props}
    />
  )
}
