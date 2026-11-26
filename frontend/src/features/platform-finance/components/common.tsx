import { useLocation } from 'react-router-dom'
import { useEffect, useState, type ReactNode } from 'react'
import { Badge, Field, inputCls, Note } from '../../../shared/ui'
import { STATE_LABEL } from '../domain/financeRules'
import type { RecordState } from '../types'

/** Ô lọc: tên trường ở trên, ô nhập hoặc chọn ở dưới. */
export function FilterField({ label, width, children }: { label: string; width?: number; children: ReactNode }) {
  return (
    <div className="flex min-w-0 max-w-full flex-col gap-1" style={width ? { width } : undefined}>
      <span className="text-[12px] font-medium text-ink">{label}</span>
      {children}
    </div>
  )
}

export interface Flash { tone: 'ok' | 'err'; text: string }

export const FINANCE_BASE = '/nen-tang/thu-chi'
export const REPORT_BASE = '/nen-tang/bao-cao-dong-tien'
export const RECEIPT_BASE = '/nen-tang/bien-nhan'
export const PAYMENT_ROUTE = '/nen-tang/thanh-toan'

/** Thông báo ngắn trên đầu trang; có thể nhận sẵn từ trang trước qua location.state. */
export function useFlash() {
  const location = useLocation()
  const routeFlash = (location.state as { flash?: Flash } | null)?.flash ?? null
  const state = useState<Flash | null>(routeFlash)
  const [, setFlash] = state
  useEffect(() => {
    if (routeFlash) setFlash(routeFlash)
  }, [location.key, routeFlash, setFlash])
  return state
}
export const FlashNote = ({ flash }: { flash: Flash | null }) => (flash ? <div role="status"><Note tone={flash.tone}>{flash.text}</Note></div> : null)

export const RoField = ({ label, value }: { label: ReactNode; value: ReactNode }) => (
  <Field label={label}><input className={inputCls} readOnly value={String(value)} aria-label={typeof label === 'string' ? label : undefined} /></Field>
)

export function StateBadge({ state }: { state: RecordState }) {
  if (state === 'POSTED') return <Badge tone="ok" icon="circle-check">{STATE_LABEL.POSTED}</Badge>
  if (state === 'DRAFT') return <Badge tone="info" icon="pencil">{STATE_LABEL.DRAFT}</Badge>
  return <Badge tone="outline" icon="circle-x">{STATE_LABEL[state]}</Badge>
}
