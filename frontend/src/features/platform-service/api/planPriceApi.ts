import { asRecord, backendMode, backendTransport, type BackendTransport } from '../../../api/backendTransport'
import { BackendError } from '../../../api/backendClient'
import { platformServiceDemoStore } from '../data/platformServiceDemoStore'
import { fmtDateTime } from '../domain/dates'
import type { PriceStatus } from '../types'

export interface PlanPrice {
  id: number; revision: number; price1y: number; price2y: number; price3y: number; effectiveAt: string; terms: string | null; status: PriceStatus
  publishedById: number | null; publishedBy: string | null; publishedAt: string | null; withdrawnBy: string | null; withdrawnAt: string | null; withdrawReason: string | null
}
export interface PlanPricePage { items: PlanPrice[]; total: number; page: number; size: number; asOf: string; current: PlanPrice | null; nextEffectiveAt: string | null }
export interface PublishPrice { price1y: number; price2y: number; price3y: number; applyNow: boolean; effectiveAt: string | null; terms: string | null }
const invalid = () => new Error('Dữ liệu bảng giá từ máy chủ không hợp lệ.')
const whole = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
const instant = (v: unknown): v is string => typeof v === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v))
const text = (v: unknown) => v === null || typeof v === 'string'
const nullableInstant = (v: unknown) => v === null || instant(v)
/**
 * Stored versions only need BR-D25 positive whole VND. The 1,000–1,000,000,000 range applies to new input (validPrice);
 * a legacy version published before that rule must not make SCR-63 unreadable.
 */
const storedPrice = (v: unknown) => whole(v) && v > 0
function price(value: unknown): PlanPrice {
  const p = asRecord(value)
  if (!whole(p.id) || p.id === 0 || !whole(p.revision) || ![p.price1y, p.price2y, p.price3y].every(storedPrice)
    || !instant(p.effectiveAt) || !text(p.terms) || !['SCHEDULED', 'EFFECTIVE', 'SUPERSEDED', 'WITHDRAWN'].includes(p.status as string)
    || !(p.publishedById === null || (whole(p.publishedById) && p.publishedById > 0)) || !text(p.publishedBy) || !nullableInstant(p.publishedAt)
    || !text(p.withdrawnBy) || !nullableInstant(p.withdrawnAt) || !text(p.withdrawReason)) throw invalid()
  return p as unknown as PlanPrice
}
function pricePage(value: unknown): PlanPricePage {
  const p = asRecord(value)
  if (!Array.isArray(p.items) || !whole(p.total) || !whole(p.page) || !whole(p.size) || p.size < 1 || p.size > 100 || p.items.length > p.size
    || !instant(p.asOf) || !nullableInstant(p.nextEffectiveAt)) throw invalid()
  const current = p.current === null ? null : price(p.current)
  if (current && current.status !== 'EFFECTIVE') throw invalid()
  return { items: p.items.map(price), total: p.total, page: p.page, size: p.size, asOf: p.asOf, current, nextEffectiveAt: p.nextEffectiveAt as string | null }
}
export function createPlanPriceApi(transport: BackendTransport) {
  return {
    async list(page = 0) { return pricePage(await transport.get(`/api/platform/plan-prices?${new URLSearchParams({ page: String(page), size: '20' })}`)) },
    async publish(body: PublishPrice, key: string) { return price(await transport.command('/api/platform/plan-prices', body, { method: 'POST', key })) },
    async withdraw(id: number, reason: string, expectedVersion: number, key: string) {
      return price(await transport.command(`/api/platform/plan-prices/${id}/withdraw`, { reason, expectedVersion }, { method: 'POST', key }))
    },
  }
}
export function priceError(error: unknown, action = 'công bố bảng giá') {
  if (!(error instanceof BackendError)) return error instanceof Error ? error.message : `Không thể ${action}. Vui lòng thử lại.`
  if (error.code === 'MSG-FE19-13') return 'Giá phải là số nguyên VND từ 1.000 đến 1.000.000.000.'
  if (error.code === 'MSG-FE19-14') return 'Thời điểm hiệu lực không được ở quá khứ.'
  if (error.code === 'MSG-FE19-15') {
    const time = typeof error.params.time === 'string' && instant(error.params.time) ? fmtDateTime(error.params.time) : 'thời điểm này'
    return `Phiên bản v${error.params.version ?? '—'} đã được lên lịch vào ${time}. Vui lòng chọn thời điểm khác.`
  }
  if (error.code === 'MSG-COM-05') return 'Phiên bản vừa thay đổi hoặc đã có hiệu lực. Dữ liệu đã được tải lại; vui lòng kiểm tra trước khi thao tác tiếp.'
  if (error.code === 'MSG-COM-06') return 'Vui lòng nhập đủ các trường bắt buộc.'
  if (error.code === 'MSG-COM-10') return error.params.field === 'terms' ? 'Mô tả điều khoản tối đa 500 ký tự.' : 'Giá trị nhập chưa hợp lệ.'
  if (error.code === 'MSG-COM-01' || error.status === 403) return 'Bạn không có quyền quản lý bảng giá.'
  if (error.status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
  if (error.code === 'MSG-COM-08' || error.status === 404) return 'Không tìm thấy phiên bản. Vui lòng tải lại.'
  return `Không thể ${action}. Vui lòng thử lại.`
}

/** Explicit local demo adapter. It is never used when backend mode is selected. */
const iso = (v: string) => new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(v) ? v : `${v}+07:00`).toISOString()
const demo = {
  async list(page = 0): Promise<PlanPricePage> {
    const versions = (await platformServiceDemoStore.listPriceVersions()).map(p => ({ id: p.version, revision: p.withdrawn ? 1 : 0,
      price1y: p.price1y, price2y: p.price2y, price3y: p.price3y, effectiveAt: iso(p.effectiveAt), terms: p.terms || null, status: p.status,
      publishedById: null, publishedBy: p.publishedBy, publishedAt: iso(p.publishedAt), withdrawnBy: null, withdrawnAt: null, withdrawReason: p.withdrawReason }))
      .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '') || b.id - a.id)
    return { items: versions.slice(page * 20, (page + 1) * 20), total: versions.length, page, size: 20, asOf: new Date().toISOString(),
      current: versions.find(v => v.status === 'EFFECTIVE') ?? null, nextEffectiveAt: versions.filter(v => v.status === 'SCHEDULED').map(v => v.effectiveAt).sort()[0] ?? null }
  },
  async publish(body: PublishPrice, _key: string) {
    const created = await platformServiceDemoStore.publishPrice({ ...body, mode: body.applyNow ? 'NOW' : 'SCHEDULE', terms: body.terms ?? '',
      effectiveAt: body.effectiveAt ? new Date(Date.parse(body.effectiveAt) + 7 * 3600_000).toISOString().slice(0, 19) : '' })
    return (await this.list()).items.find(v => v.id === created.version)!
  },
  async withdraw(id: number, reason: string, _revision: number, _key: string) {
    await platformServiceDemoStore.withdrawPrice(id, reason); return (await this.list()).items.find(v => v.id === id)!
  },
}
export const planPriceApi = backendMode === 'backend' ? createPlanPriceApi(backendTransport) : demo
