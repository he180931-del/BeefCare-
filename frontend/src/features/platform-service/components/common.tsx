import { useState, type ReactNode } from 'react'
import { useSession } from '../../authorization'
import { Badge, Field, Textarea, inputCls, type BadgeTone } from '../../../components/ui'
import type { IconName } from '../../../components/Icon'
import type { ServiceStatus } from '../types'
import { STATUS_LABEL } from '../domain/servicePeriods'

/** Chỉ PM thao tác được; các vai trò khác chỉ xem. Ngoài phiên đăng nhập (test/mock) coi như PM. */
export function usePmAccess() {
  const session = useSession()
  return !session || session.role === 'PM'
}

const STATUS_VIEW: Record<ServiceStatus, { tone: BadgeTone; icon?: IconName }> = {
  ACTIVE: { tone: 'ok', icon: 'circle-check' },
  PENDING_PAYMENT: { tone: 'warn', icon: 'clock' },
  SUSPENDED: { tone: 'err', icon: 'player-pause' },
  EXPIRED: { tone: 'outline' },
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
