import type { ReactNode } from 'react'

export function PageHeader({ title, sub, badge, children }: { title: ReactNode; sub?: ReactNode; badge?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div>
        <h1 className="m-0 text-[22px] font-bold">{title}</h1>
        {sub && <p className="mb-0 mt-1 max-w-[700px] text-xs text-muted">{sub}</p>}
        {badge && <div className="mt-1">{badge}</div>}
      </div>
      <div className="flex-1" />
      <div className="flex flex-wrap gap-2.5 print:hidden">{children}</div>
    </div>
  )
}
