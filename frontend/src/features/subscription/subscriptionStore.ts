export type SubscriptionStatus = 'ACTIVE' | 'PENDING_PAYMENT' | 'EXPIRED' | 'SUSPENDED' | 'NONE'
export type PaymentStatus = 'PENDING' | 'PAID' | 'EXPIRED'
export type TermYears = 1 | 2 | 3

export interface PriceVersion {
  version: string
  effectiveFrom: string
  effectiveAt: string
  publishedBy: string
  prices: Record<TermYears, number>
}

export interface PurchasedPeriod {
  id: string
  farmId: string
  start: string
  end: string
  termYears: TermYears
  amount: number
  paymentCode: string
  status: 'CURRENT' | 'FUTURE' | 'PAST'
  confirmedAt: string
}

export interface FarmSubscription {
  id: string
  name: string
  status: SubscriptionStatus
  currentStart?: string
  currentEnd?: string
  confirmedEnd?: string
  suspendedSince?: string
  pendingRequestCode?: string
  periods: PurchasedPeriod[]
}

export interface PaymentIntent {
  id: string
  code: string
  farmId: string
  farmName: string
  termYears: TermYears
  amount: number
  priceVersion: string
  status: PaymentStatus
  createdAt: string
  expiresAt: string
  bankPaidAt?: string
  receivedAt?: string
  confirmedAt?: string
  periodStart?: string
  periodEnd?: string
  sourceReturn: string
  firstPayment: boolean
  transferContent: string
  receivingBank: string
  receivingAccountNumber: string
  receivingAccountName: string
}

export interface PaymentRecord {
  id: string
  paymentIntentId: string
  code: string
  farmId: string
  amount: number
  bankPaidAt: string
  receivedAt: string
  confirmedAt?: string
  status: 'RECEIVED' | 'CONFIRMED'
}

export const SUBSCRIPTION_KEYS = {
  plans: 'subscription.plans',
  orders: 'subscription.orders',
  paymentIntents: 'subscription.paymentIntents',
  payments: 'subscription.payments',
  selectedFarmId: 'subscription.selectedFarmId',
  activePaymentId: 'subscription.activePaymentId',
  returnTarget: 'subscription.returnTarget',
} as const

export const DEMO_TODAY = '2026-11-03'
// Fixed fixture instant so price/coverage decisions are deterministic and can
// be compared with the documented Asia/Ho_Chi_Minh rules.
export const DEMO_NOW = '2026-11-03T00:00:00.000Z'

export const RECEIVING_ACCOUNT = {
  bank: 'Vietcombank',
  accountNumber: '0123456789',
  accountName: 'BEEFCARE JSC',
} as const

export const DEFAULT_PLAN: PriceVersion = {
  version: 'v3', effectiveFrom: '2026-10-01', effectiveAt: '2026-10-01T08:00:00.000Z', publishedBy: 'PM demo',
  prices: { 1: 1200000, 2: 2160000, 3: 3060000 },
}

const defaultFarms: FarmSubscription[] = [
  {
    id: 'farm-ba-vi', name: 'Trại bò Ba Vì', status: 'ACTIVE', currentStart: '2026-01-01', currentEnd: '2028-01-01', confirmedEnd: '2028-01-01', periods: [
      { id: 'period-ba-vi-1', farmId: 'farm-ba-vi', start: '2026-01-01', end: '2028-01-01', termYears: 2, amount: 2160000, paymentCode: 'PAY-801', status: 'CURRENT', confirmedAt: '2026-01-02T10:15:00.000Z' },
    ],
  },
  {
    id: 'farm-moc-chau', name: 'Trại vệ tinh Mộc Châu', status: 'SUSPENDED', currentStart: '2026-01-01', currentEnd: '2027-07-01', confirmedEnd: '2027-07-01', suspendedSince: '2026-10-28', periods: [
      { id: 'period-moc-chau-1', farmId: 'farm-moc-chau', start: '2026-01-01', end: '2027-07-01', termYears: 1, amount: 1200000, paymentCode: 'PAY-772', status: 'CURRENT', confirmedAt: '2026-01-03T14:00:00.000Z' },
    ],
  },
  { id: 'farm-yen-bai', name: 'Trại kỹ thuật Yên Bài', status: 'PENDING_PAYMENT', periods: [] },
]

