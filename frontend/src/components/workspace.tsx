import { useEffect, useRef, type HTMLAttributes, type ReactNode, type RefObject } from 'react'
import { Button, type BadgeTone } from './ui'

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ')

export function WorkSection({ title, description, actions, children, className, ...props }: {
  title: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string
} & Omit<HTMLAttributes<HTMLElement>, 'title'>) {
  const label = typeof title === 'string' ? title : undefined
  return (
    <section aria-label={label} className={cx('min-w-0 py-4 first:pt-0', className)} {...props}>
      <header className="mb-3 flex min-w-0 flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="m-0 text-base font-bold leading-tight text-ink">{title}</h2>
          {description && <p className="mb-0 mt-1 max-w-3xl text-xs leading-5 text-subtle">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      {children}
    </section>
  )
}

export function FilterBar({ children, actions, className }: { children: ReactNode; actions?: ReactNode; className?: string }) {
  return <div className={cx('mb-4 flex min-w-0 flex-wrap items-end gap-3 border-b border-rule pb-3', className)}><div className="flex min-w-0 flex-1 flex-wrap items-end gap-3">{children}</div>{actions && <div className="flex flex-wrap gap-2">{actions}</div>}</div>
}

export function SummaryStrip({ items, className }: { items: Array<{ label: ReactNode; value: ReactNode; note?: ReactNode }>; className?: string }) {
  return <dl className={cx('m-0 grid grid-cols-2 gap-x-5 gap-y-3 border-y border-rule py-3 md:grid-cols-4', className)}>{items.map((item, index) => <div key={index} className="min-w-0 border-l-2 border-field pl-3 first:border-brand"><dt className="text-xs text-subtle">{item.label}</dt><dd className="m-0 mt-0.5 text-lg font-bold leading-tight text-ink">{item.value}</dd>{item.note && <span className="mt-1 block text-xs text-muted">{item.note}</span>}</div>)}</dl>
}

const MESSAGE_STYLE: Record<BadgeTone | 'neutral', string> = {
  ok: 'border-ok-fg/25 bg-ok-bg text-ok-fg', err: 'border-err-fg/25 bg-err-bg text-err-fg', warn: 'border-warn-fg/25 bg-warn-bg text-warn-fg', info: 'border-[#296194]/25 bg-[#e8f2fa] text-[#296194]', outline: 'border-edge bg-white text-ink', neutral: 'border-rule bg-page text-subtle',
}

export function InlineMessage({ tone = 'neutral', title, children, className }: { tone?: BadgeTone | 'neutral'; title?: ReactNode; children: ReactNode; className?: string }) {
  return <div role={tone === 'err' ? 'alert' : 'status'} className={cx('border-l-[3px] px-3 py-2 text-xs leading-5', MESSAGE_STYLE[tone], className)}>{title && <strong className="mr-1.5 font-semibold">{title}</strong>}{children}</div>
}

export function EmptyState({ title, description, actionLabel, onAction, compact = false }: { title: ReactNode; description?: ReactNode; actionLabel?: string; onAction?: () => void; compact?: boolean }) {
  return <div className={cx('flex flex-col items-start border-y border-dashed border-edge text-left', compact ? 'gap-2 py-5' : 'gap-3 py-10')}><div aria-hidden="true" className="grid size-9 place-items-center rounded-full bg-ok-bg font-bold text-brand">+</div><div><h3 className="m-0 text-sm font-semibold text-ink">{title}</h3>{description && <p className="mb-0 mt-1 max-w-xl text-xs leading-5 text-subtle">{description}</p>}</div>{actionLabel && onAction && <Button onClick={onAction}>{actionLabel}</Button>}</div>
}

export function LoadingState({ label = 'Đang tải dữ liệu…', rows = 4 }: { label?: string; rows?: number }) {
  return <div role="status" aria-label={label} className="space-y-3 border-y border-rule py-5"><span className="text-xs font-medium text-subtle">{label}</span>{Array.from({ length: rows }, (_, index) => <div key={index} className="h-3 animate-pulse bg-chip" style={{ width: `${96 - index * 7}%` }} />)}</div>
}

export function StickyActions({ message, actions, className }: { message?: ReactNode; actions: ReactNode; className?: string }) {
  return <footer className={cx('sticky bottom-0 z-20 mt-4 flex min-w-0 flex-wrap items-center gap-3 border-t border-rule bg-white/95 px-0 py-2 backdrop-blur-sm', className)}><div className="min-w-0 flex-1 text-xs font-medium text-warn-fg">{message}</div><div aria-label="Hành động" className="flex flex-wrap items-center justify-end gap-2">{actions}</div></footer>
}

export function ActionDialog({
  open,
  title,
  description,
  children,
  error,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  confirmTone = 'primary',
  confirmDisabled = false,
  returnFocusRef,
  onCancel,
  onConfirm,
}: {
  open: boolean
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  error?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  confirmTone?: 'primary' | 'danger'
  confirmDisabled?: boolean
  returnFocusRef?: RefObject<HTMLElement | null>
  onCancel: () => void
  onConfirm: () => void
}) {
  const dialogRef = useRef<HTMLElement>(null)
  const lastPageFocusRef = useRef<HTMLElement | null>(null)
  const onCancelRef = useRef(onCancel)
  useEffect(() => { onCancelRef.current = onCancel }, [onCancel])
  useEffect(() => {
    const rememberTarget = (event: Event) => {
      const target = event.target instanceof HTMLElement ? event.target : null
      const interactive = target?.closest<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
      if (interactive && !dialogRef.current?.contains(interactive)) lastPageFocusRef.current = interactive
    }
    document.addEventListener('focusin', rememberTarget, true)
    document.addEventListener('pointerdown', rememberTarget, true)
    document.addEventListener('click', rememberTarget, true)
    return () => {
      document.removeEventListener('focusin', rememberTarget, true)
      document.removeEventListener('pointerdown', rememberTarget, true)
      document.removeEventListener('click', rememberTarget, true)
    }
  }, [])
  useEffect(() => {
    if (!open) return
    const active = document.activeElement instanceof HTMLElement && document.activeElement !== document.body && !dialogRef.current?.contains(document.activeElement) ? document.activeElement : null
    const opener = returnFocusRef?.current || active || lastPageFocusRef.current
    const openerText = opener?.textContent?.trim()
    const focusable = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') || [])
    requestAnimationFrame(() => (focusable()[0] || dialogRef.current)?.focus())
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancelRef.current()
        requestAnimationFrame(() => {
          if (opener?.isConnected) opener.focus()
        })
        return
      }
      if (event.key !== 'Tab') return
      const items = focusable()
      if (!items.length) { event.preventDefault(); dialogRef.current?.focus(); return }
      const first = items[0]; const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      requestAnimationFrame(() => {
        if (opener?.isConnected) { opener.focus(); return }
        const fallback = Array.from(document.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])')).find((candidate) => candidate.textContent?.trim() === openerText)
        fallback?.focus()
      })
    }
  }, [open, returnFocusRef])
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-ink/45 p-3 sm:p-4 md:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel() }}>
      <section
        ref={dialogRef}
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby="action-dialog-title"
        role="dialog"
        className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden overscroll-contain rounded-lg border border-edge bg-white shadow-xl sm:max-h-[calc(100dvh-2rem)] md:max-h-[calc(100dvh-3rem)]"
      >
        <header className="shrink-0 border-b border-rule px-4 py-3 sm:px-5 md:px-6">
          <h2 id="action-dialog-title" className="m-0 text-lg font-bold leading-tight text-ink">{title}</h2>
          {description && <p className="mb-0 mt-1 max-w-3xl text-sm leading-5 text-subtle">{description}</p>}
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5 md:px-6 md:py-4">
          {children}
          {error && <InlineMessage className="mt-4" tone="err" title="Chưa thể tiếp tục">{error}</InlineMessage>}
        </div>
        <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-rule bg-white px-4 py-2.5 sm:px-5 md:px-6">
          <Button onClick={onCancel}>{cancelLabel}</Button>
          <Button variant={confirmTone === 'danger' ? 'danger' : 'primary'} disabled={confirmDisabled} onClick={onConfirm}>{confirmLabel}</Button>
        </footer>
      </section>
    </div>
  )
}

export function FixtureNotice({ className = '' }: { className?: string }) {
  return (
    <span className={`text-xs font-medium text-subtle ${className}`.trim()}>
      Bản xem trước · dữ liệu cục bộ
    </span>
  )
}
