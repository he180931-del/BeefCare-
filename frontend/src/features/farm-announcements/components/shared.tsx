import { useEffect, useMemo, type ReactNode } from 'react'
import { useSession } from '../../authorization'
import { parseRichText, type Inline } from '../domain/richText'
import type { Viewer } from '../types'

export function useViewer(): Viewer {
  const session = useSession()
  const role = session?.role === 'MANAGER' || session?.role === 'TECHNICIAN' ? session.role : 'OWNER'
  const name = session?.fullName ?? ''
  return useMemo(() => ({ name, role }), [name, role])
}

export const messageOf = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback)

function renderInline(nodes: Inline[]): ReactNode {
  return nodes.map((n, i) => {
    if (n.type === 'text') return n.text
    if (n.type === 'bold') return <strong key={i}>{renderInline(n.children)}</strong>
    if (n.type === 'italic') return <em key={i}>{renderInline(n.children)}</em>
    return <a key={i} href={n.href} target="_blank" rel="noopener noreferrer" className="text-brand underline">{n.text}</a>
  })
}

/** Hiển thị nội dung đã đăng; chỉ dựng phần tử an toàn từ văn bản có đánh dấu. */
export function RichText({ text, className = '' }: { text: string; className?: string }) {
  return (
    <div className={`flex flex-col gap-2 text-sm leading-6 text-[#212121] ${className}`}>
      {parseRichText(text).map((block, i) => {
        if (block.type === 'p') return <p key={i} className="m-0 break-words">{renderInline(block.inline)}</p>
        const List = block.type === 'ul' ? 'ul' : 'ol'
        return <List key={i} className={`m-0 pl-5 ${block.type === 'ul' ? 'list-disc' : 'list-decimal'}`}>{block.items.map((item, j) => <li key={j}>{renderInline(item)}</li>)}</List>
      })}
    </div>
  )
}

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 5000)
    return () => window.clearTimeout(timer)
  }, [message, onClose])
  if (!message) return null
  return (
    <div role="status" className="fixed bottom-6 right-6 z-50 max-w-[calc(100vw-3rem)] rounded-lg bg-[#183528] px-4 py-3 text-sm text-white shadow-lg">{message}</div>
  )
}
