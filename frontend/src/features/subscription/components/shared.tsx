import { useEffect, useState, type ReactNode } from 'react'
import type { IconName } from '../../../components/Icon'
import { Badge } from '../../../components/ui'
import { paymentView, serviceView } from '../../farm-workspace/domain/statusViews'
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
          {/* text-muted (#666, 5.7:1 on white); the former #8f8f8f was 3.2:1, below WCAG AA for 11 px text. */}
          <dt className="mb-[3px] text-[11px] text-muted">{label}</dt>
          <dd className={`m-0 text-[13px] ${tone === 'warn' ? 'font-semibold text-warn-fg' : 'font-medium'}`}>{value}</dd>
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
