import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { SessionContext, type Session } from '../../../src/features/authorization/sessionContext'
import { createPlatformServiceApi } from '../../../src/features/platform-service/api/platformServiceApi'
import { platformServiceDemoStore } from '../../../src/features/platform-service/data/platformServiceDemoStore'
import FarmServiceRoutes from '../../../src/features/platform-service/pages/FarmServiceRoutes'
import PlatformSubscriptionRoutes from '../../../src/features/platform-service/pages/PlatformSubscriptionRoutes'
import PaymentReconciliationRoutes from '../../../src/features/platform-service/pages/PaymentReconciliationRoutes'

const http = vi.hoisted(() => ({ get: vi.fn(), command: vi.fn(), farmPath: vi.fn() }))
vi.mock('../../../src/api/backendTransport', async (original) => ({
  ...await original<typeof import('../../../src/api/backendTransport')>(), backendMode: 'backend', backendFarmId: '42', backendTransport: http,
}))
const row = (id = 42) => ({ farmId: id, farmName: `Trại UC4 ${id}`, ownerName: 'Owner hiện tại', ownerEmail: 'owner@example.test',
  serviceStatus: 'SUSPENDED', currentStart: '2026-01-01T00:00:00Z', currentEnd: '2027-01-01T17:00:00Z',
  confirmedUntil: '2028-01-01T17:00:00Z', paymentCodes: ['BC-UC4-CURRENT', 'BC-UC4-FUTURE'] })
const current = { paymentId: 501, paymentCode: 'BC-UC4-CURRENT', receiptCode: 'RC-UC4', termYears: 1,
  start: '2026-01-01T00:00:00Z', end: '2027-01-01T17:00:00Z', confirmedAt: '2026-01-01T00:01:02Z', status: 'CURRENT' }
const future = { ...current, paymentId: 502, paymentCode: 'BC-UC4-FUTURE', start: current.end, end: '2028-01-01T17:00:00Z', confirmedAt: null, status: 'FUTURE' }
const detail = (id = 42) => ({ summary: row(id), subscriptionId: 88, suspended: true, suspendedSince: '2026-10-01T03:00:00Z',
  renewalOpens: '2027-10-03T17:00:00Z', latestPurchase: current, periods: [future, current], emptyMessage: null })
const pageOf = (items = [row()], page = 0, total = items.length) => ({ items, page, total, size: 20 })
const session: Session = { role: 'PM', fullName: 'PM test', email: 'uc4@example.test', farmId: null, farmName: null, logout: vi.fn() }
const calls = () => http.get.mock.calls.map(([path]) => String(path)).filter((path) => new URL(path, 'http://test').pathname === '/api/platform/subscriptions')
function CurrentLocation() { const location = useLocation(); return <output aria-label="Đường dẫn hiện tại">{location.pathname}{location.search}</output> }
function page(path = '/nen-tang/goi-dang-ky') {
  return render(<SessionContext.Provider value={session}><MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/nen-tang/dich-vu" element={<FarmServiceRoutes />} />
    <Route path="/nen-tang/goi-dang-ky" element={<PlatformSubscriptionRoutes />} />
    <Route path="/nen-tang/thanh-toan" element={<PaymentReconciliationRoutes />} />
  </Routes><CurrentLocation /></MemoryRouter></SessionContext.Provider>)
}

