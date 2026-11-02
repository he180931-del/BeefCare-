import { useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { Badge, EmptyBlock, inputCls } from '../../../components/ui'
import { useSession } from '../../authorization'
import { fmtDayMonth } from '../domain/vaccinationFormat'
import type { DoseRow, VaccinationSource, VaccineRoute } from '../types'

export const ROUTE_LABEL: Record<VaccineRoute, string> = { IM: 'Tiêm bắp', SC: 'Tiêm dưới da', ORAL: 'Uống', IN: 'Nhỏ mũi', OTHER: 'Khác' }
export const SOURCE_LABEL: Record<VaccinationSource, string> = { ON_FARM: 'Tại trại', HISTORICAL: 'Nhập lịch sử' }
export const healthCasePath = (code: string) => `/cattle/${code}?tab=health`
export const profilePath = (code: string) => `/cattle/${code}?tab=vaccine`
export const recordPath = (params: Record<string, string>) => `/tiem-phong/ghi-nhan?${new URLSearchParams(params).toString()}`

/** Quản lý ghi nhận và sửa; Chủ trại, Kỹ thuật viên chỉ xem. Không có phiên thì coi là Quản lý. */
export const useCanWrite = () => (useSession()?.role ?? 'MANAGER') === 'MANAGER'

/** Thông báo thành công truyền qua router state sau khi lưu ở màn khác. */
export function useNotice() {
  const initial = (useLocation().state as { notice?: string } | null)?.notice ?? null
  return useState<string | null>(initial)
}

export const FieldError = ({ children }: { children?: ReactNode }) => (children ? <p role="alert" className="m-0 text-[11px] text-err-fg">{children}</p> : null)

export function UnitInput({ unit, className = '', ...props }: { unit: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <input type="number" step="any" className={`${inputCls} pr-12 ${className}`} {...props} />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">{unit}</span>
    </div>
  )
}

export const parseNum = (s: string): number | undefined => {
  const t = s.trim()
  if (!t) return undefined
  const n = Number(t.replace(',', '.'))
  return Number.isNaN(n) ? undefined : n
}

/** Tách "2 ml" thành số và đơn vị. */
export function splitDose(dose: string | undefined, fallbackUnit = 'ml'): { amount: string; unit: string } {
  const m = /^\s*([\d.,]+)\s*(.*)$/.exec(dose ?? '')
  return m ? { amount: m[1], unit: m[2] || fallbackUnit } : { amount: '', unit: fallbackUnit }
}

export function DoseStatusBadge({ row }: { row: Pick<DoseRow, 'state' | 'daysOverdue' | 'effectiveDate' | 'newExpectedDate' | 'doneAt'> }) {
  switch (row.state) {
    case 'OVERDUE': return <Badge tone="err" icon="alert-triangle">Quá hạn {row.daysOverdue} ngày</Badge>
    case 'DUE': return <Badge tone="warn" icon="clock">Đến hạn {fmtDayMonth(row.effectiveDate)}</Badge>
    case 'UPCOMING': return <Badge tone="outline" icon="clock">Sắp tới</Badge>
    case 'DEFERRED': return <Badge tone="warn">{row.newExpectedDate ? `Hoãn đến ${fmtDayMonth(row.newExpectedDate)}` : 'Đã hoãn'}</Badge>
    default: return <Badge tone="ok" icon="circle-check">Đã tiêm{row.doneAt ? ` ${fmtDayMonth(row.doneAt)}` : ''}</Badge>
  }
}

export function ManagerOnly({ title, children }: { title: string; children: ReactNode }) {
  if (useCanWrite()) return <>{children}</>
  return (
    <Layout title={title}>
      <EmptyBlock title="Chỉ Quản lý mới thực hiện được thao tác này" sub="Chủ trại và Kỹ thuật viên chỉ xem lịch và lịch sử tiêm." action={<Link to="/tiem-phong" className="text-brand">Về lịch tiêm phòng</Link>} />
    </Layout>
  )
}
