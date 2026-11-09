import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { BackendError } from '../../../src/api/backendClient'
import { SessionContext, type Session } from '../../../src/features/authorization/sessionContext'
import { createSubscriptionApi } from '../../../src/features/subscription/api/subscriptionApi'
import { subscriptionDemoStore } from '../../../src/features/subscription/data/subscriptionDemoStore'
import FirstSubscriptionPage from '../../../src/features/subscription/pages/FirstSubscriptionPage'
import SubscriptionRoutes from '../../../src/features/subscription/pages/SubscriptionRoutes'
import type { Payment, SubscriptionOverview } from '../../../src/features/subscription/types'

const http = vi.hoisted(() => ({ get: vi.fn(), command: vi.fn(), farmPath: (id: string | number, suffix = '') => `/api/farms/${id}${suffix}` }))
vi.mock('../../../src/api/backendTransport', async (original) => ({
  ...await original<typeof import('../../../src/api/backendTransport')>(), backendMode: 'backend', backendFarmId: '42', backendTransport: http,
}))
const NOW = Date.parse('2026-11-09T03:00:00Z')
const pending: Payment = { id: 501, quoteRef: 'BC-UC02', durationYears: 1, amountVnd: 1_200_000, state: 'PENDING',
  requestedAt: new Date(NOW).toISOString(), expiresAt: new Date(NOW + 86_400_000).toISOString(), priceVersionId: 7,
  bankCode: 'TESTBANK', accountNumber: 'TEST-ACCOUNT', accountName: 'TEST RECIPIENT',
  qrImageUrl: 'https://qr.sepay.vn/img?acc=TEST-ACCOUNT&bank=TESTBANK&amount=1200000&des=BC-UC02',
  bankPaidAt: null, receivedAt: null, confirmedAt: null }
const overview: SubscriptionOverview = { farmId: 42, farmName: 'Trại thật 42', serviceStatus: 'PENDING_PAYMENT', latestEnd: null,
  entitlementStatus: 'NONE', currentPrices: { id: 7, price1y: 1_200_000, price2y: 2_160_000, price3y: 3_060_000, effectiveAt: '2026-01-01T00:00:00Z' },
  pendingPayment: null, renewalOpensAt: null, suspended: false, suspendedSince: null, currentPeriod: null,
  daysRemaining: null, futurePeriods: [], periods: [], eligibility: { ok: true } }
const session: Session = { role: 'OWNER', fullName: 'Test Owner', email: 'owner@example.test', farmId: 42, farmName: overview.farmName, logout: vi.fn() }
function Where() { const l = useLocation(); return <output data-testid="where">{l.pathname}{l.search}</output> }
function page(path = '/goi-dich-vu/chuyen-khoan/501?farm=42') {
  return render(<SessionContext.Provider value={session}><MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/dang-ky-goi" element={<FirstSubscriptionPage />} />
    <Route path="/goi-dich-vu/*" element={<SubscriptionRoutes />} />
    <Route path="*" element={<div>Destination</div>} />
  </Routes><Link to="/goi-dich-vu/chuyen-khoan/502?farm=42">Another request</Link><Where /></MemoryRouter></SessionContext.Provider>)
}
beforeEach(() => {
  http.get.mockReset(); http.command.mockReset()
  http.get.mockImplementation(async (path: string) => path.endsWith('/subscription') ? overview : pending)
  vi.spyOn(subscriptionDemoStore, 'getOverview').mockImplementation(() => { throw new Error('No demo fallback') })
})
afterEach(() => { cleanup(); vi.useRealTimers() })