beforeEach(() => {
  sessionStorage.clear(); http.get.mockReset(); http.command.mockReset()
  vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-09T00:00:00Z'))
  http.get.mockImplementation(async (path: string) => {
    const url = new URL(path, 'http://test')
    if (url.pathname === '/api/platform/farms') return {
      tiles: { total: 2, active: 1, activePercent: 50, pendingPayment: 1, expired: 0, suspended: 0 },
      items: [
        { farmId: 42, farmName: 'Trại UC4 42', ownerName: 'Owner 42', ownerEmail: 'owner42@example.test', serviceStatus: 'ACTIVE', coverageEnd: current.end, suspended: false, suspendedAt: null, activeCattle: 12, version: 1 },
        { farmId: 43, farmName: 'Trại UC4 43', ownerName: 'Owner 43', ownerEmail: 'owner43@example.test', serviceStatus: 'PENDING_PAYMENT', coverageEnd: null, suspended: false, suspendedAt: null, activeCattle: 0, version: 1 },
      ], total: 2,
    }
    if (url.pathname === '/api/platform/subscriptions') return pageOf()
    if (url.pathname.startsWith('/api/platform/subscriptions/')) return detail(Number(url.pathname.split('/').at(-1)))
    if (url.pathname === '/api/platform/payments/502') return { id: 502, farmId: 42, farmName: row().farmName, quoteRef: future.paymentCode,
      termYears: 1, amount: 1_200_000, state: 'PAID', requestedAt: '2026-10-01T00:00:00Z', expiresAt: '2026-10-02T00:00:00Z',
      purchasedStart: future.start, purchasedEnd: future.end, receiptCode: future.receiptCode, requestedByEmail: 'previous@example.test', priceVersionId: 7 }
    throw new Error(`Unexpected endpoint ${url.pathname}`)
  })
  vi.spyOn(platformServiceDemoStore, 'listSubscriptions').mockImplementation(() => { throw new Error('No demo fallback') })
  vi.spyOn(platformServiceDemoStore, 'getSubscription').mockImplementation(() => { throw new Error('No demo fallback') })
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers() })

