import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Badge } from '../../../components/ui'
import { useSession } from '../../authorization'
import { actorForRole } from '../data/supportMock'
import { PRIORITY_LABEL, STATUS_LABEL, initials } from '../domain/supportRules'
import type { Actor, TicketPriority, TicketStatus } from '../types'

export function useActor(): Actor {
  const session = useSession()
  return useMemo(() => {
    const fallback = actorForRole(session?.role)
    return typeof session?.id === 'number' && session.id > 0
      ? { ...fallback, id: session.id, name: session.fullName }
      : fallback
  }, [session?.fullName, session?.id, session?.role])
}

export const errText = (e: unknown, fallback = 'Không lưu được dữ liệu. Vui lòng thử lại.') => (e instanceof Error && e.message ? e.message : fallback)

export function Avatar({ name }: { name: string }) {
  return <span aria-hidden className="grid size-[22px] shrink-0 place-items-center rounded-full bg-[#eef4ef] text-[9px] font-semibold text-brand">{initials(name)}</span>
}

const STATUS_TONE = { OPEN: 'info', IN_PROGRESS: 'warn', WAITING_CUSTOMER: 'outline', RESOLVED: 'ok', CLOSED: 'outline' } as const
export function StatusBadge({ status }: { status: TicketStatus }) {
  const showClock = status !== 'RESOLVED' && status !== 'CLOSED'
  return <Badge tone={STATUS_TONE[status]} icon={showClock ? 'clock' : undefined}>{STATUS_LABEL[status]}</Badge>
}
export const PriorityBadge = ({ priority }: { priority: TicketPriority }) => <Badge tone={priority === 'HIGH' ? 'err' : 'outline'}>{PRIORITY_LABEL[priority]}</Badge>

/** Chạy một thao tác của hộp thoại: giữ trạng thái đang gửi và lỗi nội tuyến. */
export function useSubmit() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try { await fn() } catch (e) { setError(errText(e)) } finally { setBusy(false) }
  }, [])
  return { busy, error, run, setError }
}

export function useFlash(): [ReactNode, (message: string, tone?: 'ok' | 'err') => void] {
  const [flash, setFlash] = useState<{ message: string; tone: 'ok' | 'err' } | null>(null)
  useEffect(() => {
    if (!flash) return undefined
    const id = window.setTimeout(() => setFlash(null), 5000)
    return () => window.clearTimeout(id)
  }, [flash])
  const show = useCallback((message: string, tone: 'ok' | 'err' = 'ok') => setFlash({ message, tone }), [])
  const node = flash ? (
    <div role="status" className={`fixed bottom-6 right-6 z-[60] max-w-[420px] rounded-md px-4 py-3 text-sm shadow-lg ${flash.tone === 'ok' ? 'bg-ok-bg text-ok-fg' : 'bg-err-bg text-err-fg'}`}>{flash.message}</div>
  ) : null
  return [node, show]
}

export const FieldError = ({ children }: { children?: ReactNode }) => (children ? <p role="alert" className="m-0 mt-1 text-xs text-err-fg">{children}</p> : null)