describe('UC2 backend contract and forms', () => {
  it('posts the reviewed price and retains all real progress fields', async () => {
    const api = createSubscriptionApi({ mode: 'backend', farmId: 42, transport: http, store: subscriptionDemoStore })
    const payment = { ...pending, receivedAt: '2026-11-09T03:00:10Z', reopened: false }
    http.command.mockResolvedValue(payment)
    expect(await api.createPayment(42, { durationYears: 1, expectedPriceVersionId: 7 })).toEqual(payment)
    expect(http.command).toHaveBeenCalledWith('/api/farms/42/subscription/payments',
      { durationYears: 1, reviewedPriceVersion: 7 }, expect.any(Object))
    expect(subscriptionDemoStore.getOverview).not.toHaveBeenCalled()
  })

  it('requires an explicit term and shows the estimated first period and all plan terms', async () => {
    page('/dang-ky-goi?farm=42')
    const create = await screen.findByRole('button', { name: 'Tạo yêu cầu thanh toán' })
    expect(create).toBeDisabled()
    fireEvent.click(screen.getByRole('radio', { name: /2 năm/ }))
    expect(create).toBeEnabled()
    expect(screen.getByText('Kỳ dịch vụ (ước tính)')).toBeInTheDocument()
    expect(screen.getByText('Tự động gia hạn')).toBeInTheDocument()
    http.command.mockResolvedValue({ ...pending, durationYears: 2, amountVnd: 2_160_000 })
    fireEvent.click(create)
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/goi-dich-vu/chuyen-khoan/501?'))
    expect(http.command).toHaveBeenCalledWith('/api/farms/42/subscription/payments',
      { durationYears: 2, reviewedPriceVersion: 7 }, expect.objectContaining({ key: expect.any(String) }))
  })

  it('keeps the command key on a network retry and asks before reopening another term', async () => {
    page('/dang-ky-goi?farm=42')
    fireEvent.click(await screen.findByRole('radio', { name: /1 năm/ }))
    http.command.mockRejectedValueOnce(new Error('Network failure')).mockResolvedValueOnce({ ...pending, reopened: true })
    fireEvent.click(screen.getByRole('button', { name: 'Tạo yêu cầu thanh toán' }))
    await screen.findByText(/Network failure|Không thể/)
    const firstKey = http.command.mock.calls[0][2].key
    fireEvent.click(screen.getByRole('button', { name: 'Tạo yêu cầu thanh toán' }))
    expect(await screen.findByRole('dialog', { name: 'Bạn đã có yêu cầu còn hiệu lực' })).toBeInTheDocument()
    expect(http.command.mock.calls[1][2].key).toBe(firstKey)
    fireEvent.click(screen.getByRole('button', { name: 'Mở lại hướng dẫn' }))
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/chuyen-khoan/501?'))
  })

  it('shows a price conflict and requires another review before submitting the new price', async () => {
    page('/dang-ky-goi?farm=42')
    fireEvent.click(await screen.findByRole('radio', { name: /1 năm/ }))
    http.command.mockRejectedValue(new BackendError(409, { code: 'MSG-FE19-02', params: {
      seen: { version: 7, term: 1, amountVnd: 1_200_000 }, current: { version: 8, term: 1, amountVnd: 1_320_000 },
    } }))
    fireEvent.click(screen.getByRole('button', { name: 'Tạo yêu cầu thanh toán' }))
    expect(await screen.findByRole('dialog', { name: 'Bảng giá đã thay đổi' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xem lại giá mới' })).toBeInTheDocument()
    expect(http.command).toHaveBeenCalledTimes(1)
  })

  it('renders the actual QR and retains copyable bank details when the image fails', async () => {
    page()
    const qr = await screen.findByRole('img', { name: 'Mã VietQR thanh toán' })
    expect(qr).toHaveAttribute('src', pending.qrImageUrl)
    fireEvent.error(qr)
    expect(screen.getByText(/Không tải được mã QR/)).toBeInTheDocument()
    expect(screen.getByText('TEST-ACCOUNT')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Sao chép/ })).toHaveLength(5)
  })

  it('shows service status and the actual current period on the renewal form', async () => {
    const period = { paymentCode: 'OLD', durationYears: 1 as const, amountVnd: 1_200_000,
      start: '2025-11-14T17:00:00Z', end: '2026-11-14T17:00:00Z', status: 'CURRENT' as const }
    http.get.mockResolvedValue({ ...overview, serviceStatus: 'ACTIVE', currentPeriod: period, periods: [period], latestEnd: period.end })
    page('/goi-dich-vu/gia-han?farm=42')
    expect(await screen.findByText('Đang hoạt động', { selector: 'dd' })).toBeInTheDocument()
    expect(screen.getByText('15/11/2025 → 14/11/2026')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tạo yêu cầu thanh toán' })).toBeDisabled()
  })

  it('does not claim the account was copied when the clipboard rejects the write', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('Denied')) } })
    try {
      page()
      fireEvent.click(await screen.findByRole('button', { name: 'Sao chép số tài khoản' }))
      expect(await screen.findByText(/Không thể sao chép/)).toBeInTheDocument()
      expect(screen.queryByText('Đã chép')).not.toBeInTheDocument()
    } finally {
      if (descriptor) Object.defineProperty(navigator, 'clipboard', descriptor)
      else Reflect.deleteProperty(navigator, 'clipboard')
    }
  })

  it('keeps the full-width transfer-content copy button on phones and reports a failed copy', async () => {
    const media = Object.getOwnPropertyDescriptor(window, 'matchMedia')
    const clipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: (query: string) => ({
      matches: query.includes('max-width'), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }) })
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('Denied')) } })
    try {
      page()
      const copy = await screen.findByRole('button', { name: 'Sao chép nội dung chuyển khoản' })
      expect(copy).toHaveTextContent('Sao chép nội dung chuyển khoản')
      fireEvent.click(copy)
      expect(await screen.findByText(/Không thể sao chép/)).toBeInTheDocument()
      expect(copy).not.toHaveTextContent('Đã chép')
    } finally {
      if (media) Object.defineProperty(window, 'matchMedia', media)
      else Reflect.deleteProperty(window, 'matchMedia')
      if (clipboard) Object.defineProperty(navigator, 'clipboard', clipboard)
      else Reflect.deleteProperty(navigator, 'clipboard')
    }
  })
})

