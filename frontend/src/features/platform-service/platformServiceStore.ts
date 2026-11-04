import { DEMO_NOW, loadPaymentIntents, loadPlans, loadOrders, savePlans, type FarmSubscription, type PaymentIntent, type PriceVersion, type PurchasedPeriod } from '../subscription/subscriptionStore'

export type ReconciliationStatus = 'PENDING' | 'ACCEPTED' | 'HOLD' | 'REJECTED'
export type ServiceCoverageStatus = 'CURRENT' | 'FUTURE' | 'PAST'

export interface ServicePeriod extends PurchasedPeriod {
  farmName: string
  planVersion: string
  sourcePaymentId?: string
  sourcePaymentCode?: string
  suspensionDate?: string
}

export interface ReconciliationHistoryEntry {
  at: string
  action: string
  actor: string
  reason?: string
  evidenceRefs?: string[]
}

export interface PaymentReconciliation {
  id: string
  paymentIntentId?: string
  farmId: string
  farmName: string
  amount: number
  bankReference: string
  bankPaidAt?: string
  receivedAt: string
  provider: string
  environment: string
  namespace: string
  direction: string
  receivingAccount: string
  receivingAccountNumber?: string
  transferContent: string
  matchResult: string
  evidenceRefs: string[]
  status: ReconciliationStatus
  candidatePaymentId?: string
  decisionReason?: string
  decidedAt?: string
  decidedBy?: string
  locked: boolean
  returnReference?: string
  returnDate?: string
  returnResult?: string
  history: ReconciliationHistoryEntry[]
}

export interface PriceVersionRecord extends PriceVersion {
  id: string
  packageName: string
  terms: string
  effectiveMode: 'NOW' | 'SCHEDULED'
  sourceNote: string
  status: 'SCHEDULED' | 'EFFECTIVE' | 'SUPERSEDED' | 'WITHDRAWN'
  publishedAt: string
  withdrawnAt?: string
  withdrawnReason?: string
}

export const PLATFORM_SERVICE_KEYS = {
  periods: 'service.periods',
  reconciliation: 'payments.reconciliation',
  reconciliationSelection: 'payments.reconciliation.selection',
  priceVersions: 'subscription.priceVersions',
} as const

const read = <T,>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) as T : fallback
  } catch { return fallback }
}

const write = <T,>(key: string, value: T) => {
  if (typeof window === 'undefined') return false
  try { window.localStorage.setItem(key, JSON.stringify(value)); return true } catch { return false }
}

function iso(value: string) {
  const parsed = new Date(value.includes('T') ? value : value.replace(' ', 'T')).getTime()
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : value
}

const defaultTerms = 'Các chức năng theo gói; thanh toán một lần bằng chuyển khoản; không tự động gia hạn; hỗ trợ trong giờ hành chính.'

function periodsFromSubscriptions(farms: FarmSubscription[], intents: PaymentIntent[]): ServicePeriod[] {
  return farms.flatMap((farm) => farm.periods.map((period) => {
    const source = intents.find((intent) => intent.code === period.paymentCode) ?? intents.filter((intent) => intent.farmId === farm.id && intent.status === 'PAID').sort((a, b) => (b.confirmedAt ?? b.createdAt).localeCompare(a.confirmedAt ?? a.createdAt))[0]
    return { ...period, farmName: farm.name, planVersion: source?.priceVersion ?? '—', sourcePaymentId: source?.id, sourcePaymentCode: period.paymentCode, suspensionDate: farm.suspendedSince }
  }))
}

