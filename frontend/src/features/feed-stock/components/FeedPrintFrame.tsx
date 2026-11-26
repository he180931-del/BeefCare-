import type { ReactNode } from 'react'
import '../styles/print.css'

export default function FeedPrintFrame({ title, children }: { title: string; children: ReactNode }) {
  return <main className="feed-print-screen min-h-screen bg-page text-ink" aria-label={title}>{children}</main>
}
