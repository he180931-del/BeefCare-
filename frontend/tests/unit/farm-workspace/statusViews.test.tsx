import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { serviceLabel as workspaceServiceLabel } from '../../../src/features/farm-workspace/components/WorkspaceUi'
import { ServiceBadge as PlatformServiceBadge } from '../../../src/features/platform-service/components/common'
import { PAYMENT_STATE_LABEL } from '../../../src/features/platform-service/domain/reconciliation'
import { STATUS_LABEL } from '../../../src/features/platform-service/domain/servicePeriods'
import { PaymentBadge, ServiceBadge as SubscriptionServiceBadge, paymentLabel, serviceLabel as subscriptionServiceLabel } from '../../../src/features/subscription/components/shared'

const SERVICE = ['ACTIVE', 'PENDING_PAYMENT', 'EXPIRED', 'SUSPENDED'] as const
const PAYMENT = ['PENDING', 'PAID', 'EXPIRED', 'CANCELLED'] as const
// Background class of each Badge tone (components/ui.tsx).
const TONE_CLASS = { ok: 'bg-ok-bg', warn: 'bg-warn-bg', err: 'bg-err-bg', outline: 'bg-white' } as const

/** UI review 19/11 (B1): a status had up to three labels and colours across SCR-09/11, SCR-12/61, SCR-57–62. */
describe('one label and colour per status on every FE-02 / FE-19 screen', () => {
  it('farm service status reads the same on SCR-09/11, SCR-12/61 and SCR-57/58', () => {
    expect(SERVICE.map(workspaceServiceLabel)).toEqual(['Đang hoạt động', 'Chờ thanh toán', 'Hết hạn', 'Tạm ngưng'])
    for (const status of SERVICE) {
      expect(STATUS_LABEL[status]).toBe(workspaceServiceLabel(status))
      expect(subscriptionServiceLabel(status)).toBe(workspaceServiceLabel(status))
    }
  })

  it('green when working, amber when the Owner must pay or renew, red when the PM suspended it', () => {
    const expected = { ACTIVE: 'ok', PENDING_PAYMENT: 'warn', EXPIRED: 'warn', SUSPENDED: 'err' } as const
    for (const status of SERVICE) {
      const view = render(<><PlatformServiceBadge status={status} /><SubscriptionServiceBadge status={status} /></>)
      for (const badge of screen.getAllByText(workspaceServiceLabel(status))) expect(badge).toHaveClass(TONE_CLASS[expected[status]])
      view.unmount()
    }
  })

  it('a payment request reads the same for the Owner (SCR-59/60) and the PM (SCR-62)', () => {
    expect(PAYMENT.map(paymentLabel)).toEqual(['Đang chờ', 'Đã thanh toán', 'Hết hạn', 'Đã hủy'])
    for (const state of PAYMENT) expect(PAYMENT_STATE_LABEL[state]).toBe(paymentLabel(state))
    const expected = { PENDING: 'warn', PAID: 'ok', EXPIRED: 'outline', CANCELLED: 'outline' } as const
    for (const state of PAYMENT) {
      const view = render(<PaymentBadge state={state} />)
      expect(screen.getByText(paymentLabel(state))).toHaveClass(TONE_CLASS[expected[state]])
      view.unmount()
    }
  })
})
