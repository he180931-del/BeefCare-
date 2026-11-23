import type { BadgeTone } from '../../../shared/ui'
import type { PaymentState, ServiceStatus } from '../types'

export interface PlatformStatusView { label: string; tone: BadgeTone }

export const SERVICE_STATUS_VIEW = {
  ACTIVE: { label: 'Đang hoạt động', tone: 'ok' },
  PENDING_PAYMENT: { label: 'Chờ thanh toán', tone: 'warn' },
  EXPIRED: { label: 'Hết hạn', tone: 'warn' },
  SUSPENDED: { label: 'Tạm ngưng', tone: 'err' },
} as const satisfies Record<ServiceStatus, PlatformStatusView>

export const PAYMENT_STATE_VIEW = {
  PENDING: { label: 'Đang chờ', tone: 'warn' },
  PAID: { label: 'Đã thanh toán', tone: 'ok' },
  EXPIRED: { label: 'Hết hạn', tone: 'outline' },
  CANCELLED: { label: 'Đã hủy', tone: 'outline' },
} as const satisfies Record<PaymentState, PlatformStatusView>
