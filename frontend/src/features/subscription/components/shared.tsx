import { useEffect, useState, type ReactNode } from 'react'
import { Badge, type BadgeTone } from '../../../components/ui'
import type { PaymentState, ServiceStatus } from '../types'

export const ICON_BTN = 'inline-flex items-center justify-center gap-1.5'

export type Fact = readonly [label: string, value: ReactNode, tone?: 'warn']
const COLS = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
}

/** Lưới nhãn nhỏ + giá trị, theo các khối thông tin trong frame (nhãn 11px, giá trị 13px). */
export function Facts({ items, cols = 2 }: { items: readonly Fact[]; cols?: 1 | 2 | 4 }) {
  return (
    <dl className={`m-0 grid gap-x-4 gap-y-3 ${COLS[cols]}`}>
      {items.map(([label, value, tone]) => (
        <div key={label} className="min-w-0">
          <dt className="mb-[3px] text-[11px] text-faint">{label}</dt>
          <dd className={`m-0 text-[13px] ${tone === 'warn' ? 'font-semibold text-warn-fg' : 'font-medium'}`}>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

const SERVICE: Record<ServiceStatus, [string, BadgeTone]> = {
  ACTIVE: ['Đang hoạt động', 'ok'],
  PENDING_PAYMENT: ['Đang chờ thanh toán', 'warn'],
  EXPIRED: ['Đã hết hạn', 'err'],
  SUSPENDED: ['Tạm ngưng', 'warn'],
}
export const serviceLabel = (s: ServiceStatus) => SERVICE[s][0]
export const ServiceBadge = ({ status }: { status: ServiceStatus }) => <Badge tone={SERVICE[status][1]}>{SERVICE[status][0]}</Badge>

const PAYMENT: Record<PaymentState, [string, BadgeTone]> = {
  PENDING: ['Đang chờ', 'warn'],
  PAID: ['Đã thanh toán', 'ok'],
  EXPIRED: ['Đã hết hạn', 'err'],
}
export const PaymentBadge = ({ state }: { state: PaymentState }) => <Badge tone={PAYMENT[state][1]}>{PAYMENT[state][0]}</Badge>

/** Render lại mỗi `ms` mili giây (bộ đếm ngược). */
export function useTick(ms = 1000) {
  const [n, setN] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setN((x) => x + 1), ms)
    return () => clearInterval(id)
  }, [ms])
  return n
}

export function useIsPhone() {
  const query = '(max-width: 639px)'
  const supported = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  const [phone, setPhone] = useState(() => supported && window.matchMedia(query).matches)
  useEffect(() => {
    if (!supported) return
    const mq = window.matchMedia(query)
    const on = () => setPhone(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [supported])
  return phone
}