describe('five-second automatic payment status updates', () => {
  async function open(changes: Partial<Payment> = {}) {
    vi.useFakeTimers(); vi.setSystemTime(NOW)
    let value = { ...pending, ...changes }
    http.get.mockImplementation(async (path: string) => path.endsWith('/subscription') ? overview : value)
    let view: ReturnType<typeof page>
    await act(async () => { view = page() })
    return { view: view!, set: (next: Partial<Payment>) => { value = { ...value, ...next } } }
  }
  it('refreshes every five seconds and stops after PAID without needing a button click', async () => {
    const state = await open()
    expect(http.get).toHaveBeenCalledTimes(2)
    await act(async () => { await vi.advanceTimersByTimeAsync(4999) })
    expect(http.get).toHaveBeenCalledTimes(2)
    state.set({ state: 'PAID', confirmedAt: new Date(NOW + 5000).toISOString(), purchasedStart: pending.requestedAt,
      purchasedEnd: '2027-11-09T03:00:00Z' })
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(screen.getByText(/đã được xác nhận/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Vào trại' })).toBeInTheDocument()
    const calls = http.get.mock.calls.length
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000) })
    expect(http.get).toHaveBeenCalledTimes(calls)
    state.view.unmount()
  })

  it('keeps the last status after a refresh error, retries, and stops on leaving', async () => {
    const state = await open()
    http.get.mockRejectedValueOnce(new Error('Status unavailable'))
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(screen.getByText('TEST-ACCOUNT')).toBeInTheDocument()
    // MSG-FE19-08 shows the last status with its Vietnamese label, not the raw enum.
    expect(screen.getByText(/Trạng thái gần nhất: Đang chờ\./)).toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(http.get).toHaveBeenCalledTimes(4)
    state.view.unmount()
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
    expect(http.get).toHaveBeenCalledTimes(4)
  })

  it('hides the QR at the exact expiry even when the backend still reports PENDING', async () => {
    await open({ expiresAt: new Date(NOW + 1000).toISOString() })
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(screen.queryByRole('img', { name: 'Mã VietQR thanh toán' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Yêu cầu đã hết hạn' })).toBeInTheDocument()
    const calls = http.get.mock.calls.length
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
    expect(http.get).toHaveBeenCalledTimes(calls)
  })

  it('does not overlap slow requests and ignores a late response after navigation', async () => {
    await open()
    let finish!: (value: Payment) => void
    http.get.mockImplementationOnce(() => new Promise<Payment>((resolve) => { finish = resolve }))
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000) })
    expect(http.get).toHaveBeenCalledTimes(3)
    http.get.mockImplementation(async (path: string) => path.endsWith('/subscription') ? overview : { ...pending, id: 502, quoteRef: 'BC-NEW' })
    await act(async () => { fireEvent.click(screen.getByRole('link', { name: 'Another request' })) })
    expect(screen.getByText(/Yêu cầu BC-NEW/)).toBeInTheDocument()
    await act(async () => { finish({ ...pending, state: 'PAID' }) })
    expect(screen.queryByText(/đã được xác nhận/)).not.toBeInTheDocument()
    expect(screen.getByText(/Yêu cầu BC-NEW/)).toBeInTheDocument()
  })
})
