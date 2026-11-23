import type { ReactNode } from 'react'
import { Button } from '../Button/Button'
import { cx } from '../cx'
import { Icon } from '../Icon/Icon'

type FeedbackVariant = 'default' | 'panel'
const FRAME: Record<FeedbackVariant, string> = {
  default: 'rounded-md border-edge',
  panel: 'rounded-2xl border-field',
}

export const LoadingBlock = ({ children = 'Đang tải…', variant = 'default' }: { children?: ReactNode; variant?: FeedbackVariant }) => (
  <div role="status" className={cx('border bg-white py-10 text-center text-sm text-muted', FRAME[variant])}>{children}</div>
)

export function EmptyBlock({ title, sub, action, variant = 'default' }: { title: ReactNode; sub?: ReactNode; action?: ReactNode; variant?: FeedbackVariant }) {
  return (
    <div className={cx('flex flex-col items-center gap-2 border bg-white px-4 py-10 text-center', FRAME[variant])}>
      <p className="m-0 text-sm font-semibold text-ink">{title}</p>
      {sub && <p className="m-0 max-w-[520px] text-xs text-muted">{sub}</p>}
      {action}
    </div>
  )
}

export function ErrorBlock({ message, onRetry, variant = 'default' }: { message: ReactNode; onRetry?: () => void; variant?: FeedbackVariant }) {
  return (
    <div role="alert" className={cx('flex flex-col items-center gap-3 border bg-white px-4 py-10 text-center', FRAME[variant])}>
      <Icon name="alert-triangle" size={24} className="text-err-fg" />
      <p className="m-0 max-w-[520px] text-sm text-err-fg">{message}</p>
      {onRetry && <Button size={variant === 'panel' ? 'bento' : undefined} onClick={onRetry}>Thử lại</Button>}
    </div>
  )
}

export const Note = ({ tone = 'grey', children }: { tone?: 'grey' | 'warn' | 'err' | 'ok' | 'info'; children: ReactNode }) => (
  <div
    className={cx(
      'rounded-md px-3 py-2.5 text-xs',
      // grey đặt màu chữ riêng: trong khối xanh đậm (Panel emphasis) chữ kế thừa màu trắng, không đọc được trên nền xám.
      { grey: 'bg-chip text-ink', warn: 'bg-warn-bg text-warn-fg', err: 'bg-err-bg text-err-fg', ok: 'bg-ok-bg text-ok-fg', info: 'bg-[#e8f2fa] text-[#296194]' }[tone],
    )}
  >
    {children}
  </div>
)

export const Foot = ({ children }: { children: ReactNode }) => <p className="m-0 text-[11px] text-subtle">{children}</p>
