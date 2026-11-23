import { useEffect, useRef } from 'react'
import { Icon } from '../../../shared/ui'
import type { AccountDialogTab } from './AccountDialogContext'
import { AccountProfilePanel } from './AccountProfilePanel'
import { RolePermissionsPanel } from './RolePermissionsPanel'

export type AccountDialogProps = {
  active: AccountDialogTab
  onTabChange: (tab: AccountDialogTab) => void
  onClose: () => void
}

export function AccountDialog({ active, onTabChange, onClose }: AccountDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && document.querySelectorAll('[role="dialog"]').length === 1) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  const tabClass = (selected: boolean) => `flex min-w-max items-center gap-2.5 rounded-xl px-3.5 py-3 text-left text-sm font-semibold text-white transition-colors md:w-full ${selected ? 'bg-[#3b8b6d]' : 'hover:bg-white/10'}`

  const trapFocus = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || (event.target as Element).closest('[role="dialog"]') !== event.currentTarget) return
    const focusable = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [href], select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    if (!focusable.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      data-testid="account-dialog-backdrop"
      className="fixed inset-0 z-40 box-border flex items-center justify-center overflow-hidden bg-[rgba(23,37,30,0.26)] p-3 sm:p-6"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <div
        role="dialog"
        ref={dialogRef}
        aria-modal="true"
        aria-label="Cài đặt"
        onKeyDown={trapFocus}
        className="relative flex h-[min(640px,calc(100vh-1.5rem))] w-full max-w-[940px] min-w-0 flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:h-[min(640px,calc(100vh-3rem))]"
      >
        <header data-testid="account-dialog-header" className="flex h-[68px] shrink-0 items-center border-b border-[#dfe6e1] bg-white px-5 sm:px-7">
          <h2 className="m-0 text-xl font-bold tracking-[-0.02em] text-brand-dark">Cài đặt</h2>
          <div className="flex-1" />
          <button autoFocus type="button" aria-label="Đóng cài đặt" onClick={onClose} className="grid size-10 place-items-center rounded-full text-subtle transition hover:bg-[#f1f5f2] hover:text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand/30">
            <Icon name="x" size={20} />
          </button>
        </header>

        <div data-testid="account-dialog-body" className="flex min-h-0 flex-1 flex-col overflow-y-auto md:grid md:grid-cols-[220px_minmax(0,1fr)] md:overflow-hidden">
          <aside className="shrink-0 border-b border-[#216b51] bg-[#2a765b] p-2.5 md:h-full md:border-b-0 md:border-r md:p-3">
            <nav aria-label="Tài khoản" className="flex gap-2 overflow-x-auto md:h-full md:flex-col md:overflow-visible">
              <button type="button" aria-current={active === 'profile' ? 'page' : undefined} onClick={() => onTabChange('profile')} className={tabClass(active === 'profile')}>
                <Icon name="user-circle" size={18} />
                Hồ sơ
              </button>
              <button type="button" aria-current={active === 'permissions' ? 'page' : undefined} onClick={() => onTabChange('permissions')} className={tabClass(active === 'permissions')}>
                <Icon name="shield-lock" size={18} />
                Quyền theo vai trò
              </button>
            </nav>
          </aside>

          <div data-testid="account-dialog-content" className="@container min-w-0 bg-[#fbfbf8] px-4 pb-8 pt-7 sm:px-6 sm:pb-8 sm:pt-8 md:h-full md:min-h-0 md:overflow-y-auto">
            {active === 'profile' ? <AccountProfilePanel /> : <RolePermissionsPanel />}
          </div>
        </div>
      </div>
    </div>
  )
}
