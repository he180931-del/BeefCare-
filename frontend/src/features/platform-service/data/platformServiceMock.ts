import type { Evidence, PlatformFarm, PlatformPayment, PriceDraft, PriceVersion } from '../types'

export const PM_NAME = 'Đỗ Minh Quân'
const RECIPIENT = 'MB · 0386671863000 · CONG TY TNHH BEEFCARE'

const farm = (f: Partial<PlatformFarm> & Pick<PlatformFarm, 'farmId' | 'farmName' | 'ownerName' | 'ownerEmail' | 'serviceStatus' | 'herdSize'>): PlatformFarm => ({
  subscriptionCode: null, suspended: false, suspendedSince: null, suspendedBy: null, suspendReason: null, periods: [], version: 1, ...f,
})

const FARMS: PlatformFarm[] = [
  farm({ farmId: 1, farmName: 'Trại bò Yên Bài – Ba Vì', ownerName: 'N. V. Hùng', ownerEmail: 'nvhung.farm@gmail.com', serviceStatus: 'ACTIVE', herdSize: 248, subscriptionCode: 'SUB-0048', version: 3,
    periods: [{ paymentCode: 'BCA9X2M1', receiptCode: 'RC-25-0388', termYears: 1, start: '2025-11-15', end: '2026-11-14', confirmedAt: '2025-11-10T09:31:00' }] }),
  farm({ farmId: 2, farmName: 'Trại Tản Lĩnh', ownerName: 'N. V. Hùng', ownerEmail: 'nvhung.farm@gmail.com', serviceStatus: 'PENDING_PAYMENT', herdSize: 0 }),
  farm({ farmId: 3, farmName: 'Trại Suối Hai', ownerName: 'N. V. Hùng', ownerEmail: 'nvhung.farm@gmail.com', serviceStatus: 'SUSPENDED', herdSize: 61, subscriptionCode: 'SUB-0051',
    suspended: true, suspendedSince: '2026-09-28', suspendedBy: PM_NAME, suspendReason: 'Nghi vấn chia sẻ tài khoản cho trại khác',
    periods: [{ paymentCode: 'BCS3H7D4', receiptCode: 'RC-26-0107', termYears: 1, start: '2026-03-03', end: '2027-03-02', confirmedAt: '2026-03-01T14:10:00' }] }),
  farm({ farmId: 4, farmName: 'Trại Vân Hòa', ownerName: 'L. V. Bình', ownerEmail: 'lvbinh.vanhoa@gmail.com', serviceStatus: 'ACTIVE', herdSize: 173, subscriptionCode: 'SUB-0039',
    periods: [{ paymentCode: 'BCV1H5N8', receiptCode: 'RC-25-0371', termYears: 1, start: '2025-10-22', end: '2026-10-21', confirmedAt: '2025-10-20T08:15:00' }] }),
  farm({ farmId: 5, farmName: 'Trại Mai Pha', ownerName: 'Đ. T. Lan', ownerEmail: 'dtlan.maipha@gmail.com', serviceStatus: 'ACTIVE', herdSize: 204, subscriptionCode: 'SUB-0062',
    periods: [{ paymentCode: 'BCM8P2K6', receiptCode: 'RC-26-0298', termYears: 1, start: '2026-08-06', end: '2027-08-05', confirmedAt: '2026-08-04T16:42:00' }] }),
  farm({ farmId: 6, farmName: 'Trại Tòng Bạt', ownerName: 'T. T. Hoa', ownerEmail: 'tthoa.tongbat@gmail.com', serviceStatus: 'EXPIRED', herdSize: 96, subscriptionCode: 'SUB-0027',
    periods: [{ paymentCode: 'BCT4B9W2', receiptCode: 'RC-25-0344', termYears: 1, start: '2025-10-01', end: '2026-09-30', confirmedAt: '2025-09-29T10:05:00' }] }),
]

const pay = (p: Partial<PlatformPayment> & Pick<PlatformPayment, 'id' | 'code' | 'farmId' | 'farmName' | 'termYears' | 'amount' | 'state' | 'createdAt' | 'expiresAt'>): PlatformPayment => ({
  priceVersion: 3, recipient: RECIPIENT, evidenceId: null, receiptCode: null, confirmedAt: null, purchasedStart: null, purchasedEnd: null, ...p,
})
const PAYMENTS: PlatformPayment[] = [
  pay({ id: 101, code: 'BCF7K2Q9', farmId: 1, farmName: 'Trại bò Yên Bài – Ba Vì', termYears: 1, amount: 1200000, state: 'PENDING', createdAt: '2026-10-18T08:42:00', expiresAt: '2026-10-19T08:42:00' }),
  pay({ id: 100, code: 'BCA9X2M1', farmId: 1, farmName: 'Trại bò Yên Bài – Ba Vì', termYears: 1, amount: 1200000, state: 'PAID', createdAt: '2025-11-10T08:50:00', expiresAt: '2025-11-11T08:50:00', receiptCode: 'RC-25-0388', confirmedAt: '2025-11-10T09:31:00', purchasedStart: '2025-11-15', purchasedEnd: '2026-11-14' }),
  pay({ id: 102, code: 'BCK2W8P1', farmId: 90, farmName: 'Trại Đồng Mô', termYears: 2, amount: 2160000, state: 'PAID', createdAt: '2026-10-18T08:20:00', expiresAt: '2026-10-19T08:20:00', evidenceId: 511, receiptCode: 'RC-26-0411', confirmedAt: '2026-10-18T08:41:30', purchasedStart: '2026-10-18', purchasedEnd: '2028-10-17' }),
  pay({ id: 103, code: 'BCE3P8L2', farmId: 2, farmName: 'Trại Tản Lĩnh', termYears: 1, amount: 1200000, state: 'EXPIRED', createdAt: '2026-10-17T09:00:00', expiresAt: '2026-10-18T09:00:00' }),
]

