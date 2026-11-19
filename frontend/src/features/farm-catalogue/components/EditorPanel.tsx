import type { ReactNode } from 'react'
import { Button, Card, EmptyBlock, Note } from '../../../components/ui'

interface Props {
  title: string
  sub: string
  error?: string | null
  footer?: ReactNode
  onSubmit: () => void
  children: ReactNode
}

/** Thẻ "Biên tập" bên phải danh sách. */
export function EditorPanel({ title, sub, error, footer, onSubmit, children }: Props) {
  return (
    <Card title={title} sub={sub}>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit()
        }}
        className="flex flex-col gap-3.5"
      >
        {error && <Note tone="err"><span role="alert">{error}</span></Note>}
        {children}
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 pt-1">{footer}</div>}
      </form>
    </Card>
  )
}

export function EditorEmpty({ text }: { text: string }) {
  return <Card><EmptyBlock title={text} /></Card>
}

export function EditorFooter({ onCancel, saving, create, left }: { onCancel: () => void; saving: boolean; create: boolean; left?: ReactNode }) {
  return (
    <>
      {left}
      <Button type="button" onClick={onCancel}>Hủy</Button>
      <Button type="submit" variant="primary" disabled={saving}>{create ? 'Lưu' : 'Lưu thay đổi'}</Button>
    </>
  )
}

export const PairGrid = ({ children }: { children: ReactNode }) => <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
