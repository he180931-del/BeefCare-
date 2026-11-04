import { Badge, Button } from '../../../components/ui'

export function RecordHeader({ title, code, status, meta, readOnly }: { title: string; code: string; status: string; meta: string[]; readOnly?: boolean }) {
  return <header className="flex min-w-0 flex-wrap items-start gap-4 border-b border-rule pb-5"><div className="grid size-12 shrink-0 place-items-center rounded-full bg-ok-bg text-base font-bold text-brand">BC</div><div className="min-w-0 flex-1"><div className="mb-1 flex flex-wrap items-center gap-2"><h1 className="m-0 text-xl font-bold text-ink">{title}</h1><Badge tone="ok">{status}</Badge></div><p className="m-0 text-xs font-semibold text-subtle">{code}</p><div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">{meta.map((item) => <span key={item}>{item}</span>)}</div></div>{!readOnly && <Button variant="primary">Cập nhật</Button>}</header>
}
