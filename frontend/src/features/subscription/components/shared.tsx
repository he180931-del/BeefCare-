import { useEffect, useState, type ReactNode } from 'react'
import type { IconName } from '../../../shared/ui'
import { Badge } from '../../../shared/ui'
import { paymentView, serviceView } from '../../farm-workspace'
import type { PaymentState, ServiceStatus } from '../types'

export type Fact = readonly [label: string, value: ReactNode, tone?: 'warn']
const COLS = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 @min-[440px]:grid-cols-2',
  4: 'grid-cols-1 @min-[640px]:grid-cols-2 @min-[880px]:grid-cols-4',
}

/** Lưới nhãn nhỏ + giá trị, theo các khối thông tin trong frame (nhãn 11px, giá trị 13px). */
export function Facts({ items, cols = 2, onDark = false }: { items: readonly Fact[]; cols?: 1 | 2 | 4; onDark?: boolean }) {
  return (
    <dl className={`m-0 grid gap-x-4 gap-y-3 ${COLS[cols]}`}>
      {items.map(([label, value, tone]) => (
        <div key={label} className="min-w-0">
          <dt className={`mb-[3px] text-[11px] ${onDark ? 'text-side-text' : 'text-label'}`}>{label}</dt>
          <dd className={`m-0 wrap-anywhere text-[13px] ${tone === 'warn' ? `font-semibold ${onDark ? 'text-[#ffe3aa]' : 'text-warn-fg'}` : 'font-medium'}`}>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

// One label and colour per status on SCR-09/11/12/57–62 (farm-workspace/domain/statusViews).
export const serviceLabel = (s: ServiceStatus) => serviceView(s).label
export const ServiceBadge = ({ status }: { status: ServiceStatus }) => <Badge tone={serviceView(status).tone}>{serviceView(status).label}</Badge>

export const paymentLabel = (s: PaymentState) => paymentView(s).label
export const PaymentBadge = ({ state, icon }: { state: PaymentState; icon?: IconName }) => <Badge tone={paymentView(state).tone} icon={icon}>{paymentView(state).label}</Badge>

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
