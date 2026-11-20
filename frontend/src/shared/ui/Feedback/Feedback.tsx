import type { ReactNode } from 'react'
import { Button } from '../Button/Button'
import { cx } from '../cx'
import { Icon } from '../Icon/Icon'

export const LoadingBlock = ({ children = 'Đang tải…' }: { children?: ReactNode }) => (
  <div role="status" className="rounded-md border border-edge bg-white py-10 text-center text-sm text-muted">{children}</div>
)

export function EmptyBlock({ title, sub, action }: { title: ReactNode; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-edge bg-white px-4 py-10 text-center">
      <p className="m-0 text-sm font-semibold text-ink">{title}</p>
      {sub && <p className="m-0 max-w-[520px] text-xs text-muted">{sub}</p>}
      {action}
    </div>
  )
}

export function ErrorBlock({ message, onRetry }: { message: ReactNode; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-md border border-edge bg-white px-4 py-10 text-center">
      <Icon name="alert-triangle" size={24} className="text-err-fg" />
      <p className="m-0 max-w-[520px] text-sm text-err-fg">{message}</p>
      {onRetry && <Button onClick={onRetry}>Thử lại</Button>}
    </div>
  )
}

export const Note = ({ tone = 'grey', children }: { tone?: 'grey' | 'warn' | 'err' | 'ok' | 'info'; children: ReactNode }) => (
  <div
    className={cx(
      'rounded-md px-3 py-2.5 text-xs',
      { grey: 'bg-chip', warn: 'bg-warn-bg text-warn-fg', err: 'bg-err-bg text-err-fg', ok: 'bg-ok-bg text-ok-fg', info: 'bg-[#e8f2fa] text-[#296194]' }[tone],
    )}
  >
    {children}
  </div>
)

export const Foot = ({ children }: { children: ReactNode }) => <p className="m-0 text-[11px] text-subtle">{children}</p>