const defaultReconciliation: PaymentReconciliation[] = [
  { id: 'recon-pay-882', paymentIntentId: 'intent-882', farmId: 'farm-ba-vi', farmName: 'Trại bò Ba Vì', amount: 1200000, bankReference: 'VCB-20261103-882', bankPaidAt: '2026-11-03T08:20:00.000Z', receivedAt: '2026-11-03T08:21:00.000Z', provider: 'Vietcombank', environment: 'PRODUCTION', namespace: 'BEEFCARE', direction: 'INBOUND', receivingAccount: 'Vietcombank · 0123456789 · BEEFCARE JSC', transferContent: 'BEEFCARE PAY-882', matchResult: 'PENDING_MATCH', evidenceRefs: ['statement-2026-11-03.pdf'], status: 'PENDING', locked: false, history: [{ at: '2026-11-03T08:21:00.000Z', action: 'RECEIVED', actor: 'Bank feed', evidenceRefs: ['statement-2026-11-03.pdf'] }] },
  { id: 'recon-pay-801', paymentIntentId: 'intent-801', farmId: 'farm-ba-vi', farmName: 'Trại bò Ba Vì', amount: 2160000, bankReference: 'VCB-20260102-801', bankPaidAt: '2026-01-02T09:20:00.000Z', receivedAt: '2026-01-02T09:21:00.000Z', provider: 'Vietcombank', environment: 'PRODUCTION', namespace: 'BEEFCARE', direction: 'INBOUND', receivingAccount: 'Vietcombank · 0123456789 · BEEFCARE JSC', transferContent: 'BEEFCARE PAY-801', matchResult: 'MATCHED', evidenceRefs: ['statement-2026-01-02.pdf'], status: 'ACCEPTED', candidatePaymentId: 'intent-801', decidedAt: '2026-01-02T10:15:00.000Z', decidedBy: 'Quản lý nền tảng', locked: true, history: [{ at: '2026-01-02T09:21:00.000Z', action: 'RECEIVED', actor: 'Dữ liệu ngân hàng', evidenceRefs: ['statement-2026-01-02.pdf'] }, { at: '2026-01-02T10:15:00.000Z', action: 'ACCEPTED', actor: 'Quản lý nền tảng', evidenceRefs: ['statement-2026-01-02.pdf'] }] },
]

export function loadServicePeriods() {
  const fallback = periodsFromSubscriptions(loadOrders(), loadPaymentIntents())
  const stored = read<ServicePeriod[] | null>(PLATFORM_SERVICE_KEYS.periods, null)
  const periods = stored ?? fallback
  if (!stored) write(PLATFORM_SERVICE_KEYS.periods, periods)
  return periods.map((period) => ({ ...period, confirmedAt: iso(period.confirmedAt) }))
}

export function saveServicePeriods(value: ServicePeriod[]) { return write(PLATFORM_SERVICE_KEYS.periods, value) }
export function loadReconciliations() {
  const stored = read<PaymentReconciliation[] | null>(PLATFORM_SERVICE_KEYS.reconciliation, null)
  const records = stored ?? defaultReconciliation
  if (!stored) write(PLATFORM_SERVICE_KEYS.reconciliation, records)
  return records.map((record) => {
    const legacyAccountNumber = (record as PaymentReconciliation & { accountNumber?: string }).accountNumber
    const receivingAccount = record.receivingAccount ?? 'Vietcombank · 0123456789 · BEEFCARE JSC'
    return { ...record, provider: record.provider ?? 'Vietcombank', environment: record.environment ?? 'PRODUCTION', namespace: record.namespace ?? 'BEEFCARE', direction: record.direction ?? 'INBOUND', receivingAccount, receivingAccountNumber: record.receivingAccountNumber ?? legacyAccountNumber ?? receivingAccount.match(/\d{6,}/)?.[0] ?? '0123456789', transferContent: record.transferContent ?? '—', matchResult: record.matchResult ?? 'PENDING_MATCH', bankPaidAt: record.bankPaidAt ? iso(record.bankPaidAt) : undefined, receivedAt: iso(record.receivedAt), decidedAt: record.decidedAt ? iso(record.decidedAt) : undefined, returnDate: record.returnDate ? iso(record.returnDate) : undefined, history: record.history.map((entry) => ({ ...entry, at: iso(entry.at) })) }
  })
}
export function saveReconciliations(value: PaymentReconciliation[]) { return write(PLATFORM_SERVICE_KEYS.reconciliation, value) }
export function loadReconciliationSelection() { return read<{ paymentId?: string; evidenceId?: string }>(PLATFORM_SERVICE_KEYS.reconciliationSelection, {}) }
export function saveReconciliationSelection(value: { paymentId?: string; evidenceId?: string }) { return write(PLATFORM_SERVICE_KEYS.reconciliationSelection, value) }