const defaultIntents: PaymentIntent[] = [
  { id: 'intent-882', code: 'PAY-882', farmId: 'farm-ba-vi', farmName: 'Trại bò Ba Vì', termYears: 1, amount: 1200000, priceVersion: 'v3', status: 'PENDING', createdAt: '2026-11-03T08:00:00.000Z', expiresAt: '2026-11-04T08:00:00.000Z', sourceReturn: '/ui/scr-86', firstPayment: false, transferContent: 'BEEFCARE PAY-882', receivingBank: RECEIVING_ACCOUNT.bank, receivingAccountNumber: RECEIVING_ACCOUNT.accountNumber, receivingAccountName: RECEIVING_ACCOUNT.accountName },
  { id: 'intent-771', code: 'PAY-771', farmId: 'farm-moc-chau', farmName: 'Trại vệ tinh Mộc Châu', termYears: 1, amount: 1200000, priceVersion: 'v2', status: 'EXPIRED', createdAt: '2026-09-01T10:00:00.000Z', expiresAt: '2026-09-02T10:00:00.000Z', sourceReturn: '/ui/scr-89', firstPayment: false, transferContent: 'BEEFCARE PAY-771', receivingBank: RECEIVING_ACCOUNT.bank, receivingAccountNumber: RECEIVING_ACCOUNT.accountNumber, receivingAccountName: RECEIVING_ACCOUNT.accountName },
  { id: 'intent-801', code: 'PAY-801', farmId: 'farm-ba-vi', farmName: 'Trại bò Ba Vì', termYears: 2, amount: 2160000, priceVersion: 'v3', status: 'PAID', createdAt: '2026-01-01T09:00:00.000Z', expiresAt: '2026-01-02T09:00:00.000Z', bankPaidAt: '2026-01-02T09:20:00.000Z', receivedAt: '2026-01-02T09:21:00.000Z', confirmedAt: '2026-01-02T10:15:00.000Z', periodStart: '2026-01-01', periodEnd: '2028-01-01', sourceReturn: '/ui/scr-86', firstPayment: false, transferContent: 'BEEFCARE PAY-801', receivingBank: RECEIVING_ACCOUNT.bank, receivingAccountNumber: RECEIVING_ACCOUNT.accountNumber, receivingAccountName: RECEIVING_ACCOUNT.accountName },
]

const defaultPayments: PaymentRecord[] = [
  { id: 'payment-801', paymentIntentId: 'intent-801', code: 'PAY-801', farmId: 'farm-ba-vi', amount: 2160000, bankPaidAt: '2026-01-02T09:20:00.000Z', receivedAt: '2026-01-02T09:21:00.000Z', confirmedAt: '2026-01-02T10:15:00.000Z', status: 'CONFIRMED' },
]

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try { const raw = window.localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback } catch { return fallback }
}

function write<T>(key: string, value: T) {
  if (typeof window === 'undefined') return false
  try { window.localStorage.setItem(key, JSON.stringify(value)); return true } catch { return false }
}

function toIsoTimestamp(value?: string) {
  if (!value) return value
  const parsed = new Date(value.includes('T') ? value : value.replace(' ', 'T')).getTime()
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : value
}

function normalizePaymentIntent(intent: PaymentIntent): PaymentIntent {
  const legacyAccountNumber = (intent as PaymentIntent & { accountNumber?: string }).accountNumber
  return {
    ...intent,
    createdAt: toIsoTimestamp(intent.createdAt) ?? intent.createdAt,
    expiresAt: toIsoTimestamp(intent.expiresAt) ?? intent.expiresAt,
    bankPaidAt: toIsoTimestamp(intent.bankPaidAt),
    receivedAt: toIsoTimestamp(intent.receivedAt),
    confirmedAt: toIsoTimestamp(intent.confirmedAt),
    receivingBank: intent.receivingBank ?? RECEIVING_ACCOUNT.bank,
    receivingAccountNumber: intent.receivingAccountNumber ?? legacyAccountNumber ?? RECEIVING_ACCOUNT.accountNumber,
    receivingAccountName: intent.receivingAccountName ?? RECEIVING_ACCOUNT.accountName,
  }
}

