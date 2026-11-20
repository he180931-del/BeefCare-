import type { ReactNode } from 'react'
import { cx } from '../cx'
import { Icon, type IconName } from '../Icon/Icon'

const BADGE_TONE = {
  ok: 'border-ok-bg bg-ok-bg text-ok-fg',
  err: 'border-err-bg bg-err-bg text-err-fg',
  warn: 'border-warn-bg bg-warn-bg text-warn-fg',
  info: 'border-[#e8f2fa] bg-[#e8f2fa] text-[#296194]',
  outline: 'border-edge bg-white text-[#212121]',
}

/** tone: ok | err | warn | info | outline | (mặc định xám). Chữ 10px, bo 10px. `icon`: icon 12px đứng trước chữ như Figma. */
export type BadgeTone = 'ok' | 'err' | 'warn' | 'info' | 'outline'
export function Badge({ tone, icon, className, children }: { tone?: BadgeTone; icon?: IconName; className?: string; children?: ReactNode }) {
  return (
    <span className={cx('whitespace-nowrap rounded-[10px] border px-2 py-[3px] text-[10px] font-medium', icon ? 'inline-flex items-center gap-1' : 'inline-block', tone ? BADGE_TONE[tone] : undefined, tone ? undefined : 'border-edge bg-chip text-[#212121]', className)}>
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  )
}