function normalizePriceVersion(version: PriceVersionRecord): PriceVersionRecord {
  const legacyStatus = version.status as string
  return { ...version, status: legacyStatus === 'ACTIVE' ? 'EFFECTIVE' : legacyStatus === 'WITHDRAWN' ? 'WITHDRAWN' : version.status, publishedAt: version.publishedAt ? iso(version.publishedAt) : iso(version.effectiveAt), effectiveAt: iso(version.effectiveAt), withdrawnAt: version.withdrawnAt ? iso(version.withdrawnAt) : undefined }
}

export function loadPriceVersions(): PriceVersionRecord[] {
  const fallback = loadPlans().map((plan, index) => ({ ...plan, id: `price-${plan.version}`, packageName: 'Chuyên nghiệp', terms: defaultTerms, effectiveMode: index === 0 ? 'NOW' as const : 'SCHEDULED' as const, sourceNote: 'Kế thừa bảng giá subscription', status: index === 0 ? 'EFFECTIVE' as const : 'SUPERSEDED' as const, publishedAt: plan.effectiveAt }))
  const stored = read<PriceVersionRecord[] | null>(PLATFORM_SERVICE_KEYS.priceVersions, null)
  const versions = stored ?? fallback
  if (!stored) write(PLATFORM_SERVICE_KEYS.priceVersions, versions)
  const normalized = versions.map(normalizePriceVersion)
  const now = new Date(DEMO_NOW).getTime()
  const due = normalized.filter((version) => (version.status === 'EFFECTIVE' || version.status === 'SCHEDULED') && new Date(version.effectiveAt).getTime() <= now).sort((a, b) => b.effectiveAt.localeCompare(a.effectiveAt) || b.version.localeCompare(a.version))
  const currentId = due[0]?.id
  const transitioned = normalized.map((version) => {
    if (version.status === 'SCHEDULED' && version.id === currentId) return { ...version, status: 'EFFECTIVE' as const }
    if ((version.status === 'EFFECTIVE' || version.status === 'SCHEDULED') && version.id !== currentId && new Date(version.effectiveAt).getTime() <= now) return { ...version, status: 'SUPERSEDED' as const }
    return version
  })
  if (JSON.stringify(transitioned) !== JSON.stringify(normalized)) savePriceVersions(transitioned)
  return transitioned
}

export function savePriceVersions(value: PriceVersionRecord[]) {
  const stored = write(PLATFORM_SERVICE_KEYS.priceVersions, value)
  const now = new Date(DEMO_NOW).getTime()
  const active = value.filter((version) => version.status === 'SCHEDULED' || version.status === 'EFFECTIVE').sort((a, b) => a.effectiveAt.localeCompare(b.effectiveAt))
  const current = active.filter((version) => new Date(version.effectiveAt).getTime() <= now).sort((a, b) => b.effectiveAt.localeCompare(a.effectiveAt))
  const future = active.filter((version) => new Date(version.effectiveAt).getTime() > now)
  savePlans([...current, ...future].map(({ id: _id, packageName: _packageName, terms: _terms, effectiveMode: _effectiveMode, sourceNote: _sourceNote, status: _status, publishedAt: _publishedAt, withdrawnAt: _withdrawnAt, withdrawnReason: _withdrawnReason, ...plan }) => plan))
  return stored
}

export function savePublishedPrice(version: PriceVersionRecord) {
  const versions = loadPriceVersions()
  const next = versions.filter((entry) => entry.id !== version.id).map((entry) => version.status === 'EFFECTIVE' && entry.status === 'EFFECTIVE' ? { ...entry, status: 'SUPERSEDED' as const } : entry)
  return savePriceVersions([version, ...next])
}

export function money(value: number) { return `${value.toLocaleString('vi-VN')} đ` }
export { loadPaymentIntents }
