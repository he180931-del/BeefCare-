import { useLocation } from 'react-router-dom'
import { useState, type ReactNode } from 'react'
import { Badge, Note, inputCls, Field } from '../../../components/ui'
import { STATE_LABEL } from '../domain/financeRules'
import type { RecordState } from '../types'

export interface Flash { tone: 'ok' | 'err'; text: string }

export const FINANCE_BASE = '/nen-tang/thu-chi'
export const REPORT_BASE = '/nen-tang/bao-cao-dong-tien'
export const RECEIPT_BASE = '/nen-tang/bien-nhan'
export const PAYMENT_ROUTE = '/nen-tang/thanh-toan'

/** Thông báo ngắn trên đầu trang; có thể nhận sẵn từ trang trước qua location.state. */
export function useFlash() {
  const location = useLocation()
  const initial = (location.state as { flash?: Flash } | null)?.flash ?? null
  return useState<Flash | null>(initial)
}
export const FlashNote = ({ flash }: { flash: Flash | null }) => (flash ? <div role="status"><Note tone={flash.tone}>{flash.text}</Note></div> : null)

export const RoField = ({ label, value }: { label: ReactNode; value: ReactNode }) => (
  <Field label={label}><input className={inputCls} readOnly value={String(value)} aria-label={typeof label === 'string' ? label : undefined} /></Field>
)

export function StateBadge({ state }: { state: RecordState }) {
  if (state === 'POSTED') return <Badge tone="ok" icon="circle-check">{STATE_LABEL.POSTED}</Badge>
  if (state === 'DRAFT') return <Badge tone="info" icon="pencil">{STATE_LABEL.DRAFT}</Badge>
  return <Badge tone="outline" icon="circle-x">{STATE_LABEL.VOID}</Badge>
}
