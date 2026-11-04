import type { ReactNode } from 'react'

export function FormOverlay({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return <section aria-label={title} className="flex max-h-[calc(100dvh-7rem)] min-h-0 w-full flex-col overflow-hidden bg-white"><header className="shrink-0 border-b border-rule pb-4"><h1 className="m-0 text-xl font-bold text-ink">{title}</h1>{description && <p className="mb-0 mt-1 text-xs text-subtle">{description}</p>}</header><div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-5">{children}</div></section>
}
