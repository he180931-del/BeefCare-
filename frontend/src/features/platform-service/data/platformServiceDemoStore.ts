import { PLATFORM_SERVICE_DEMO, PM_NAME, type PlatformServiceSeed } from './platformServiceMock'
import type {
  ChangeFarmCommand, ChangeOptions, Evidence, EvidenceFilters, FarmFilters, FarmListResult, FarmOverview, FarmServicePreview, FarmSort, LockCommand, PaymentFilters, PaymentTiles, PlatformFarm, PlatformPayment,
  PriceDraft, PriceVersionView, PublishPriceCommand, ReturnCommand, ReviewCommand, ReviewResult, SubscriptionDetail, SubscriptionFilters, SubscriptionRow, UnlockCommand,
} from '../types'
import { toDate, vnNow } from '../domain/dates'
import { blockReason, checkAcceptance, findCandidates } from '../domain/reconciliation'
import { STATUS_LABEL, coverageEnd, currentPeriod, deriveStatus, nextPeriod, periodState, renewalOpens, validateReason } from '../domain/servicePeriods'

const byName = (a: FarmOverview, b: FarmOverview) => a.farmName.localeCompare(b.farmName, 'vi', { sensitivity: 'base' })
/** Same order as `GET /api/platform/farms?sort=`: farms without a coverage end always come last. */
function sortFarms(rows: FarmOverview[], sort: FarmSort = 'name') {
  const descending = sort.startsWith('-')
  const key = descending ? sort.slice(1) : sort
  const direction = descending ? -1 : 1
  const compare = (a: FarmOverview, b: FarmOverview) => {
    if (key === 'coverageEnd') {
      if (a.coverageEnd === b.coverageEnd) return 0
      if (a.coverageEnd === null) return 1
      if (b.coverageEnd === null) return -1
      return direction * a.coverageEnd.localeCompare(b.coverageEnd)
    }
    return direction * (key === 'status' ? a.serviceStatus.localeCompare(b.serviceStatus) : byName(a, b))
  }
  return [...rows].sort((a, b) => compare(a, b) || byName(a, b) || a.farmId - b.farmId)
}
import { PRICE_ERROR, validPrice, validateEffective, withStatuses } from '../domain/pricing'

export const CHANGED = 'Bản ghi đã được thay đổi. Vui lòng tải lại và kiểm tra trước khi thử lại.'
const fail = (message: string): never => { throw new Error(message) }
const pad4 = (n: number) => String(n).padStart(4, '0')

