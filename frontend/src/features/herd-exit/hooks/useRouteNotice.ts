import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

export type RouteNoticeState = { notice?: string }

/**
 * Success text handed over by `navigate(to, { state: { notice } })` (SCR-43 → SCR-76 / SCR-41). It is shown once: the
 * history entry is replaced without the state, so a reload or Back does not show it again.
 */
export function useRouteNotice(): [string, (notice: string) => void] {
  const location = useLocation()
  const nav = useNavigate()
  const incoming = (location.state as RouteNoticeState | null)?.notice ?? ''
  const [notice, setNotice] = useState(incoming)
  useEffect(() => {
    if (!incoming) return
    setNotice(incoming)
    nav(`${location.pathname}${location.search}`, { replace: true, state: null })
  }, [incoming, location.pathname, location.search, nav])
  return [notice, setNotice]
}
