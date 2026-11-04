import type { ReactNode } from 'react'

export function ConditionalField({ active, children }: { active: boolean; children: ReactNode }) {
  if (!active) return null
  return <div className="min-w-0 border-l-2 border-brand pl-3">{children}</div>
}
