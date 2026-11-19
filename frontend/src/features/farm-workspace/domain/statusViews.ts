import type { BadgeTone } from '../../../components/ui'

export interface StatusView { label: string; tone: BadgeTone }

/**
 * The one label and colour of a farm service status on every FE-02 / FE-19 screen (SCR-09, 11, 12, 57, 58, 61):
 * green while the service works, amber while the Owner has to pay or renew, red while the PM keeps it suspended.
 */
export const SERVICE_STATUS_VIEW = {
  ACTIVE: { label: 'Đang hoạt động', tone: 'ok' },
  PENDING_PAYMENT: { label: 'Chờ thanh toán', tone: 'warn' },
  EXPIRED: { label: 'Hết hạn', tone: 'warn' },
  SUSPENDED: { label: 'Tạm ngưng', tone: 'err' },
} as const satisfies Record<'ACTIVE' | 'PENDING_PAYMENT' | 'EXPIRED' | 'SUSPENDED', StatusView>

/** The one label and colour of a payment request state for the Owner (SCR-57, 59, 60) and the PM (SCR-61, 62). */
export const PAYMENT_STATE_VIEW = {
  PENDING: { label: 'Đang chờ', tone: 'warn' },
  PAID: { label: 'Đã thanh toán', tone: 'ok' },
  EXPIRED: { label: 'Hết hạn', tone: 'outline' },
  CANCELLED: { label: 'Đã hủy', tone: 'outline' },
} as const satisfies Record<'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED', StatusView>

/** An unknown code keeps showing the code itself, in a neutral colour. */
export const serviceView = (status: string): StatusView =>
  (SERVICE_STATUS_VIEW as Record<string, StatusView>)[status] ?? { label: status, tone: 'outline' }
export const paymentView = (state: string): StatusView =>
  (PAYMENT_STATE_VIEW as Record<string, StatusView>)[state] ?? { label: state, tone: 'outline' }