export function loadPlans() { return read(SUBSCRIPTION_KEYS.plans, [DEFAULT_PLAN]).map((plan) => ({ ...plan, effectiveAt: toIsoTimestamp(plan.effectiveAt) ?? plan.effectiveAt })) }
export function savePlans(value: PriceVersion[]) { return write(SUBSCRIPTION_KEYS.plans, value) }
export function loadOrders() { return read(SUBSCRIPTION_KEYS.orders, defaultFarms).map((farm) => ({ ...farm, periods: farm.periods.map((period) => ({ ...period, confirmedAt: toIsoTimestamp(period.confirmedAt) ?? period.confirmedAt })) })) }
export function saveOrders(value: FarmSubscription[]) { return write(SUBSCRIPTION_KEYS.orders, value) }
export function loadPaymentIntents() { return read(SUBSCRIPTION_KEYS.paymentIntents, defaultIntents).map(normalizePaymentIntent) }
export function savePaymentIntents(value: PaymentIntent[]) { return write(SUBSCRIPTION_KEYS.paymentIntents, value) }
export function loadPayments() { return read(SUBSCRIPTION_KEYS.payments, defaultPayments).map((payment) => ({ ...payment, bankPaidAt: toIsoTimestamp(payment.bankPaidAt) ?? payment.bankPaidAt, receivedAt: toIsoTimestamp(payment.receivedAt) ?? payment.receivedAt, confirmedAt: toIsoTimestamp(payment.confirmedAt) })) }
export function savePayments(value: PaymentRecord[]) { return write(SUBSCRIPTION_KEYS.payments, value) }
export function loadSelectedFarmId() {
  const stored = read<string | undefined>(SUBSCRIPTION_KEYS.selectedFarmId, undefined)
  if (stored) return stored
  if (typeof window !== 'undefined') {
    try {
      const demo = JSON.parse(window.localStorage.getItem('beefcare-ui-demo') || '{}') as { account?: { 'farm-selection'?: { farm?: string } } }
      const selectedName = demo.account?.['farm-selection']?.farm
      const selected = defaultFarms.find((farm) => farm.name === selectedName)
      if (selected) return selected.id
    } catch { /* demo migration is best effort */ }
  }
  return 'farm-ba-vi'
}
export function saveSelectedFarmId(value: string) { return write(SUBSCRIPTION_KEYS.selectedFarmId, value) }
export function loadActivePaymentId() { return read(SUBSCRIPTION_KEYS.activePaymentId, 'intent-882') }
export function saveActivePaymentId(value: string) { return write(SUBSCRIPTION_KEYS.activePaymentId, value) }
export function loadReturnTarget() { return read(SUBSCRIPTION_KEYS.returnTarget, '/ui/scr-86') }
export function saveReturnTarget(value: string) { return write(SUBSCRIPTION_KEYS.returnTarget, value) }

export function reconcileExpiredPaymentState(now = Date.now()) {
  const intents = loadPaymentIntents()
  const nextIntents = intents.map((intent) => {
    const expiresAt = new Date(intent.expiresAt).getTime()
    return intent.status === 'PENDING' && Number.isFinite(expiresAt) && expiresAt <= now ? { ...intent, status: 'EXPIRED' as const } : intent
  })
  const expiredCodes = new Set(nextIntents.filter((intent) => intent.status === 'EXPIRED').map((intent) => intent.code))
  const farms = loadOrders()
  const nextFarms = farms.map((farm) => expiredCodes.has(farm.pendingRequestCode ?? '') ? { ...farm, pendingRequestCode: undefined } : farm)
  if (JSON.stringify(nextIntents) !== JSON.stringify(intents)) savePaymentIntents(nextIntents)
  if (JSON.stringify(nextFarms) !== JSON.stringify(farms)) saveOrders(nextFarms)
  return { intents: nextIntents, farms: nextFarms }
}

export function money(value: number) { return `${value.toLocaleString('vi-VN')} đ` }
export function addYears(date: string, years: number) {
  const next = new Date(`${date}T00:00:00.000Z`); next.setUTCFullYear(next.getUTCFullYear() + years); return next.toISOString().slice(0, 10)
}
export function daysRemaining(date?: string) {
  if (!date) return null
  const diff = new Date(`${date}T00:00:00`).getTime() - new Date(`${DEMO_TODAY}T00:00:00`).getTime()
  return Math.ceil(diff / 86400000)
}
export function renewalDate(confirmedEnd?: string) {
  if (!confirmedEnd) return undefined
  const next = new Date(`${confirmedEnd}T00:00:00`); next.setDate(next.getDate() - 90); return next.toISOString().slice(0, 10)
}
export function formatDateTime(value?: string) {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(parsed)
}
