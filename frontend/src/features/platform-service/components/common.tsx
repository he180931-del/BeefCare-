import { useState, type ReactNode } from 'react'
import { useSession } from '../../../app/session/sessionContext'
import { Badge, type BadgeTone, Field, inputCls, Textarea } from '../../../shared/ui'
import type { IconName } from '../../../shared/ui'
import { SERVICE_STATUS_VIEW } from '../../farm-workspace'
import type { ServiceStatus } from '../types'
import { STATUS_LABEL } from '../domain/servicePeriods'

/** From xl (1280 px) a detail panel sits beside its list; below it the panel is under the list and must be scrolled to. */
export const wideScreen = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 1280px)').matches

/** Chỉ PM thao tác được; các vai trò khác chỉ xem. Ngoài phiên đăng nhập (test/mock) coi như PM. */
export function usePmAccess() {
  const session = useSession()
  return !session || session.role === 'PM'
}

// Colour from farm-workspace/domain/statusViews, so SCR-12/61 match SCR-09/11 and SCR-57; PM badges keep their icons.
const STATUS_VIEW: Record<ServiceStatus, { tone: BadgeTone; icon?: IconName }> = {
  ACTIVE: { tone: SERVICE_STATUS_VIEW.ACTIVE.tone, icon: 'circle-check' },
  PENDING_PAYMENT: { tone: SERVICE_STATUS_VIEW.PENDING_PAYMENT.tone, icon: 'clock' },
  SUSPENDED: { tone: SERVICE_STATUS_VIEW.SUSPENDED.tone, icon: 'player-pause' },
  EXPIRED: { tone: SERVICE_STATUS_VIEW.EXPIRED.tone },
}
export function ServiceBadge({ status }: { status: ServiceStatus }) {
  const v = STATUS_VIEW[status]
  return <Badge tone={v.tone} icon={v.icon}>{STATUS_LABEL[status]}</Badge>
}

export function ReadField({ label, value, id }: { label: string; value: ReactNode; id: string }) {
  return (
    <Field label={label} id={id}>
      <input id={id} readOnly className={inputCls} value={typeof value === 'string' ? value : ''} />
      {typeof value === 'string' ? null : <div className="mt-1 text-[13px]">{value}</div>}
    </Field>
  )
}

export function ReasonField({ label, id, value, onChange, error, placeholder }: { label: string; id: string; value: string; onChange: (v: string) => void; error?: string | null; placeholder?: string }) {
  return (
    <Field label={label} id={id}>
      <Textarea id={id} rows={2} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {error ? <p role="alert" className="mt-1 text-[12px] text-err-fg">{error}</p> : null}
    </Field>
  )
}

/** Chạy một lệnh ghi, giữ trạng thái đang gửi và lỗi nghiệp vụ để hiện trong hộp thoại. */
export function useAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function run<T>(fn: () => Promise<T>, fallback = 'Không lưu được dữ liệu. Vui lòng thử lại.'): Promise<T | undefined> {
    setBusy(true)
    setError(null)
    try {
      return await fn()
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : fallback)
      return undefined
    } finally {
      setBusy(false)
    }
  }
  return { run, busy, error, setError }
}

export function downloadCsv(name: string, rows: string[][]) {
  const text = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([`﻿${text}`], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}
