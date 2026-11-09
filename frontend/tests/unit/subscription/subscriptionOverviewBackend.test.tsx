import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter } from 'react-router-dom'
import type { BackendTransport } from '../../../src/api/backendTransport'
import { SessionContext, type Session } from '../../../src/features/authorization/sessionContext'
import { createSubscriptionApi } from '../../../src/features/subscription/api/subscriptionApi'
import { subscriptionDemoStore } from '../../../src/features/subscription/data/subscriptionDemoStore'
import SubscriptionHomePage from '../../../src/features/subscription/pages/SubscriptionHomePage'
import SubscriptionRoutes from '../../../src/features/subscription/pages/SubscriptionRoutes'
import type { Payment, SubscriptionOverview } from '../../../src/features/subscription/types'

const http = vi.hoisted(() => ({ get: vi.fn(), command: vi.fn(), farmPath: (id: string | number, suffix = '') => `/api/farms/${id}${suffix}` }))
vi.mock('../../../src/api/backendTransport', async (original) => ({
  ...await original<typeof import('../../../src/api/backendTransport')>(),
  backendMode: 'backend', backendFarmId: '42', backendTransport: http,
}))

const period = { paymentCode: 'BC-PAID', durationYears: 1 as const, amountVnd: 1_200_000,
  start: '2026-01-01T00:00:00Z', end: '2027-01-01T00:00:00Z', status: 'CURRENT' as const }
const pending: Payment = { id: 501, quoteRef: 'BC-PENDING', durationYears: 2, amountVnd: 2_160_000, state: 'PENDING',
  requestedAt: '2026-12-31T01:00:00Z', expiresAt: '2027-01-01T01:00:00Z', priceVersionId: 7,
  bankCode: 'TESTBANK', accountNumber: 'TEST-ACCOUNT', accountName: 'TEST RECIPIENT' }
const overview = (changes: Partial<SubscriptionOverview> = {}): SubscriptionOverview => ({
  farmId: 42, farmName: 'Trại từ API 42', serviceStatus: 'ACTIVE', latestEnd: period.end, entitlementStatus: 'CURRENT',
  currentPrices: { id: 7, price1y: 1_200_000, price2y: 2_160_000, price3y: 3_060_000, effectiveAt: '2026-01-01T00:00:00Z' },
  pendingPayment: pending, renewalOpensAt: '2026-10-03T00:00:00Z', suspended: false, suspendedSince: null,
  currentPeriod: period, daysRemaining: 0, futurePeriods: [], periods: [period], eligibility: { ok: true }, ...changes,
})
const session: Session = { role: 'OWNER', fullName: 'Test Owner', email: 'owner@example.test', farmId: 42, farmName: 'Trại từ API 42', logout: vi.fn() }
const api = (transport: BackendTransport = http) => createSubscriptionApi({ mode: 'backend', farmId: 42, transport, store: subscriptionDemoStore })
function page(path = '/goi-dich-vu', children = <SubscriptionHomePage />) {
  return render(<SessionContext.Provider value={session}><MemoryRouter initialEntries={[path]}>{children}</MemoryRouter></SessionContext.Provider>)
}

beforeEach(() => {
  http.get.mockReset()
  http.command.mockReset()
  vi.spyOn(subscriptionDemoStore, 'getOverview').mockImplementation(() => { throw new Error('backend must not read the demo store') })
})

