import type { ReactNode } from 'react'
import { cx } from '../cx'

export function Segmented({ options, value, onChange, className }: { options: Array<{ value: string; label: ReactNode; disabled?: boolean }>; value: string; onChange: (value: string) => void; className?: string }) {
  return (
    <div className={cx('inline-flex max-w-full flex-wrap gap-[3px] rounded-[5px] bg-chip p-[3px]', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={o.disabled}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            'cursor-pointer whitespace-nowrap rounded px-3.5 py-[7px] text-xs border disabled:cursor-not-allowed disabled:opacity-50',
            o.value === value ? 'border-faint bg-white font-semibold text-[#212121]' : 'border-transparent text-muted',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Tab gạch chân (hồ sơ bò): tab = [{value,label}]. Chọn = đậm + gạch 3px xanh. */
export function Tabs({ tabs, value, onChange }: { tabs: Array<{ value: string; label: ReactNode }>; value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex flex-wrap gap-x-0 border-b-0">
      {tabs.map((t) => (
        <button key={t.value} type="button" onClick={() => onChange(t.value)} className="cursor-pointer px-3.5 pb-1.5 pt-1 text-sm">
          <span className={cx('inline-block pb-1.5', t.value === value ? 'border-b-[3px] border-brand font-semibold text-[#212121]' : 'border-b-[3px] border-transparent text-muted')}>{t.label}</span>
        </button>
      ))}
    </div>
  )
}
