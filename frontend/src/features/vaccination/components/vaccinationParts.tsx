import { useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Layout from '../../../app/layouts/FarmPlatformLayout'
import { Badge, EmptyBlock, inputCls } from '../../../shared/ui'
import { useCanRecordCare } from '../../authorization'
import { fmtDayMonth } from '../domain/vaccinationFormat'
import type { DoseRow, VaccinationSource, VaccineRoute } from '../types'

export const ROUTE_LABEL: Record<VaccineRoute, string> = { IM: 'Tiêm bắp', SC: 'Tiêm dưới da', ORAL: 'Uống', IN: 'Nhỏ mũi', OTHER: 'Khác' }
export const SOURCE_LABEL: Record<VaccinationSource, string> = { ON_FARM: 'Tại trại', HISTORICAL: 'Nhập lịch sử' }
export const healthCasePath = (code: string) => `/cattle/${code}?tab=health`
export const profilePath = (code: string) => `/cattle/${code}?tab=vaccine`
export const recordPath = (params: Record<string, string>) => `/tiem-phong/ghi-nhan?${new URLSearchParams(params).toString()}`

/** Chủ trại và Quản lý ghi nhận và sửa (GBR-08, D41); Kỹ thuật viên chỉ xem. Không có phiên thì không áp quyền theo vai trò. */
export const useCanWrite = () => useCanRecordCare()

/** Thông báo thành công truyền qua router state sau khi lưu ở màn khác. */
export function useNotice() {
  const initial = (useLocation().state as { notice?: string } | null)?.notice ?? null
  return useState<string | null>(initial)
}

export const FieldError = ({ children }: { children?: ReactNode }) => (children ? <p role="alert" className="m-0 text-[11px] text-err-fg">{children}</p> : null)

export function UnitInput({ unit, className = '', ...props }: { unit: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <input type="number" step="0.01" className={`${inputCls} pr-12 ${className}`} {...props} />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">{unit}</span>
    </div>
  )
}

/**
 * Đọc ô số nguyên một cách nghiêm (D50): để trống → undefined (không nhập); gõ đúng số nguyên không âm → số;
 * gõ sai (chữ, số thập phân, số âm, ký tự lạ) → NaN để bước kiểm tra báo lỗi dưới ô thay vì âm thầm coi là trống.
 */
export const parseIntField = (s: string): number | undefined => {
  const t = s.trim()
  if (!t) return undefined
  return /^\d+$/.test(t) ? Number(t) : Number.NaN
}

export const parseNum = (s: string): number | undefined => {
  const t = s.trim()
  if (!t) return undefined
  const n = Number(t.replace(',', '.'))
  return Number.isNaN(n) ? undefined : n
}

/**
 * Ô Liều (không bắt buộc – spec FE-09 §3.3): nhận "100", "1,5", "100ml", "100 ml" (đơn vị trùng đơn vị của vắc-xin).
 * Trống → không gửi liều; không đọc được → `invalid` để báo "Liều không hợp lệ." thay vì âm thầm bỏ giá trị.
 */
export function parseDoseAmount(text: string, unit: string): { amount?: string; invalid: boolean } {
  const t = text.trim()
  if (!t) return { invalid: false }
  const stripped = t.toLocaleLowerCase('vi').endsWith(unit.toLocaleLowerCase('vi')) ? t.slice(0, t.length - unit.length).trim() : t
  const value = parseNum(stripped)
  return value === undefined || value <= 0 || !/^[\d.,]+$/.test(stripped) ? { invalid: true } : { amount: stripped.replace(',', '.'), invalid: false }
}
export const DOSE_INVALID = 'Liều không hợp lệ.'

/** Nhãn đường tiêm để hiển thị: với "Khác" thì hiện đúng mô tả người dùng đã nhập (D45). */
export const routeLabelOf = (route: VaccineRoute | undefined, routeText?: string): string =>
  !route ? '—' : route === 'OTHER' && routeText ? routeText : ROUTE_LABEL[route]

/** Tách "2 ml" thành số và đơn vị. */
export function splitDose(dose: string | undefined, fallbackUnit = 'ml'): { amount: string; unit: string } {
  const m = /^\s*([\d.,]+)\s*(.*)$/.exec(dose ?? '')
  return m ? { amount: m[1], unit: m[2] || fallbackUnit } : { amount: '', unit: fallbackUnit }
}

export function DoseStatusBadge({ row }: { row: Pick<DoseRow, 'state' | 'daysOverdue' | 'dueDate' | 'doneAt'> }) {
  switch (row.state) {
    case 'OVERDUE': return <Badge tone="err" icon="alert-triangle">Quá hạn {row.daysOverdue} ngày</Badge>
    case 'DUE': return <Badge tone="warn" icon="clock">Đến hạn {fmtDayMonth(row.dueDate)}</Badge>
    case 'UPCOMING': return <Badge tone="outline" icon="clock">Sắp tới</Badge>
    default: return <Badge tone="ok" icon="circle-check">Đã tiêm{row.doneAt ? ` ${fmtDayMonth(row.doneAt)}` : ''}</Badge>
  }
}

/** Màn ghi tiêm và quản lý lịch: chỉ Chủ trại và Quản lý (GBR-08, D41). */
export function CareWriterOnly({ title, children }: { title: string; children: ReactNode }) {
  if (useCanWrite()) return <>{children}</>
  return (
    <Layout title={title}>
      <EmptyBlock title="Chỉ Chủ trại và Quản lý mới thực hiện được thao tác này" action={<Link to="/tiem-phong" className="text-brand">Về lịch tiêm phòng</Link>} />
    </Layout>
  )
}
