import type { ButtonHTMLAttributes } from 'react'
import { cx } from '../cx'

const BTN = 'inline-flex items-center justify-center gap-1.5 border font-semibold cursor-pointer disabled:cursor-not-allowed disabled:opacity-45'
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
 * viền #dce6de) · 'bento' = nút thao tác của trang đã chuyển sang Bento (cao tối thiểu 44 px cho vùng chạm, bo 8 px,
 * 13px, chữ dài xuống dòng thay vì tràn). `small` = tương thích cũ (giống size="sm").
 */
type ButtonVariant = 'default' | 'primary' | 'danger' | 'link' | 'onDark' | 'onDarkPrimary'
type ButtonSize = 'sm' | 'lg' | 'bento'
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: ButtonVariant; size?: ButtonSize; small?: boolean; block?: boolean }

function sizeClass(size: ButtonSize | undefined, small: boolean | undefined, variant: ButtonVariant) {
  if (size === 'lg') return 'h-[46px] whitespace-nowrap rounded-xl px-4 text-sm'
  if (size === 'bento') return 'min-h-11 rounded-lg px-4 py-2 text-center text-[13px] whitespace-normal'
  const onDark = variant === 'onDark' || variant === 'onDarkPrimary'
  return cx('whitespace-nowrap', onDark ? 'rounded-lg' : 'rounded', variant === 'link' ? 'p-1' : 'px-4 py-[9px]', small || size === 'sm' ? 'text-xs' : 'text-[13px]')
}

export function Button({ variant = 'default', size, small, block, className, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={cx(
        BTN,
        BTN_VARIANT[variant],
        sizeClass(size, small, variant),
        (size === 'lg' || size === 'bento') && variant === 'default' && 'border-field',
        block && 'w-full',
        className,
      )}
      {...props}
    />
  )
}
