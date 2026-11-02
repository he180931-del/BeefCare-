import { toIso, vnTime } from '../domain/subscriptionRules'
import type { Payment, StateDialogState, SubscriptionSeed } from '../types'

const t = vnTime
const at = (...a: Parameters<typeof vnTime>) => toIso(vnTime(...a))

/** "Bây giờ" của bản demo: các frame đều đứng ở 18/10/2026 (còn 27 ngày, hạn yêu cầu 23:41:08). */
export const DEMO_START = t(2026, 10, 18, 9, 0, 52)

const BANK = { bankCode: 'MB', accountNumber: '0386671863000', accountName: 'CONG TY TNHH BEEFCARE', qrImageUrl: null }
const NO_PERIOD = { purchasedStart: null, purchasedEnd: null, receiptCode: null, bankPaidAt: null, receivedAt: null, confirmedAt: null }

export const PENDING_PAYMENT: Payment = {
  id: 1004, quoteRef: 'BCF7K2Q9', durationYears: 1, amountVnd: 1_200_000, state: 'PENDING', priceVersionId: 3,
  requestedAt: at(2026, 10, 18, 8, 42), expiresAt: at(2026, 10, 19, 8, 42), ...BANK, ...NO_PERIOD,
}
export const EXPIRED_PAYMENT: Payment = {
  id: 1003, quoteRef: 'BCE3P8L2', durationYears: 2, amountVnd: 2_160_000, state: 'EXPIRED', priceVersionId: 3,
  requestedAt: at(2026, 10, 2, 21, 10), expiresAt: at(2026, 10, 3, 21, 10), ...BANK, ...NO_PERIOD,
}
const PAID_2025: Payment = {
  id: 1002, quoteRef: 'BCA9X2M1', durationYears: 1, amountVnd: 1_200_000, state: 'PAID', priceVersionId: 3,
  requestedAt: at(2025, 11, 10, 9, 15), expiresAt: at(2025, 11, 11, 9, 15), ...BANK,
  purchasedStart: at(2025, 11, 15), purchasedEnd: at(2026, 11, 15), receiptCode: 'BL-BCA9X2M1',
  bankPaidAt: at(2025, 11, 10, 9, 15, 40), receivedAt: at(2025, 11, 10, 9, 15, 42), confirmedAt: at(2025, 11, 10, 9, 31),
}
const PAID_2024: Payment = {
  id: 1001, quoteRef: 'BC77QK30', durationYears: 1, amountVnd: 1_100_000, state: 'PAID', priceVersionId: 2,
  requestedAt: at(2024, 11, 12, 14, 2), expiresAt: at(2024, 11, 13, 14, 2), ...BANK,
  purchasedStart: at(2024, 11, 15), purchasedEnd: at(2025, 11, 15), receiptCode: 'BL-BC77QK30',
  bankPaidAt: at(2024, 11, 12, 14, 19, 30), receivedAt: at(2024, 11, 12, 14, 19, 32), confirmedAt: at(2024, 11, 12, 14, 20),
}
const SUOI_HAI_PAID: Payment = {
  ...PAID_2025, id: 1010, quoteRef: 'BCS5N8H1', requestedAt: at(2025, 11, 8, 10, 0), expiresAt: at(2025, 11, 9, 10, 0),
  receiptCode: 'BL-BCS5N8H1', bankPaidAt: at(2025, 11, 8, 10, 5, 10), receivedAt: at(2025, 11, 8, 10, 5, 12), confirmedAt: at(2025, 11, 8, 10, 20),
}

export const SUBSCRIPTION_SEED: SubscriptionSeed = {
  prices: [
    { id: 2, price1y: 1_100_000, price2y: 1_980_000, price3y: 2_800_000, effectiveAt: at(2024, 1, 1) },
    { id: 3, price1y: 1_200_000, price2y: 2_160_000, price3y: 3_060_000, effectiveAt: at(2026, 9, 1) },
  ],
  farms: [
    { id: 1, name: 'Trại bò Yên Bài – Ba Vì', suspended: false, suspendedSince: null, payments: [PENDING_PAYMENT, EXPIRED_PAYMENT, PAID_2025, PAID_2024] },
    { id: 2, name: 'Trại Tản Lĩnh', suspended: false, suspendedSince: null, payments: [] },
    { id: 3, name: 'Trại Suối Hai', suspended: true, suspendedSince: at(2026, 10, 5, 10), payments: [SUOI_HAI_PAID] },
  ],
}

/** Dữ liệu của các frame trạng thái khi mở bằng `?m=<tên>` (khi chưa có điều kiện thật trong store). */
export const DIALOG_FIXTURES: Record<string, StateDialogState> = {
  expired: { kind: 'expired', payment: EXPIRED_PAYMENT },
  'pending-exists': { kind: 'pending-exists', payment: PENDING_PAYMENT },
  'renewal-closed': { kind: 'renewal-closed', confirmedEnd: at(2027, 11, 15), opensAt: at(2027, 8, 16) },
  suspended: { kind: 'suspended', farmName: 'Trại Suối Hai', paidUntil: at(2026, 11, 15) },
  'price-changed': {
    kind: 'price-changed',
    seen: { version: 3, term: 1, amountVnd: 1_200_000 },
    current: { version: 4, term: 1, amountVnd: 1_320_000 },
  },
  'price-unavailable': { kind: 'price-unavailable' },
  'result-unavailable': { kind: 'result-unavailable', payment: PENDING_PAYMENT, checkedAt: at(2026, 10, 20, 9, 12) },
}