describe('UC4 backend adapter and SCR-61', () => {
  it('opens the subscription page for the farm selected on that service row', async () => {
    page('/nen-tang/dich-vu')
    const farm42 = (await screen.findByText('Trại UC4 42')).closest('tr') as HTMLElement
    const farm43 = screen.getByText('Trại UC4 43').closest('tr') as HTMLElement

    expect(within(farm42).getByRole('link', { name: 'Xem gói' })).toHaveAttribute('href', '/nen-tang/goi-dang-ky?farmId=42')
    expect(within(farm43).getByRole('link', { name: 'Xem gói' })).toHaveAttribute('href', '/nen-tang/goi-dang-ky?farmId=43')
  })

  it('SCR-12 shows 20 farms a page with the shared pager and asks the server for the next page (UI review E6)', async () => {
    const base = http.get.getMockImplementation()!
    http.get.mockImplementation(async (path: string) => {
      const url = new URL(path, 'http://test')
      if (url.pathname !== '/api/platform/farms') return base(path)
      const first = await base(path) as { items: unknown[] }
      return { ...first, total: 45 }
    })
    page('/nen-tang/dich-vu')
    expect(await screen.findByText('Hiển thị 1–2 trong 45 trại')).toBeInTheDocument()
    const farmCalls = () => http.get.mock.calls.map(([p]) => new URL(String(p), 'http://test')).filter((u) => u.pathname === '/api/platform/farms')
    expect(farmCalls().at(-1)!.searchParams.get('size')).toBe('20')
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }))
    await waitFor(() => expect(farmCalls().at(-1)!.searchParams.get('page')).toBe('1'))
  })

  it('opens the subscription page when clicking the non-control area of a farm service row', async () => {
    page('/nen-tang/dich-vu')
    const farm43 = (await screen.findByText('Trại UC4 43')).closest('tr') as HTMLElement
    fireEvent.click(farm43)
    expect(screen.getByLabelText('Đường dẫn hiện tại')).toHaveTextContent('/nen-tang/goi-dang-ky?farmId=43')
  })

  it('selects a subscription when clicking anywhere on its row', async () => {
    http.get.mockResolvedValueOnce(pageOf([row(), row(43)]))
    page()
    const farm43 = (await screen.findByText('Trại UC4 43')).closest('tr') as HTMLElement
    fireEvent.click(farm43)
    expect(screen.getByRole('button', { name: /Trại UC4 43/ })).toHaveAttribute('aria-current', 'true')
  })

  it('scrolls to the detail under the list on screens narrower than 1280 px when the PM picks a farm (UI review B3)', async () => {
    const scrolled: Element[] = []
    const original = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = function scrollIntoView(this: Element) { scrolled.push(this) }
    try {
      http.get.mockResolvedValueOnce(pageOf([row(), row(43)]))
      page()
      await screen.findByRole('region', { name: 'Gói của Trại UC4 42' })
      fireEvent.click(screen.getByText('Trại UC4 43').closest('tr') as HTMLElement)
      await waitFor(() => expect(scrolled.map((el) => el.getAttribute('aria-label'))).toContain('Gói của Trại UC4 43'))
      // The farm selected automatically when the list first loads is not scrolled to.
      expect(scrolled.map((el) => el.getAttribute('aria-label'))).not.toContain('Gói của Trại UC4 42')
    } finally { Element.prototype.scrollIntoView = original }
  })

  it('sends all filters and real paging to the existing API, preserving instants and nullable confirmation', async () => {
    const api = createPlatformServiceApi({ mode: 'backend', farmId: 42, transport: http, store: platformServiceDemoStore })
    const result = await api.listSubscriptions({ q: ' PAIDcode ', coverage: 'NONE', status: 'EXPIRED', endFrom: '2026-01-01', endTo: '2026-01-02', dir: 'asc', page: 2 })
    expect(Object.fromEntries(new URL(calls()[0], 'http://test').searchParams)).toEqual({ q: 'PAIDcode', coverage: 'NONE', serviceStatus: 'EXPIRED',
      endFrom: '2026-01-01', endTo: '2026-01-02', sort: 'confirmedUntil', dir: 'asc', page: '2', size: '20' })
    expect(result.items[0].confirmedUntil).toBe(row().confirmedUntil)
    http.get.mockResolvedValueOnce({ items: [{ ...row(), ownerName: null, ownerEmail: null }], page: 0, total: 1, size: 20 })
    expect((await api.listSubscriptions()).items[0]).toMatchObject({ ownerName: null, ownerEmail: null })
    const value = await api.getSubscription(42)
    expect(value.periods.find((p) => p.paymentId === 502)).toMatchObject({ confirmedAt: null, state: 'FUTURE', start: future.start, end: future.end })
    expect(platformServiceDemoStore.listSubscriptions).not.toHaveBeenCalled()
    expect(platformServiceDemoStore.getSubscription).not.toHaveBeenCalled()
  })

  it('labels each period with the server read-clock status even when the browser clock is skewed', async () => {
    vi.mocked(Date.now).mockReturnValue(Date.parse('2030-01-01T00:00:00Z')) // by the browser clock every period would look past
    const api = createPlatformServiceApi({ mode: 'backend', farmId: 42, transport: http, store: platformServiceDemoStore })
    const value = await api.getSubscription(42)
    expect(value.periods.map((p) => [p.paymentId, p.state])).toEqual([[502, 'FUTURE'], [501, 'CURRENT']])
    expect(value.latestPurchase).toMatchObject({ paymentId: 501, state: 'CURRENT' })
    http.get.mockResolvedValueOnce({ ...detail(), periods: [{ ...current, status: undefined }] })
    await expect(api.getSubscription(42)).rejects.toThrow(/không đầy đủ|không hợp lệ/)
    http.get.mockResolvedValueOnce({ ...detail(), periods: [{ ...current, status: 'ENDED' }] })
    await expect(api.getSubscription(42)).rejects.toThrow(/không đầy đủ|không hợp lệ/)
  })

  it('moves a restored page that no longer exists to the last page instead of reporting no matches', async () => {
    sessionStorage.setItem('beefcare:platform-subscriptions:uc4@example.test', JSON.stringify({
      filters: { q: '', coverage: 'CURRENT', status: '', endFrom: '', endTo: '', dir: 'desc', page: 3 }, farmId: 42 }))
    http.get.mockImplementation(async (path: string) => {
      const url = new URL(path, 'http://test')
      if (url.pathname === '/api/platform/subscriptions') {
        const requested = Number(url.searchParams.get('page'))
        return requested === 0 ? pageOf([row()], 0, 15) : pageOf([], requested, 15)
      }
      return detail(Number(url.pathname.split('/').at(-1)))
    })
    page()
    await screen.findByRole('button', { name: /Trại UC4 42/ })
    expect(calls().map((path) => new URL(path, 'http://test').searchParams.get('page'))).toEqual(['3', '0'])
    expect(calls().at(-1)).toContain('coverage=CURRENT')
    expect(screen.queryByText('Không có trại phù hợp')).not.toBeInTheDocument()
    expect(screen.getByText('Hiển thị 1–1 trong 15 trại')).toBeInTheDocument()
  })

  it('selects an actual returned farm, shows suspension and each source link without a made-up subscription code', async () => {
    page()
    await screen.findByRole('button', { name: /Trại UC4 42/ })
    await screen.findByRole('link', { name: 'Xem thanh toán nguồn BC-UC4-FUTURE' })
    expect(http.get.mock.calls.some(([path]) => String(path).endsWith('/subscriptions/1'))).toBe(false)
    expect(screen.getByText(/tạm ngưng từ 01\/10\/2026/)).toBeInTheDocument()
    expect(screen.queryByText(/SUB-/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Xem thanh toán nguồn BC-UC4-FUTURE' })).toHaveAttribute('href', '/nen-tang/thanh-toan?paymentId=502&farmId=42')
    expect(http.command).not.toHaveBeenCalled()
  })

  it('names each date filter by its own label and marks the selected farm for assistive technology', async () => {
    http.get.mockResolvedValueOnce(pageOf([row(), row(43)]))
    page()
    await screen.findByRole('button', { name: /Trại UC4 43/ })
    expect(screen.getByLabelText('Xác nhận đến từ ngày')).toHaveAccessibleName('Xác nhận đến từ ngày')
    expect(screen.getByLabelText('Xác nhận đến ngày')).toHaveAccessibleName('Xác nhận đến ngày')
    expect(screen.getByRole('button', { name: /Trại UC4 42/ })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: /Trại UC4 43/ })).not.toHaveAttribute('aria-current')
    expect(document.querySelector('tr[aria-selected]')).toBeNull()
  })

  it('validates dates inline without HTTP and keeps the last valid table', async () => {
    page()
    await screen.findByRole('button', { name: /Trại UC4 42/ })
    fireEvent.change(screen.getByLabelText('Xác nhận đến từ ngày'), { target: { value: '2027-01-02' } })
    await waitFor(() => expect(calls().at(-1)).toContain('endFrom=2027-01-02'))
    const count = calls().length
    fireEvent.change(screen.getByLabelText('Xác nhận đến ngày'), { target: { value: '2027-01-01' } })
    expect(await screen.findByRole('alert')).toHaveTextContent('Ngày bắt đầu không được sau ngày kết thúc')
    expect(screen.getByRole('button', { name: /Trại UC4 42/ })).toBeInTheDocument()
    expect(calls()).toHaveLength(count)
  })

  it('filters coverage, sorts and pages on the server; resets paging when filters change', async () => {
    http.get.mockImplementation(async (path: string) => {
      const url = new URL(path, 'http://test')
      if (url.pathname.endsWith('/subscriptions')) return pageOf([row(url.searchParams.get('page') === '1' ? 43 : 42)], Number(url.searchParams.get('page') ?? 0), 21)
      return detail(Number(url.pathname.split('/').at(-1)))
    })
    page()
    await screen.findByRole('button', { name: /Trại UC4 42/ })
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }))
    await screen.findByRole('button', { name: /Trại UC4 43/ })
    fireEvent.change(screen.getByLabelText('Bao phủ'), { target: { value: 'NONE' } })
    await waitFor(() => expect(calls().at(-1)).toContain('coverage=NONE'))
    expect(new URL(calls().at(-1)!, 'http://test').searchParams.get('page')).toBe('0')
    fireEvent.click(screen.getByRole('button', { name: 'Sắp xếp theo Xác nhận đến' }))
    await waitFor(() => expect(calls().at(-1)).toContain('dir=asc'))
    const count = calls().length
    fireEvent.click(screen.getByRole('button', { name: 'Làm mới' }))
    await waitFor(() => expect(calls().length).toBeGreaterThan(count))
  })

  it('debounces searching and retains the old table while loading the next response', async () => {
    page()
    await screen.findByRole('button', { name: /Trại UC4 42/ })
    const search = screen.getByLabelText('Tìm tên trại hoặc mã thanh toán')
    for (const value of ['B', 'BC', 'BC-X']) fireEvent.change(search, { target: { value } })
    await waitFor(() => expect(calls().at(-1)).toContain('q=BC-X'))
    expect(calls().filter((path) => /[?&]q=/.test(path))).toHaveLength(1)
    let release!: (value: unknown) => void
    const original = http.get.getMockImplementation()!
    http.get.mockImplementation((path: string) => new URL(path, 'http://test').pathname === '/api/platform/subscriptions'
      ? new Promise((resolve) => { release = resolve }) : original(path))
    fireEvent.click(screen.getByRole('button', { name: 'Làm mới' }))
    await waitFor(() => expect(screen.getByRole('button', { name: /Trại UC4 42/ }).closest('[aria-busy]')).toHaveAttribute('aria-busy', 'true'))
    await act(async () => { release(pageOf([row(43)])) })
    await screen.findByRole('button', { name: /Trại UC4 43/ })
  })

  it('opens the exact source read-only, then reloads SCR-61 with its filters and farm selection', async () => {
    page()
    fireEvent.change(await screen.findByLabelText('Tìm tên trại hoặc mã thanh toán'), { target: { value: 'UC4' } })
    await waitFor(() => expect(calls().at(-1)).toContain('q=UC4'))
    fireEvent.click(await screen.findByRole('link', { name: 'Xem thanh toán nguồn BC-UC4-FUTURE' }))
    const region = await screen.findByRole('region', { name: 'Thanh toán nguồn' })
    expect(within(region).getByText('BC-UC4-FUTURE')).toBeInTheDocument()
    expect(within(region).getByText('1.200.000 đ')).toBeInTheDocument()
    expect(http.get.mock.calls.some(([path]) => path === '/api/platform/payments/502')).toBe(true)
    const count = calls().length
    fireEvent.click(screen.getByRole('link', { name: 'Quay lại gói của trại' }))
    expect(await screen.findByLabelText('Tìm tên trại hoặc mã thanh toán')).toHaveValue('UC4')
    await waitFor(() => expect(calls().length).toBeGreaterThan(count))
    expect(calls().at(-1)).toContain('q=UC4')
    expect(http.command).not.toHaveBeenCalled()
  })

  it('does not keep showing a previous farm detail while a newly selected farm loads', async () => {
    http.get.mockResolvedValueOnce(pageOf([row(), row(43)]))
    page()
    await screen.findByRole('link', { name: 'Xem thanh toán nguồn BC-UC4-CURRENT' })
    let release!: (value: unknown) => void
    http.get.mockImplementationOnce(() => new Promise((resolve) => { release = resolve }))
    fireEvent.click(screen.getByRole('button', { name: /Trại UC4 43/ }))
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Xem thanh toán nguồn BC-UC4-CURRENT' })).not.toBeInTheDocument())
    await act(async () => { release(detail(43)) })
    expect(await screen.findByRole('link', { name: 'Xem thanh toán nguồn BC-UC4-CURRENT' })).toHaveAttribute('href', '/nen-tang/thanh-toan?paymentId=501&farmId=43')
  })

  it('rejects malformed responses and shows retry/clear filters without falling back to demo', async () => {
    http.get.mockResolvedValueOnce({ unexpected: true })
    page()
    expect(await screen.findByText(/không đầy đủ|không hợp lệ/)).toBeInTheDocument()
    http.get.mockResolvedValueOnce(pageOf([]))
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByText('Không có trại phù hợp')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xóa bộ lọc' })).toBeInTheDocument()
    expect(platformServiceDemoStore.listSubscriptions).not.toHaveBeenCalled()
  })
})
