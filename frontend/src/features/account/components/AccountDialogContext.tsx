import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSession } from '../../../app/session/sessionContext'
import { AccountDialog } from './AccountDialog'

export type AccountDialogTab = 'profile' | 'permissions'

type AccountDialogController = {
  openAccountDialog: (tab?: AccountDialogTab) => void
  closeAccountDialog: () => void
}

const NOOP_CONTROLLER: AccountDialogController = {
  openAccountDialog: () => undefined,
  closeAccountDialog: () => undefined,
}

const AccountDialogContext = createContext<AccountDialogController>(NOOP_CONTROLLER)

export function AccountDialogProvider({ children }: { children: ReactNode }) {
  const session = useSession()
  const [search] = useSearchParams()
  const [active, setActive] = useState<AccountDialogTab | null>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (session && ['ho-so', 'doi-mat-khau'].includes(search.get('m') ?? '')) setActive('profile')
  }, [search, session])

  const controller = useMemo<AccountDialogController>(() => ({
    openAccountDialog: (tab = 'profile') => {
      if (!session) return
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      setActive(tab)
    },
    closeAccountDialog: () => {
      setActive(null)
      window.setTimeout(() => {
        const target = returnFocusRef.current?.isConnected
          ? returnFocusRef.current
          : document.querySelector<HTMLElement>('[data-account-menu-trigger="true"]')
        target?.focus()
      }, 0)
    },
  }), [session])

  return (
    <AccountDialogContext.Provider value={controller}>
      {children}
      {session && active && (
        <AccountDialog active={active} onTabChange={setActive} onClose={controller.closeAccountDialog} />
      )}
    </AccountDialogContext.Provider>
  )
}

export const useAccountDialog = () => useContext(AccountDialogContext)
