import type { MouseEventHandler, ReactNode } from 'react'
import { Link } from 'react-router-dom'

export function ActionLink({ to, children, state, onClick }: {
  to: string
  children: ReactNode
  state?: unknown
  onClick?: MouseEventHandler<HTMLAnchorElement>
}) {
  return (
    <Link to={to} state={state} onClick={onClick} className="font-bold text-brand underline-offset-4 hover:underline">
      {children}
    </Link>
  )
}