export function createPlatformServiceDemoStore(seed: PlatformServiceSeed = PLATFORM_SERVICE_DEMO, now: () => string = () => vnNow()) {
  let s = structuredClone(seed)

  const farmOf = (id: number) => s.farms.find((f) => f.farmId === id) ?? fail('Không tìm thấy trại.')
  const evOf = (id: number) => s.evidence.find((e) => e.id === id) ?? fail('Không tìm thấy chứng từ.')
  const periodOf = (f: PlatformFarm) => currentPeriod(f.periods, toDate(now()))

  function overview(f: PlatformFarm): FarmOverview {
    const cur = periodOf(f)
    return {
      farmId: f.farmId, farmName: f.farmName, ownerName: f.ownerName, ownerEmail: f.ownerEmail, serviceStatus: f.serviceStatus, coverageEnd: coverageEnd(f.periods),
      suspended: f.suspended, suspendedSince: f.suspendedSince, suspendedBy: f.suspendedBy, suspendReason: f.suspendReason, herdSize: f.herdSize,
      periodStart: cur?.start ?? null, periodEnd: cur?.end ?? null, version: f.version,
    }
  }

  function changeService(id: number, mode: 'suspend' | 'restore', cmd: ChangeFarmCommand) {
    const f = farmOf(id)
    const err = validateReason(cmd.reason)
    if (err) fail(err)
    const target = mode === 'suspend'
    if (f.suspended === target) fail(`${f.farmName} đã ở trạng thái ${STATUS_LABEL[f.serviceStatus]}.`) // MSG-FE02-09
    if (cmd.version !== f.version) fail(CHANGED)
    f.suspended = target
    f.suspendedSince = target ? toDate(now()) : null
    f.suspendedBy = target ? PM_NAME : null
    f.suspendReason = target ? cmd.reason.trim() : null
    f.serviceStatus = deriveStatus(f.periods, target, toDate(now()))
    f.version += 1
    return structuredClone(overview(f))
  }

  function subscriptionRow(f: PlatformFarm): SubscriptionRow {
    const cur = periodOf(f)
    return {
      farmId: f.farmId, farmName: f.farmName, ownerName: f.ownerName, ownerEmail: f.ownerEmail, serviceStatus: f.serviceStatus, subscriptionCode: f.subscriptionCode,
      currentStart: cur?.start ?? null, currentEnd: cur?.end ?? null, confirmedUntil: coverageEnd(f.periods), paymentCodes: f.periods.map((p) => p.paymentCode),
    }
  }

  const inRange = (iso: string, from?: string, to?: string) => (!from || toDate(iso) >= from) && (!to || toDate(iso) <= to)

  return {
    async listFarms(filters: FarmFilters = {}): Promise<FarmListResult> {
      const q = (filters.q ?? '').trim().toLowerCase()
      const items = sortFarms(s.farms
        .filter((f) => !filters.status || f.serviceStatus === filters.status)
        .filter((f) => !q || [f.farmName, f.ownerEmail].some((t) => t.toLowerCase().includes(q)))
        .map(overview), filters.sort)
      const count = (st: string) => s.farms.filter((f) => f.serviceStatus === st).length
      const o = s.otherFarms
      const all = s.farms.length + o.active + o.pending + o.expired + o.suspended
      const active = o.active + count('ACTIVE')
      return structuredClone({
        items, total: items.length,
        tiles: { total: all, active, activePercent: all ? Math.round((active * 100) / all) : 0, pending: o.pending + count('PENDING_PAYMENT'), expired: o.expired + count('EXPIRED'), suspended: o.suspended + count('SUSPENDED') },
      })
    },
    async getFarmService(id: number): Promise<FarmServicePreview> {
      const f = farmOf(id)
      const cur = periodOf(f)
      return structuredClone({
        farmId: f.farmId, farmName: f.farmName, ownerName: f.ownerName, ownerEmail: f.ownerEmail, herdSize: f.herdSize, serviceStatus: f.serviceStatus,
        suspendedSince: f.suspendedSince, suspendedBy: f.suspendedBy, suspendReason: f.suspendReason,
        periodStart: cur?.start ?? null, periodEnd: cur?.end ?? null, coverageEnd: coverageEnd(f.periods),
        statusAfterRestore: deriveStatus(f.periods, false, toDate(now())), version: f.version,
      })
    },
    // `options` mirrors the backend call; the demo store has no request-key replay.
    async suspendFarm(id: number, cmd: ChangeFarmCommand, _options?: ChangeOptions) { return changeService(id, 'suspend', cmd) },
    async restoreFarm(id: number, cmd: ChangeFarmCommand, _options?: ChangeOptions) { return changeService(id, 'restore', cmd) },

    async listSubscriptions(filters: SubscriptionFilters = {}): Promise<SubscriptionRow[]> {
      const q = (filters.q ?? '').trim().toLowerCase()
      const rows = s.farms
        .filter((f) => !filters.status || f.serviceStatus === filters.status)
        .filter((f) => !q || [f.farmName, f.ownerName, f.subscriptionCode ?? '', ...f.periods.map((p) => p.paymentCode)].some((t) => t.toLowerCase().includes(q)))
        .map(subscriptionRow)
        .filter((r) => !(filters.endFrom || filters.endTo) || (r.confirmedUntil !== null && (!filters.endFrom || r.confirmedUntil >= filters.endFrom) && (!filters.endTo || r.confirmedUntil <= filters.endTo)))
      return structuredClone(rows)
    },
    async getSubscription(farmId: number): Promise<SubscriptionDetail> {
      const f = farmOf(farmId)
      const today = toDate(now())
      const periods = [...f.periods].sort((a, b) => a.start.localeCompare(b.start)).map((p) => ({ ...p, state: periodState(p, today) }))
      const end = coverageEnd(f.periods)
      return structuredClone({
        summary: subscriptionRow(f), suspended: f.suspended, suspendedSince: f.suspendedSince, renewalOpens: end ? renewalOpens(end) : null,
        latestPurchase: [...f.periods].sort((a, b) => b.confirmedAt.localeCompare(a.confirmedAt))[0] ?? null, periods,
        emptyMessage: f.periods.length === 0 ? 'Chưa có đăng ký nên chưa có kỳ hay ngày hết hạn.' : null,
      })
    },

    async paymentTiles(): Promise<PaymentTiles> {
      const b = s.tileBase
      return {
        unmatched: s.evidence.filter((e) => e.reviewStatus === 'TO_REVIEW' && e.matchResult !== 'EXACT_CODE').length,
        pendingRequests: b.pending + s.payments.filter((p) => p.state === 'PENDING').length,
        hold: b.hold + s.evidence.filter((e) => e.reviewStatus === 'HOLD' && !e.lockedForReturn).length,
        lockedForReturn: b.locked + s.evidence.filter((e) => e.lockedForReturn).length,
      }
    },
    async listEvidence(filters: EvidenceFilters = {}): Promise<Evidence[]> {
      const st = filters.status
      return structuredClone(
        s.evidence
          .filter((e) => !st || (st === 'LOCKED' ? e.lockedForReturn : !e.lockedForReturn && (st === 'ACCEPTED' ? e.reviewStatus === 'ACCEPTED' || e.reviewStatus === 'AUTO_CONFIRMED' : e.reviewStatus === st)))
          .filter((e) => inRange(e.bankPaidAt, filters.bankFrom, filters.bankTo))
          .sort((a, b) => b.bankPaidAt.localeCompare(a.bankPaidAt) || b.id - a.id),
      )
    },
    async getEvidence(id: number): Promise<Evidence> { return structuredClone(evOf(id)) },
    async listPayments(filters: PaymentFilters = {}): Promise<PlatformPayment[]> {
      const q = (filters.q ?? '').trim().toLowerCase()
      return structuredClone(
        s.payments
          .filter((p) => (!filters.state || p.state === filters.state) && (!q || p.code.toLowerCase().includes(q) || p.farmName.toLowerCase().includes(q)))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      )
    },
    async listCandidates(evidenceId: number): Promise<PlatformPayment[]> { return structuredClone(findCandidates(evOf(evidenceId), s.payments)) },

    async reviewEvidence(id: number, cmd: ReviewCommand): Promise<ReviewResult> {
      const e = evOf(id)
      const err = validateReason(cmd.reason, 'Lý do & bằng chứng', 1000)
      if (err) fail(err)
      if (cmd.version !== e.version) fail(CHANGED)
      if (e.lockedForReturn) fail('Chứng từ đã khóa chờ hoàn tiền, không thể đổi quyết định.')
      if (e.paymentId !== null) fail('Chứng từ đã được phân bổ cho một thanh toán.')
      const at = now()
      const reason = cmd.reason.trim()
      if (cmd.decision !== 'ACCEPT') {
        e.reviewStatus = cmd.decision === 'HOLD' ? 'HOLD' : 'REJECTED'
        Object.assign(e, { reviewReason: reason, reviewedBy: PM_NAME, reviewedAt: at })
        e.history.push({ at, by: PM_NAME, text: `${cmd.decision === 'HOLD' ? 'Tạm giữ' : 'Từ chối'}: ${reason}` })
        e.version += 1
        return structuredClone({ evidence: e, payment: null, period: null, receiptCode: null, confirmedAt: null })
      }
      const p = s.payments.find((x) => x.id === cmd.paymentId) ?? fail('Chọn một yêu cầu ứng viên để chấp nhận.')
      const blocked = blockReason(checkAcceptance(e, p, !!cmd.explicitSelection))
      if (blocked) fail(`Không thể chấp nhận chứng từ này: ${blocked}.`)
      const f = s.farms.find((x) => x.farmId === p.farmId)
      const period = nextPeriod(toDate(at), f ? coverageEnd(f.periods) : null, p.termYears)
      s.receiptSeq += 1
      const receiptCode = `RC-26-${pad4(s.receiptSeq)}`
      Object.assign(p, { state: 'PAID', evidenceId: e.id, receiptCode, confirmedAt: at, purchasedStart: period.start, purchasedEnd: period.end })
      Object.assign(e, { paymentId: p.id, reviewStatus: 'ACCEPTED', reviewReason: reason, reviewedBy: PM_NAME, reviewedAt: at })
      e.history.push({ at, by: PM_NAME, text: `Chấp nhận cho ${p.code}: ${reason}` })
      e.version += 1
      if (f) {
        f.periods.push({ paymentCode: p.code, receiptCode, termYears: p.termYears, start: period.start, end: period.end, confirmedAt: at })
        if (!f.subscriptionCode) f.subscriptionCode = `SUB-${pad4(60 + f.farmId)}`
        f.serviceStatus = deriveStatus(f.periods, f.suspended, toDate(at)) // thanh toán không gỡ tạm ngưng (GBR-15)
        f.version += 1
      }
      return structuredClone({ evidence: e, payment: p, period, receiptCode, confirmedAt: at })
    },
    async lockForReturn(id: number, cmd: LockCommand): Promise<Evidence> {
      const e = evOf(id)
      const err = validateReason(cmd.reason, 'Lý do khóa')
      if (err) fail(err)
      if (cmd.version !== e.version) fail(CHANGED)
      if (e.paymentId !== null) fail('Nguồn đã Chấp nhận không khóa hoàn ở đây.')
      if (e.lockedForReturn) fail('Chứng từ đã được khóa.')
      const at = now()
      Object.assign(e, { lockedForReturn: true, lockReason: cmd.reason.trim(), lockedBy: PM_NAME, lockedAt: at, lockReference: cmd.reference?.trim() || null })
      e.history.push({ at, by: PM_NAME, text: `Khóa chờ hoàn tiền: ${cmd.reason.trim()}` })
      e.version += 1
      return structuredClone(e)
    },
    async unlockReturn(id: number, cmd: UnlockCommand): Promise<Evidence> {
      const e = evOf(id)
      const err = validateReason(cmd.reason, 'Lý do mở khóa') ?? validateReason(cmd.verification, 'Xác minh chưa có khoản trả ra')
      if (err) fail(err)
      if (cmd.version !== e.version) fail(CHANGED)
      if (!e.lockedForReturn) fail('Chứng từ không ở trạng thái khóa.')
      if (e.returnResult) fail('Không mở khóa nguồn đã xác minh hoàn.')
      e.lockedForReturn = false
      e.history.push({ at: now(), by: PM_NAME, text: `Mở khóa (chưa hoàn): ${cmd.reason.trim()}` })
      e.version += 1
      return structuredClone(e)
    },
    async recordReturn(id: number, cmd: ReturnCommand): Promise<Evidence> {
      const e = evOf(id)
      const fields: Array<[string, string]> = [['Giao dịch trả ra', cmd.reference], ['Thời điểm trả ra', cmd.paidOutAt], ['Kết quả đã xác minh', cmd.result], ['Người xác minh / ghi chú', cmd.verifier]]
      const missing = fields.map(([label, value]) => validateReason(value, label)).find(Boolean)
      if (missing) fail(missing)
      if (cmd.version !== e.version) fail(CHANGED)
      if (!e.lockedForReturn) fail('Chỉ ghi nhận kết quả hoàn cho nguồn đã khóa.')
      e.returnReference = cmd.reference.trim()
      e.returnResult = `${cmd.result.trim()} · ${cmd.verifier.trim()} · ${cmd.paidOutAt}`
      e.history.push({ at: now(), by: PM_NAME, text: `Ghi nhận kết quả hoàn ${e.returnReference}` })
      e.version += 1
      return structuredClone(e)
    },

    async listPriceVersions(): Promise<PriceVersionView[]> { return structuredClone(withStatuses(s.priceVersions, now())) },
    async getPriceDraft(): Promise<PriceDraft> { return structuredClone(s.draft) },
    async savePriceDraft(draft: PriceDraft) { s.draft = structuredClone(draft) },
    async publishPrice(cmd: PublishPriceCommand): Promise<PriceVersionView> {
      if (![cmd.price1y, cmd.price2y, cmd.price3y].every(validPrice)) fail(PRICE_ERROR)
      const current = now()
      const err = validateEffective(cmd.mode, cmd.effectiveAt, current, s.priceVersions)
      if (err) fail(err)
      const effectiveAt = cmd.mode === 'NOW' ? current : cmd.effectiveAt.length === 16 ? `${cmd.effectiveAt}:00` : cmd.effectiveAt
      const version = Math.max(0, ...s.priceVersions.map((x) => x.version)) + 1
      s.priceVersions.push({ version, price1y: cmd.price1y, price2y: cmd.price2y, price3y: cmd.price3y, effectiveAt, terms: cmd.terms.trim(), publishedBy: PM_NAME, publishedAt: current, withdrawn: false, withdrawReason: null })
      const created = withStatuses(s.priceVersions, current).find((x) => x.version === version)
      return structuredClone(created ?? fail('Không công bố được phiên bản.'))
    },
    async withdrawPrice(version: number, reason: string) {
      const err = validateReason(reason)
      if (err) fail(err)
      const v = s.priceVersions.find((x) => x.version === version) ?? fail('Không tìm thấy phiên bản.')
      if (v.withdrawn || v.effectiveAt <= now()) fail('Chỉ rút lại được phiên bản đã lên lịch và chưa có hiệu lực.')
      v.withdrawn = true
      v.withdrawReason = reason.trim()
    },

    async reset() { s = structuredClone(seed) },
  }
}
export type PlatformServiceDemoStore = ReturnType<typeof createPlatformServiceDemoStore>
export const platformServiceDemoStore = createPlatformServiceDemoStore()