describe('UC-FE19-01 backend adapter and SCR-57', () => {
  it('reads the requested farm and preserves all SCR-57 data without a demo fallback', async () => {
    const payload = overview()
    http.get.mockResolvedValue(payload)
    expect(await api().getOverview(42)).toEqual(payload)
    expect(http.get).toHaveBeenCalledWith('/api/farms/42/subscription')
    expect(subscriptionDemoStore.getOverview).not.toHaveBeenCalled()
    expect(http.command).not.toHaveBeenCalled()
  })

  it('propagates HTTP permission and missing-route failures without substituting local data', async () => {
    for (const status of [401, 403, 404]) {
      const error = Object.assign(new Error('Request failed'), { status })
      http.get.mockRejectedValueOnce(error)
      await expect(api().getOverview(42)).rejects.toBe(error)
    }
    expect(subscriptionDemoStore.getOverview).not.toHaveBeenCalled()
  })

  it('reads an existing pending instruction by its backend ID and preserves the bank snapshot', async () => {
    http.get.mockResolvedValue(pending)
    expect(await api().getPayment(42, '501')).toEqual(pending)
    expect(http.get).toHaveBeenCalledWith('/api/farms/42/subscription/payments/501')
    expect(http.command).not.toHaveBeenCalled()
  })

  it('represents a missing legacy bank snapshot as absent instead of substituting demo account data', async () => {
    http.get.mockResolvedValue({ ...overview(), pendingPayment: { ...pending, bankCode: null, accountNumber: null, accountName: null } })
    const result = await api().getOverview(42)
    expect(result.pendingPayment).toMatchObject({ id: 501, quoteRef: 'BC-PENDING', bankCode: '', accountNumber: '', accountName: '' })
    expect(subscriptionDemoStore.getOverview).not.toHaveBeenCalled()
  })

  it('rejects an incomplete overview instead of inventing empty fields', async () => {
    const { periods: missingPeriods, ...incomplete } = overview()
    void missingPeriods
    http.get.mockResolvedValue(incomplete)
    await expect(api().getOverview(42)).rejects.toThrow(/không đầy đủ/)
    expect(subscriptionDemoStore.getOverview).not.toHaveBeenCalled()
  })

  it('shows a fetch error and recovers with the retry button', async () => {
    http.get.mockRejectedValueOnce(new Error('API unavailable')).mockResolvedValue(overview())
    page()
    const retry = await screen.findByRole('button', { name: 'Thử lại' })
    expect(screen.queryByText('BC-PAID')).not.toBeInTheDocument()
    await userEvent.click(retry)
    expect(await screen.findByText('BC-PAID')).toBeInTheDocument()
    expect(http.get).toHaveBeenCalledTimes(2)
  })

  it('uses the selected backend farm rather than the demo default and renders the confirmed data', async () => {
    http.get.mockResolvedValue(overview())
    page()
    expect(await screen.findByText('0 ngày')).toBeInTheDocument()
    expect(http.get).toHaveBeenCalledWith('/api/farms/42/subscription')
    expect(screen.getByText('BC-PAID')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Mở hướng dẫn' })).toHaveAttribute('href', '/goi-dich-vu/chuyen-khoan/501?from=subscription&farm=42')
    expect(screen.getByRole('button', { name: 'Gia hạn gói' })).toBeEnabled()
  })

  it('prefers the authenticated farm context to the configured fallback ID', async () => {
    http.get.mockResolvedValue(overview({ farmId: 77, farmName: 'Trại đang chọn 77' }))
    render(<SessionContext.Provider value={{ ...session, farmId: 77, farmName: 'Trại đang chọn 77' }}>
      <MemoryRouter><SubscriptionHomePage /></MemoryRouter>
    </SessionContext.Provider>)
    expect(await screen.findByText('0 ngày')).toBeInTheDocument()
    expect(http.get).toHaveBeenCalledWith('/api/farms/77/subscription')
  })

  it('shows the exact confirmed end date used for renewal, even when the boundary is midnight in Vietnam', async () => {
    const midnightEnd = '2027-01-01T17:00:00Z' // 02/01/2027 00:00 in Asia/Ho_Chi_Minh
    const current = { ...period, end: midnightEnd }
    http.get.mockResolvedValue(overview({ latestEnd: midnightEnd, currentPeriod: current, periods: [current], renewalOpensAt: '2026-10-03T17:00:00Z' }))
    page()
    expect(await screen.findByText('0 ngày')).toBeInTheDocument()
    expect(screen.getByText('02/01/2027', { selector: 'dd' })).toBeInTheDocument()
    expect(screen.getByText('04/10/2026', { selector: 'dd' })).toBeInTheDocument()
  })

  it('retains service information when prices are missing and retries the API', async () => {
    http.get.mockResolvedValueOnce(overview({ currentPrices: null, eligibility: { ok: false, reason: 'PRICE_UNAVAILABLE' } }))
      .mockResolvedValue(overview())
    page()
    expect(await screen.findByText('Hiện chưa lấy được bảng giá gói.')).toBeInTheDocument()
    expect(screen.getByText('0 ngày')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Gia hạn gói' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    await waitFor(() => expect(screen.queryByText('Hiện chưa lấy được bảng giá gói.')).not.toBeInTheDocument())
    expect(http.get).toHaveBeenCalledTimes(2)
  })

  it('shows the empty farm without fabricated periods and keeps activation navigation', async () => {
    http.get.mockResolvedValue(overview({ serviceStatus: 'PENDING_PAYMENT', latestEnd: null, renewalOpensAt: null,
      currentPeriod: null, daysRemaining: null, pendingPayment: null, periods: [], entitlementStatus: 'NONE' }))
    page()
    expect(await screen.findByText('Chưa có kỳ dịch vụ nào')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Thanh toán để kích hoạt' })).toBeEnabled()
    expect(screen.queryByRole('link', { name: 'Mở hướng dẫn' })).not.toBeInTheDocument()
    expect(screen.queryByText('0 ngày')).not.toBeInTheDocument()
    expect(http.command).not.toHaveBeenCalled()
  })

  it('preserves the day count while suspended and offers support', async () => {
    http.get.mockResolvedValue(overview({ suspended: true, suspendedSince: '2026-12-30T00:00:00Z',
      serviceStatus: 'SUSPENDED', eligibility: { ok: false, reason: 'SUSPENDED' } }))
    page()
    expect(await screen.findByText('0 ngày')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Gia hạn gói' })).toBeDisabled()
    expect(screen.getByRole('link', { name: 'Gửi yêu cầu hỗ trợ' })).toHaveAttribute('href', '/ho-tro?farm=42')
    expect(screen.getByRole('link', { name: 'Mở hướng dẫn' })).toBeInTheDocument()
  })

  it('does not apply demo query parameters to the backend result', async () => {
    http.get.mockResolvedValue(overview())
    page('/goi-dich-vu?demo=price-unavailable')
    expect(await screen.findByText('0 ngày')).toBeInTheDocument()
    expect(screen.queryByText('Hiện chưa lấy được bảng giá gói.')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Gia hạn gói' })).toBeEnabled()
  })

  it('removes the previous farm while loading another farm and ignores delayed old results', async () => {
    let finish!: (data: SubscriptionOverview) => void
    http.get.mockResolvedValueOnce(overview()).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
    page('/goi-dich-vu', <><Link to="/goi-dich-vu?farm=43">Xem trại khác</Link><SubscriptionHomePage /></>)
    await screen.findByText('BC-PAID')
    await userEvent.click(screen.getByRole('link', { name: 'Xem trại khác' }))
    expect(screen.queryByText('BC-PAID')).not.toBeInTheDocument()
    await waitFor(() => expect(http.get).toHaveBeenCalledWith('/api/farms/43/subscription'))
    finish(overview({ farmId: 43, farmName: 'Trại từ API 43' }))
    expect(await screen.findByText('Trại từ API 43')).toBeInTheDocument()
  })

  it('rejects a response for the wrong farm rather than rendering it', async () => {
    http.get.mockResolvedValue(overview({ farmId: 99 }))
    await expect(api().getOverview(42)).rejects.toThrow()
  })

  it('does not fetch subscription data for a Manager', async () => {
    render(<SessionContext.Provider value={{ ...session, role: 'MANAGER' }}><MemoryRouter><SubscriptionRoutes /></MemoryRouter></SessionContext.Provider>)
    expect(screen.getByText('Bạn không có quyền thực hiện thao tác này.')).toBeInTheDocument()
    expect(http.get).not.toHaveBeenCalled()
  })
})