const ev = (e: Partial<Evidence> & Pick<Evidence, 'id' | 'transactionId' | 'amount' | 'content' | 'bankPaidAt' | 'matchResult' | 'reviewStatus'>): Evidence => ({
  provider: 'SePay', environment: 'LIVE', accountNamespace: 'beefcare-main', direction: 'IN', receivingAccount: 'MB 0386671863000', receivedAt: e.bankPaidAt,
  deliveries: 'Một lần giao', reviewReason: null, reviewedBy: null, reviewedAt: null, lockedForReturn: false, lockReason: null, lockedBy: null, lockedAt: null,
  lockReference: null, returnReference: null, returnResult: null, manualIncomePosted: false, paymentId: null, version: 1, history: [], ...e,
})
const EVIDENCE: Evidence[] = [
  ev({ id: 842, transactionId: 'FT26291000842', amount: 1200000, content: 'BCF7K2Q 9 Nguyen Van Hung', bankPaidAt: '2026-10-18T09:05:12', receivedAt: '2026-10-18T09:05:14', deliveries: 'D-842-1 09:05:14; D-842-2 09:06:14 · cùng nguồn', matchResult: 'CODE_MISMATCH', reviewStatus: 'TO_REVIEW' }),
  ev({ id: 843, transactionId: 'FT26291000843', amount: 1200000, content: 'BCF7K2Q9', bankPaidAt: '2026-10-18T09:05:12', receivedAt: '2026-10-18T09:05:14', matchResult: 'EXACT_CODE', reviewStatus: 'TO_REVIEW' }),
  ev({ id: 511, transactionId: 'FT26291000511', amount: 2160000, content: 'BCK2W8P1', bankPaidAt: '2026-10-18T08:41:00', receivedAt: '2026-10-18T08:41:02', matchResult: 'AUTO_PAID', reviewStatus: 'AUTO_CONFIRMED', paymentId: 102 }),
  ev({ id: 177, transactionId: 'FT26290000177', amount: 1200000, content: 'BCE3P8L2', bankPaidAt: '2026-10-17T22:30:00', receivedAt: '2026-10-17T22:30:03', matchResult: 'REQUEST_EXPIRED', reviewStatus: 'TO_REVIEW' }),
  ev({ id: 93, transactionId: 'FT26290000093', amount: 500000, content: 'ung ho trai', bankPaidAt: '2026-10-17T15:10:00', receivedAt: '2026-10-17T15:10:02', matchResult: 'NO_REQUEST', reviewStatus: 'TO_REVIEW' }),
]

const v = (version: number, p1: number, p2: number, p3: number, effectiveAt: string, publishedAt: string, terms: string): PriceVersion => ({
  version, price1y: p1, price2y: p2, price3y: p3, effectiveAt, terms, publishedBy: PM_NAME, publishedAt, withdrawn: false, withdrawReason: null,
})
const PRICE_VERSIONS: PriceVersion[] = [
  v(1, 2000000, 3800000, 5400000, '2024-01-01T00:00:00', '2023-12-20T10:00:00', 'Cùng chức năng; không tự gia hạn'),
  v(2, 2200000, 4180000, 5940000, '2024-06-01T00:00:00', '2024-05-20T10:00:00', 'Cùng chức năng; không tự gia hạn'),
  v(3, 1200000, 2160000, 3060000, '2026-09-01T00:00:00', '2026-08-25T14:30:00', 'Cùng chức năng; không tự gia hạn'),
]
const DRAFT: PriceDraft = { price1y: '1.200.000', price2y: '2.160.000', price3y: '3.060.000', mode: 'SCHEDULE', effectiveAt: '2027-01-01T00:00', terms: 'Cùng chức năng; không tự gia hạn' }

export const PLATFORM_SERVICE_DEMO = {
  farms: FARMS,
  /** Các trại ngoài danh sách mẫu (tổng 128 trại, 104 đang hoạt động...). */
  otherFarms: { active: 101, pending: 10, expired: 8, suspended: 3 },
  payments: PAYMENTS,
  evidence: EVIDENCE,
  /** Số liệu của các chứng từ/yêu cầu ngoài danh sách mẫu. */
  tileBase: { pending: 6, hold: 1, locked: 1 },
  receiptSeq: 411,
  priceVersions: PRICE_VERSIONS,
  draft: DRAFT,
}
export type PlatformServiceSeed = typeof PLATFORM_SERVICE_DEMO
